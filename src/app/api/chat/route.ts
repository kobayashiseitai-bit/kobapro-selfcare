import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";
import { NextRequest } from "next/server";

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

const BASE_PROMPT = `あなたはZERO-PAINセルフケアアプリの専属AIカウンセラーです。整体・ボディケアの専門知識を持っています。

【役割】
ユーザーの体の不調や症状を丁寧に聞き取り、最適なセルフケア・エクササイズを提案します。

【対話ルール】
1. まず「今日はどんな症状が気になりますか？」と優しく聞く
2. ユーザーの回答に対して、1〜2つの追加質問をして症状を深掘りする（例：「いつ頃から？」「どんな時に悪化する？」「デスクワークが多い？」）
3. 十分な情報が得られたら、以下の形式で提案する

【提案フォーマット】
症状の分析と、おすすめのセルフケアを以下のカテゴリから提案：
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

提案時は必ず最後に以下のJSON形式を含めてください：
<recommendation>{"symptomId":"neck"}</recommendation>
（symptomIdは: neck, shoulder_stiff, shoulder_pain, back, headache, knee, eye_fatigue, arm_numbness, leg_swelling, kyphosis, straight_neck のいずれか）

【トーン】
- 親しみやすく温かい口調
- 専門的すぎず分かりやすく
- 短めの文章で（スマホで読みやすく）
- 絵文字は控えめに使用OK`;

async function buildUserContext(deviceId: string): Promise<string> {
  if (!deviceId) return "";
  const supabase = getSupabase();
  const { data: users } = await supabase
    .from("users")
    .select("id")
    .eq("device_id", deviceId);
  if (!users || users.length === 0) return "";
  const userId = users[0].id;

  const [symptomRes, postureRes, chatRes] = await Promise.all([
    supabase
      .from("symptom_selections")
      .select("symptom_id, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("posture_records")
      .select("diagnosis, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("chat_logs")
      .select("role, content, recommended_symptom, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(10),
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

  const postures = postureRes.data || [];
  if (postures.length > 0) {
    const latest = postures[0];
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

  if (parts.length === 0) return "";
  return `\n\n【このユーザーの過去データ】\nこのユーザーはリピーターです。過去のデータを参考にして、より的確なアドバイスをしてください。\n${parts.join("\n")}`;
}

export async function POST(req: NextRequest) {
  try {
    const { messages, deviceId } = await req.json();

    const userContext = await buildUserContext(deviceId || "");
    const systemPrompt = BASE_PROMPT + userContext;

    const apiMessages = (!messages || messages.length === 0)
      ? [{ role: "user" as const, content: "こんにちは、相談したいです。" }]
      : messages;

    const client = getClient();

    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        let fullText = "";
        try {
          const stream = client.messages.stream({
            model: "claude-haiku-4-5",
            max_tokens: 500,
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
