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
    .select("id")
    .eq("device_id", deviceId);
  if (!users || users.length === 0) {
    return { contextText: "", latestPostureImageUrl: null, latestPostureDate: null };
  }
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

  const contextText =
    parts.length === 0
      ? ""
      : `\n\n【このユーザーの過去データ】\nこのユーザーはリピーターです。過去のデータを参考にして、より的確なアドバイスをしてください。\n${parts.join("\n")}`;

  return { contextText, latestPostureImageUrl, latestPostureDate };
}

export async function POST(req: NextRequest) {
  try {
    const { messages, deviceId } = await req.json();

    const { contextText, latestPostureImageUrl, latestPostureDate } =
      await buildUserContext(deviceId || "");
    const systemPrompt = BASE_PROMPT + contextText;

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
