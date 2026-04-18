import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";
import { NextRequest } from "next/server";
import { STRETCH_DATA } from "../../lib/stretches";
import {
  checkAndIncrementUsage,
  getUserIdByDeviceId,
} from "../../lib/subscription";
import {
  calculateRecommendation,
  GENDER_LABELS,
  ACTIVITY_LABELS,
  GOAL_LABELS,
  type Gender,
  type ActivityLevel,
  type GoalType,
} from "../../lib/nutrition";

function getClient() {
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
}

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
  );
}

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const SYMPTOM_LABELS: Record<string, string> = {
  neck: "首こり",
  shoulder_stiff: "肩こり",
  shoulder_pain: "肩の痛み",
  back: "腰痛",
  eye_fatigue: "眼精疲労",
  eye_recovery: "視力回復",
};

const BASE_PROMPT = `あなたはZERO-PAINセルフケアアプリの専属AIカウンセラーです。20年以上の経験を持つベテラン整体師として、深い専門知識と豊富な臨床経験を持っています。

【あなたの専門知識】
- 全身の筋肉・骨格・関節の構造と動きの仕組みを熟知
- 姿勢の歪み・身体のバランス・重心移動の関係性を理解
- 日常の動作習慣・仕事内容・寝具などが体に与える影響を把握
- 疲労・ストレス・睡眠と身体症状のつながりを理解
- 各症状の原因（物理的・精神的・生活習慣的）を多角的に分析できる
- 自宅でできる効果的なセルフケア方法を多数知っている
- 整体院での施術内容や、専門的な検査が必要なケースの判断もできる

【最重要：話し方のルール】
- **専門用語・医学用語は絶対に使わない**（例:「僧帽筋」→「肩から首にかけての筋肉」「椎間板」→「背骨のクッション」「自律神経」→「体のリズムを整える働き」）
- **医療断定ワードを回避**（セルフケアアプリのため、App Store対応）
  - 「症状」→「お悩み」「気になる状態」「コンディション」
  - 「診断」→「チェック」「分析」「見立て」
  - 「治療」→「ケア」「セルフケア」
  - 「治る」→「ラクになる」「スッキリする」
  - 「改善します」→「サポートします」「役立ちます」
  - 「病気」→「不調」「気になる状態」
- **誰にでもわかる日常の言葉**で説明する
- **比喩や例え話**を使って身近に感じてもらう
- 親しみやすく温かい口調（友達のお姉さん／お兄さん的な感覚）
- 短めの文章で読みやすく（スマホで読むので1段落2-3行）
- 絵文字は控えめに（1メッセージ1-2個程度）

【対話の進め方】
1. まず症状や悩みを優しく聞く
2. 原因を探るための質問を2-3個する
   - いつから始まったか
   - どんな時に強くなる/楽になるか
   - 仕事内容や生活スタイル（デスクワーク／立ち仕事／運動習慣）
   - 寝る姿勢や睡眠時間
   - ストレス状況
3. 集めた情報から、考えられる原因を**わかりやすい言葉**で説明
4. その原因に合ったセルフケアを提案
5. なぜそのケアが効くのかも、簡単に説明する

【柔軟な対応】
- 体の不調以外の質問（生活相談、姿勢の悩み、運動方法、食事との関係、ストレス対処など）にも親身に答える
- 「これは医者に見てもらった方がいい」と感じる症状（強い痛み、しびれ、めまい、急激な変化など）は、整体師として正直に伝え、専門医の受診を勧める
- ユーザーが雑談したい時は雑談にも応じる
- どんな質問でも温かく受け止める

【セルフケア提案フォーマット】
症状を分析した上で、以下のカテゴリから最適なセルフケアを提案：
- 首の痛み・首こり → 首のストレッチ
- 肩こり → 肩こり解消ストレッチ
- 肩関節の痛み → 肩関節エクササイズ
- 腰痛 → 腰痛改善ストレッチ
- 頭痛 → 頭痛緩和セルフケア
- 膝の痛み → 膝痛改善エクササイズ
- 眼精疲労 → 目のツボ押し＆エクササイズ
- 腕・手のしびれ → 腕・手のしびれ改善ケア
- 脚・足のむくみ → 脚のむくみ解消ケア
- 猫背 → 猫背改善エクササイズ
- ストレートネック → ストレートネック改善ケア

提案する時は必ず最後に以下のJSON形式を含めてください：
<recommendation>{"symptomId":"neck"}</recommendation>
（symptomIdは: neck, shoulder_stiff, shoulder_pain, back, headache, knee, eye_fatigue, arm_numbness, leg_swelling, kyphosis, straight_neck のいずれか）

【姿勢写真がある場合（重要）】
ユーザーから姿勢写真が送られてくることがあります。その場合は：
- 写真を実際に見て、視覚的に分析してください
- 全体的な印象（姿勢全体のバランス、左右差、前後の傾きなど）を観察
- 肩の高さ、頭の位置、骨盤の傾き、重心、足の開き方、立ち方の癖などを総合的に判断
- 数値診断データと合わせて、より深い分析をする
- 「写真を拝見しました」と最初に伝えると、ユーザーは見てもらえている実感を得られます
- 良い点も必ず1つ伝える（例：「姿勢全体のバランスは保たれていますね」）
- 改善ポイントは2-3個に絞って、優先度の高いものから提案
- 専門用語は使わず、誰にでもわかる日常の言葉で説明

【NGワードの言い換え例】
- 椎間板ヘルニア → 背骨のクッションが飛び出してしまう状態
- 坐骨神経痛 → お尻から脚にかけて走る痛み
- 自律神経失調症 → 体のスイッチがうまく切り替わらない状態
- 五十肩 → 肩の関節が固まって動きにくい状態
- 頚椎症 → 首の骨周りに負担がかかっている状態
- 筋膜リリース → 筋肉を包む薄い膜をほぐすこと
- 関節可動域 → 関節がどれだけ動かせるか
- 仙腸関節 → 骨盤の真ん中の動く部分

整体師としての深い知識を活かしつつも、言葉は誰にでもわかるやさしい表現で答えてください。`;

