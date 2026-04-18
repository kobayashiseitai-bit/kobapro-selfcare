import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

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
  neck: "首こり", shoulder_stiff: "肩こり", shoulder_pain: "肩の痛み",
  back: "腰痛", eye_fatigue: "眼精疲労", eye_recovery: "視力回復",
};

const DAYS = ["日", "月", "火", "水", "木", "金", "土"];

export async function POST(req: NextRequest) {
  try {
    const { deviceId } = await req.json();
    if (!deviceId) {
      return NextResponse.json({ prediction: null });
    }

    const supabase = getSupabase();

    // ユーザー取得
    const { data: users } = await supabase
      .from("users")
      .select("id, name, pain_areas, concerns, age")
      .eq("device_id", deviceId);

    if (!users || users.length === 0) {
      return NextResponse.json({ prediction: null });
    }
    const user = users[0];

    // 過去データを並列取得
    const [symptomRes, postureRes] = await Promise.all([
      supabase
        .from("symptom_selections")
        .select("symptom_id, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(100),
      supabase
        .from("posture_records")
        .select("diagnosis, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(10),
    ]);

    const symptoms = symptomRes.data || [];
    const postures = postureRes.data || [];

    // データが少ない場合は汎用アドバイス
    if (symptoms.length === 0 && postures.length === 0) {
      return NextResponse.json({
        prediction: user.pain_areas
          ? `登録時に${user.pain_areas.split(",").map((p: string) => {
              const labels: Record<string, string> = { neck: "首", shoulder: "肩", back: "腰", head: "頭", knee: "膝", eye: "目", arm: "腕", leg: "脚" };
              return labels[p] || p;
            }).join("・")}の痛みがあると記録されています。定期的なセルフケアで予防しましょう。`
          : "まだデータが少ないため、AIカウンセリングや姿勢チェックを試してみてください。",
        riskLevel: user.pain_areas ? "medium" : "low",
        recommendedAction: user.pain_areas ? "セルフケア動画を見る" : "AIに相談する",
        symptomId: null,
      });
    }

    // 曜日別パターン分析
    const dayPattern: Record<string, Record<string, number>> = {};
    symptoms.forEach((s) => {
      const day = DAYS[new Date(s.created_at).getDay()];
      if (!dayPattern[day]) dayPattern[day] = {};
      dayPattern[day][s.symptom_id] = (dayPattern[day][s.symptom_id] || 0) + 1;
    });

    // 姿勢の問題点
    const postureIssues: string[] = [];
    if (postures.length > 0) {
      const latest = postures[0];
      const diag = Array.isArray(latest.diagnosis) ? latest.diagnosis : [];
      diag.forEach((d: { level: string; label: string; message: string }) => {
        if (d.level !== "good") postureIssues.push(`${d.label}: ${d.message}`);
      });
    }

    // 症状頻度
    const symptomCounts: Record<string, number> = {};
    symptoms.forEach((s) => {
      symptomCounts[s.symptom_id] = (symptomCounts[s.symptom_id] || 0) + 1;
    });
    const topSymptom = Object.entries(symptomCounts).sort((a, b) => b[1] - a[1])[0];

    // Claude AIで予測生成
    const today = DAYS[new Date().getDay()];
    const analysisPrompt = `あなたは整体の専門家AIです。以下のユーザーデータから、今日の体のコンディションを予測し、予防アドバイスを1つ生成してください。

【重要】回答では以下の用語を避けてください（セルフケアアプリのため）:
- 「症状」→「お悩み」「気になる状態」「コンディション」
- 「診断」→「チェック」「見立て」「分析」
- 「治療」→「ケア」「セルフケア」
- 「治る」→「ラクになる」

【ユーザー情報】
- 年齢: ${user.age || "不明"}
- 登録時の痛み: ${user.pain_areas || "なし"}
- 悩み: ${user.concerns || "なし"}

【症状履歴（過去の選択回数）】
${Object.entries(symptomCounts).map(([id, c]) => `- ${SYMPTOM_LABELS[id] || id}: ${c}回`).join("\n")}

【曜日別パターン】
${Object.entries(dayPattern).map(([day, counts]) => `- ${day}曜日: ${Object.entries(counts).map(([id, c]) => `${SYMPTOM_LABELS[id] || id}(${c}回)`).join(", ")}`).join("\n")}

【直近の姿勢診断で見つかった問題】
${postureIssues.length > 0 ? postureIssues.join("\n") : "特になし"}

【今日】${today}曜日

以下のJSON形式で回答してください。他の文章は不要です。
{"prediction":"今日の予測メッセージ（50文字以内）","detail":"具体的なアドバイス（100文字以内）","riskLevel":"low/medium/high","symptomId":"neck/shoulder_stiff/shoulder_pain/back/eye_fatigue/eye_recovery/null"}`;

    const response = await getClient().messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 200,
      messages: [{ role: "user", content: analysisPrompt }],
    });

    const text = response.content[0].type === "text" ? response.content[0].text : "";

    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return NextResponse.json({
          prediction: parsed.prediction || "体調に気をつけましょう",
          detail: parsed.detail || "",
          riskLevel: parsed.riskLevel || "low",
          symptomId: parsed.symptomId || (topSymptom ? topSymptom[0] : null),
          recommendedAction: "セルフケア動画を見る",
        });
      }
    } catch { /* JSON parse error */ }

    // フォールバック
    return NextResponse.json({
      prediction: topSymptom
        ? `${SYMPTOM_LABELS[topSymptom[0]] || topSymptom[0]}に注意しましょう`
        : "定期的なセルフケアで体調管理をしましょう",
      riskLevel: postureIssues.length > 2 ? "high" : postureIssues.length > 0 ? "medium" : "low",
      recommendedAction: "セルフケア動画を見る",
      symptomId: topSymptom ? topSymptom[0] : null,
    });
  } catch (e) {
    console.error("Predict error:", e);
    return NextResponse.json({
      prediction: "定期的なセルフケアで体調管理をしましょう",
      riskLevel: "low",
      recommendedAction: "AIに相談する",
      symptomId: null,
    });
  }
}
