import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
  );
}

function getClient() {
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
}

const SYMPTOM_LABELS: Record<string, string> = {
  neck: "首こり",
  shoulder_stiff: "肩こり",
  back: "腰痛",
  headache: "頭痛",
  eye_fatigue: "眼精疲労",
  kyphosis: "猫背",
};

/**
 * GET /api/report?deviceId=xxx&period=week|month
 * 週次 or 月次のAI振り返りレポートを生成
 */
export async function GET(req: NextRequest) {
  try {
    const deviceId = req.nextUrl.searchParams.get("deviceId");
    const period = (req.nextUrl.searchParams.get("period") || "week") as
      | "week"
      | "month";

    if (!deviceId) {
      return NextResponse.json({ error: "deviceId required" }, { status: 400 });
    }

    const supabase = getSupabase();
    const { data: users } = await supabase
      .from("users")
      .select("id, name, age, height_cm, weight_kg, gender, activity_level")
      .eq("device_id", deviceId);

    if (!users || users.length === 0) {
      return NextResponse.json({ error: "user not found" }, { status: 404 });
    }
    const user = users[0];
    const userId = user.id;

    // 期間を決定
    const daysBack = period === "week" ? 7 : 30;
    const periodStart = new Date(
      Date.now() - daysBack * 24 * 60 * 60 * 1000
    ).toISOString();

    // 並列でデータ取得
    const [postureRes, mealRes, weightRes, symptomRes, goalRes] =
      await Promise.all([
        supabase
          .from("posture_records")
          .select("diagnosis, created_at")
          .eq("user_id", userId)
          .gte("created_at", periodStart)
          .order("created_at", { ascending: true }),
        supabase
          .from("meal_records")
          .select("menu_name, meal_type, calories, protein_g, score, created_at")
          .eq("user_id", userId)
          .gte("created_at", periodStart)
          .order("created_at", { ascending: true }),
        supabase
          .from("weight_records")
          .select("weight_kg, recorded_at")
          .eq("user_id", userId)
          .gte("recorded_at", periodStart)
          .order("recorded_at", { ascending: true }),
        supabase
          .from("symptom_selections")
          .select("symptom_id, created_at")
          .eq("user_id", userId)
          .gte("created_at", periodStart),
        supabase
          .from("nutrition_goals")
          .select("goal_type, target_calories, target_protein_g, target_weight_kg")
          .eq("user_id", userId)
          .maybeSingle(),
      ]);

    const postureCount = (postureRes.data || []).length;
    const meals = mealRes.data || [];
    const weights = weightRes.data || [];

    // データ不足時
    if (postureCount === 0 && meals.length === 0) {
      return NextResponse.json({
        period,
        hasData: false,
        message:
          period === "week"
            ? "まだ十分な記録がありません。1週間継続したらレポートを生成します。"
            : "まだ十分な記録がありません。1ヶ月継続したらレポートを生成します。",
      });
    }

    // 集計
    const totalCalories = meals.reduce(
      (s, m) => s + (m.calories || 0),
      0
    );
    const avgCalories = meals.length > 0 ? Math.round(totalCalories / Math.max(1, daysBack)) : 0;
    const totalProtein = meals.reduce(
      (s, m) => s + (Number(m.protein_g) || 0),
      0
    );
    const avgProtein =
      meals.length > 0
        ? Number((totalProtein / Math.max(1, daysBack)).toFixed(1))
        : 0;
    const mealScores = meals.map((m) => m.score).filter((s): s is number => s !== null);
    const avgMealScore =
      mealScores.length > 0
        ? Math.round(mealScores.reduce((a, b) => a + b, 0) / mealScores.length)
        : 0;

    // 体重推移
    let weightChange = 0;
    if (weights.length >= 2) {
      weightChange = Number(
        (Number(weights[weights.length - 1].weight_kg) - Number(weights[0].weight_kg)).toFixed(1)
      );
    }

    // 症状傾向
    const symptomCounts: Record<string, number> = {};
    (symptomRes.data || []).forEach((s) => {
      symptomCounts[s.symptom_id] = (symptomCounts[s.symptom_id] || 0) + 1;
    });
    const topSymptoms = Object.entries(symptomCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);

    // 姿勢の改善度（最初と最後の posture_records を比較）
    const postures = postureRes.data || [];
    let postureImprovement = "データ不足";
    if (postures.length >= 2) {
      const first = postures[0];
      const last = postures[postures.length - 1];
      const firstIssues = (Array.isArray(first.diagnosis) ? first.diagnosis : [])
        .filter((d: { level: string }) => d.level !== "good").length;
      const lastIssues = (Array.isArray(last.diagnosis) ? last.diagnosis : [])
        .filter((d: { level: string }) => d.level !== "good").length;
      if (lastIssues < firstIssues) {
        postureImprovement = `改善（${firstIssues}→${lastIssues}項目）`;
      } else if (lastIssues > firstIssues) {
        postureImprovement = `悪化（${firstIssues}→${lastIssues}項目）`;
      } else {
        postureImprovement = "維持";
      }
    }

    // 統計データをまとめる
    const stats = {
      period,
      periodLabel: period === "week" ? "この1週間" : "この1ヶ月",
      postureCount,
      postureImprovement,
      mealCount: meals.length,
      avgCalories,
      avgProtein,
      avgMealScore,
      weightChange,
      topSymptoms: topSymptoms.map(([id, c]) => ({
        label: SYMPTOM_LABELS[id] || id,
        count: c,
      })),
      goal: goalRes.data,
    };

    // Claude AI で自然言語レポートを生成
    const analysisPrompt = `あなたはZERO-PAINセルフケアアプリ専属のAI整体師『ガイコツ先生』です。
ユーザーの${stats.periodLabel}のデータを見て、温かく励ましつつ次の週/月に向けた振り返りレポートを作成してください。

【ユーザー情報】
${user.name ? `- お名前: ${user.name}さん` : ""}
${user.age ? `- 年齢: ${user.age}歳` : ""}
${user.height_cm && user.weight_kg ? `- 身体: 身長${user.height_cm}cm / 体重${user.weight_kg}kg` : ""}

【${stats.periodLabel}の統計】
- 姿勢チェック実施: ${postureCount}回
- 姿勢の変化: ${postureImprovement}
- 食事記録: ${meals.length}件
- 平均摂取カロリー: 1日約${avgCalories}kcal
- 平均タンパク質: 1日約${avgProtein}g
- 食事バランス平均スコア: ${avgMealScore}/100
- 体重変化: ${weightChange > 0 ? "+" : ""}${weightChange}kg
- よくあるお悩み: ${topSymptoms.map(([id, c]) => `${SYMPTOM_LABELS[id] || id}(${c}回)`).join("、") || "なし"}
${goalRes.data ? `- 目標: ${goalRes.data.goal_type} / 目標カロリー${goalRes.data.target_calories}kcal` : ""}

【レポートの形式】
以下のJSON形式で返してください（余計な説明なし）:

{
  "title": "レポートのタイトル（30文字以内、前向きに）",
  "summary": "全体の一言サマリー（80文字以内、温かい口調で）",
  "praise": "褒めポイント（150文字以内、具体的な数字を含めて）",
  "advice": "改善アドバイス（200文字以内、具体的なストレッチや食事内容を含めて）",
  "nextGoal": "次の${period === "week" ? "1週間" : "1ヶ月"}の目標（100文字以内、達成可能で具体的）"
}

【ルール】
- 「症状」「診断」「治療」などの医療用語は使わず、「お悩み」「チェック」「ケア」に言い換える
- 数字を必ず使って具体性を出す
- ユーザーを傷つけない励ましの口調
- 絵文字を1〜2個使う（過度にならない）`;

    const response = await getClient().messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 800,
      messages: [{ role: "user", content: analysisPrompt }],
    });

    const text =
      response.content[0].type === "text" ? response.content[0].text : "";

    let aiReport: {
      title: string;
      summary: string;
      praise: string;
      advice: string;
      nextGoal: string;
    } | null = null;

    try {
      const match = text.match(/\{[\s\S]*\}/);
      if (match) {
        aiReport = JSON.parse(match[0]);
      }
    } catch { /* ignore */ }

    return NextResponse.json({
      period,
      hasData: true,
      stats,
      report: aiReport,
      generatedAt: new Date().toISOString(),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("Report API error:", e);
    return NextResponse.json(
      { error: "レポート生成に失敗しました", detail: msg },
      { status: 500 }
    );
  }
}