// アプリ内に用意されている30種類のストレッチカタログを文字列化
function buildStretchCatalog(): string {
  const symptomLabelMap: Record<string, string> = {
    neck: "首こり",
    shoulder_stiff: "肩こり",
    back: "腰痛",
    headache: "頭痛",
    eye_fatigue: "眼精疲労",
    kyphosis: "猫背改善",
  };

  const sections = STRETCH_DATA.map((category) => {
    const label = symptomLabelMap[category.symptomId] || category.symptomId;
    const lines = category.stretches.map((s, i) => {
      return `  ${i + 1}. ${s.title}（${s.duration} / ${s.reps}）- ${s.benefit}`;
    });
    return `■ ${label}\n${lines.join("\n")}`;
  });

  return sections.join("\n\n");
}

const STRETCH_CATALOG_TEXT = buildStretchCatalog();

const STRETCH_CATALOG_PROMPT = `

【アプリ内に用意されている30種類のセルフケア（重要）】
ZERO-PAINアプリには、6症状 × 5種類 = 計30種類のストレッチが用意されています。
セルフケアを提案する時は、必ず以下の実際のストレッチ名を具体的に挙げて、
「このアプリの○○のセルフケアをやってみてください」と案内してください。

${STRETCH_CATALOG_TEXT}

【ストレッチ提案時のルール】
- 必ず上記のストレッチ名を使って具体的に提案する
- 「首の横倒しストレッチが効果的です」のように名前を出す
- 1〜3個選んで優先順位をつけて紹介
- その人の症状・生活習慣に合わせてどれが最適かを説明
- 「アプリのセルフケアメニューから○○を選んで実践してみてください」と誘導`;


interface UserContextResult {
  contextText: string;
  latestPostureImageUrl: string | null;
  latestPostureDate: string | null;
}

async function buildUserContext(deviceId: string): Promise<UserContextResult> {
  if (!deviceId) {
    return { contextText: "", latestPostureImageUrl: null, latestPostureDate: null };
  }
  const supabase = getSupabase();
  const { data: users } = await supabase
    .from("users")
    .select("id, name, age, height_cm, weight_kg, gender, activity_level")
    .eq("device_id", deviceId);
  if (!users || users.length === 0) {
    return { contextText: "", latestPostureImageUrl: null, latestPostureDate: null };
  }
  const user = users[0];
  const userId = user.id;

  // 過去7日間の食事履歴も取得（ガイコツ先生が食事×姿勢を総合判断）
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const [symptomRes, postureRes, chatRes, mealRes, goalRes] = await Promise.all([
    supabase
      .from("symptom_selections")
      .select("symptom_id, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("posture_records")
      .select("diagnosis, image_url, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("chat_logs")
      .select("role, content, recommended_symptom, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(10),
    supabase
      .from("meal_records")
      .select("menu_name, meal_type, calories, protein_g, carbs_g, fat_g, score, created_at")
      .eq("user_id", userId)
      .gte("created_at", sevenDaysAgo)
      .order("created_at", { ascending: false })
      .limit(30),
    supabase
      .from("nutrition_goals")
      .select("goal_type, target_calories, target_protein_g, target_weight_kg, target_period_weeks")
      .eq("user_id", userId)
      .maybeSingle(),
  ]);

  const parts: string[] = [];

  const symptoms = symptomRes.data || [];
  if (symptoms.length > 0) {
    const counts: Record<string, number> = {};
    symptoms.forEach((s) => {
      counts[s.symptom_id] = (counts[s.symptom_id] || 0) + 1;
    });
    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    const trend = sorted.map(([id, c]) => `${SYMPTOM_LABELS[id] || id}(${c}回)`).join("、");
    parts.push(`【過去の症状傾向】${trend}`);
  }

  // 最新の姿勢写真URL（vision用）
  let latestPostureImageUrl: string | null = null;
  let latestPostureDate: string | null = null;

  const postures = postureRes.data || [];
  if (postures.length > 0) {
    const latest = postures[0];
    if (latest.image_url && latest.image_url.startsWith("http")) {
      latestPostureImageUrl = latest.image_url;
      latestPostureDate = new Date(latest.created_at).toLocaleDateString("ja-JP");
    }
    const diag = Array.isArray(latest.diagnosis) ? latest.diagnosis : [];
    const issues = diag
      .filter((d: { level: string }) => d.level !== "good")
      .map((d: { label: string; message: string }) => `${d.label}: ${d.message}`);
    if (issues.length > 0) {
      const date = new Date(latest.created_at).toLocaleDateString("ja-JP");
      parts.push(`【直近の姿勢診断(${date})】${issues.join("、")}`);
    }
  }

  const chats = chatRes.data || [];
  const userChats = chats.filter((c) => c.role === "user").slice(0, 3);
  if (userChats.length > 0) {
    const topics = userChats.map((c) => c.content.slice(0, 40)).join(" / ");
    parts.push(`【過去の相談内容】${topics}`);
  }

  // 過去7日間の食事データを整形
  const meals = mealRes.data || [];
  if (meals.length > 0) {
    // 日別にグループ化
    const byDate: Record<string, { menu: string[]; totalCal: number; totalProtein: number; scores: number[] }> = {};
    meals.forEach((m) => {
      const d = new Date(m.created_at).toLocaleDateString("ja-JP", {
        month: "numeric",
        day: "numeric",
      });
      if (!byDate[d]) byDate[d] = { menu: [], totalCal: 0, totalProtein: 0, scores: [] };
      if (m.menu_name) byDate[d].menu.push(m.menu_name);
      if (m.calories) byDate[d].totalCal += m.calories;
      if (m.protein_g) byDate[d].totalProtein += Number(m.protein_g);
      if (m.score) byDate[d].scores.push(m.score);
    });

    const mealLines = Object.entries(byDate)
      .slice(0, 7)
      .map(([date, data]) => {
        const avgScore =
          data.scores.length > 0
            ? Math.round(data.scores.reduce((a, b) => a + b, 0) / data.scores.length)
            : 0;
        return `${date}: ${data.menu.slice(0, 3).join("/")} (計${data.totalCal}kcal / P${data.totalProtein.toFixed(0)}g / 平均スコア${avgScore})`;
      })
      .join("\n");

    // 平均カロリー
    const totalDays = Object.keys(byDate).length;
    const totalCal = Object.values(byDate).reduce((s, d) => s + d.totalCal, 0);
    const avgCal = totalDays > 0 ? Math.round(totalCal / totalDays) : 0;
    const totalProtein = Object.values(byDate).reduce((s, d) => s + d.totalProtein, 0);
    const avgProtein = totalDays > 0 ? (totalProtein / totalDays).toFixed(1) : "0";

    parts.push(
      `【過去7日間の食事記録(${meals.length}件)】\n${mealLines}\n1日平均: ${avgCal}kcal / タンパク質${avgProtein}g`
    );
  }

  // 栄養目標
  const goal = goalRes.data;
  if (goal) {
    const goalInfo = GOAL_LABELS[goal.goal_type as GoalType];
    const goalLabel = goalInfo ? `${goalInfo.emoji} ${goalInfo.label}` : goal.goal_type;
    parts.push(
      `【ユーザーの栄養目標】${goalLabel} / 目標カロリー${goal.target_calories}kcal / タンパク質${goal.target_protein_g}g`
    );
  }

  // ユーザーの身体プロフィール（プロフィール完成時のみ）
  if (
    user.height_cm &&
    user.weight_kg &&
    user.gender &&
    user.activity_level &&
    user.age
  ) {
    const rec = calculateRecommendation({
      gender: user.gender as Gender,
      heightCm: user.height_cm,
      weightKg: Number(user.weight_kg),
      age: user.age,
      activityLevel: user.activity_level as ActivityLevel,
      goalType: (goal?.goal_type as GoalType) || "maintain",
      targetWeightKg: goal?.target_weight_kg ? Number(goal.target_weight_kg) : undefined,
      targetPeriodWeeks: goal?.target_period_weeks || undefined,
    });

    const activityInfo = ACTIVITY_LABELS[user.activity_level as ActivityLevel];
    parts.push(
      `【ユーザーの身体情報】${GENDER_LABELS[user.gender as Gender]} / ${user.age}歳 / 身長${user.height_cm}cm / 体重${user.weight_kg}kg / 活動レベル: ${activityInfo?.label || user.activity_level}
BMI: ${rec.bmi}（${rec.bmiCategory}）/ 基礎代謝: ${rec.bmr}kcal / 1日総消費: ${rec.tdee}kcal
科学的に最適な推奨値: ${rec.recommendedCalories}kcal / タンパク質${rec.recommendedProteinG}g / 炭水化物${rec.recommendedCarbsG}g / 脂質${rec.recommendedFatG}g`
    );
  }

  const contextText =
    parts.length === 0
      ? ""
      : `\n\n【このユーザーの過去データ】\nこのユーザーはリピーターです。過去のデータを参考にして、より的確なアドバイスをしてください。\n${parts.join("\n")}\n\n【食事×姿勢×痛みの総合アドバイスについて】\n上記の食事データがある場合は、食事内容と姿勢・痛みの関連性にも触れてください。例: タンパク質不足→筋肉量低下→姿勢悪化、糖質過多→炎症→慢性痛、カフェイン摂取→交感神経優位→肩こり悪化 など。ただし専門用語ではなく日常語で説明してください。\n\n【パーソナル対応について】\n身体情報（身長・体重・年齢）と推奨値がある場合は、必ずそれを踏まえた個別アドバイスをしてください。「あなたの場合は〇〇kcalが目安です」「タンパク質が〇g足りていません」など具体的に。体重や年齢の話題は相手を傷つけないよう配慮しつつ、プロフェッショナルな助言を心がけてください。`;

  return { contextText, latestPostureImageUrl, latestPostureDate };
}

export async function POST(req: NextRequest) {
  try {
    const { messages, deviceId } = await req.json();

    // 利用制限チェック（ユーザーメッセージ=初回以外をカウント）
    const isFirst = !messages || messages.length === 0;
    if (!isFirst && deviceId) {
      const supabase = getSupabase();
      const userId = await getUserIdByDeviceId(supabase, deviceId);
      if (userId) {
        const limitCheck = await checkAndIncrementUsage(
          supabase,
          userId,
          "chat"
        );
        if (!limitCheck.allowed) {
          return new Response(
            JSON.stringify({
              error: "limit_reached",
              feature: "chat",
              usage: limitCheck.usage,
              limit: limitCheck.limit,
              message: `無料プランのAIチャットは月${limitCheck.limit}回までです。無制限にするには有料プランにアップグレードしてください。`,
            }),
            {
              status: 402,
              headers: { "Content-Type": "application/json" },
            }
          );
        }
      }
    }

    const { contextText, latestPostureImageUrl, latestPostureDate } =
      await buildUserContext(deviceId || "");
    const systemPrompt = BASE_PROMPT + STRETCH_CATALOG_PROMPT + contextText;

    // 初回チャット時のみ画像を添付（あれば）
    const isFirstMessage = !messages || messages.length === 0;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let apiMessages: any[];

    if (isFirstMessage && latestPostureImageUrl) {
      // 画像付き初回メッセージ
      apiMessages = [
        {
          role: "user" as const,
          content: [
            {
              type: "image",
              source: {
                type: "url",
                url: latestPostureImageUrl,
              },
            },
            {
              type: "text",
              text: `こんにちは、相談したいです。これは${latestPostureDate}に撮影した私の姿勢写真です。実際に見ていただいて、気になる点や改善ポイントがあれば教えてください。`,
            },
          ],
        },
      ];
    } else if (isFirstMessage) {
      apiMessages = [{ role: "user" as const, content: "こんにちは、相談したいです。" }];
    } else {
      apiMessages = messages;
    }

    const client = getClient();

    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        let fullText = "";
        try {
          const stream = client.messages.stream({
            model: "claude-sonnet-4-20250514",
            max_tokens: 800,
            system: systemPrompt,
            messages: apiMessages,
          });

          for await (const event of stream) {
            if (
              event.type === "content_block_delta" &&
              event.delta.type === "text_delta"
            ) {
              const text = event.delta.text;
              fullText += text;
              // recommendationタグはストリーミングしない（最後に処理）
              const cleanedChunk = text;
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ text: cleanedChunk })}\n\n`)
              );
            }
          }

          // recommendation抽出
          const match = fullText.match(/<recommendation>\s*(\{.*?\})\s*<\/recommendation>/);
          let recommendedSymptomId: string | null = null;
          let cleanText = fullText;
          if (match) {
            try {
              const parsed = JSON.parse(match[1]);
              recommendedSymptomId = parsed.symptomId;
            } catch { /* ignore */ }
            cleanText = fullText.replace(/<recommendation>[\s\S]*?<\/recommendation>/, "").trim();
          }

          // 完了通知
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                done: true,
                recommendedSymptomId,
                cleanText,
              })}\n\n`
            )
          );
          controller.close();
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ error: msg })}\n\n`)
          );
          controller.close();
        }
      },
    });

    return new Response(readable, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        "Connection": "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (e) {
    console.error("Chat API error:", e);
    return new Response(
      JSON.stringify({ error: "AIとの通信に失敗しました" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
