import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";

function getClient() {
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
}

export const dynamic = "force-dynamic";

const SYSTEM_PROMPT = `あなたはZERO-PAINセルフケアアプリの専属AIカウンセラーです。整体・ボディケアの専門知識を持っています。

【役割】
ユーザーの体の不調や症状を丁寧に聞き取り、最適なセルフケア・エクササイズを提案します。

【対話ルール】
1. まず「今日はどんな症状が気になりますか？」と優しく聞く
2. ユーザーの回答に対して、1〜2つの追加質問をして症状を深掘りする（例：「いつ頃から？」「どんな時に悪化する？」「デスクワークが多い？」）
3. 十分な情報が得られたら、以下の形式で提案する

【提案フォーマット】
症状の分析と、おすすめのセルフケアを以下のカテゴリから提案：
- 首の痛み → 首のストレッチ
- 肩こり → 肩こり解消ストレッチ
- 肩の痛み → 肩関節エクササイズ
- 腰痛 → 腰痛改善ストレッチ
- 眼精疲労 → 目のツボ押し＆エクササイズ
- 視力低下 → 視力回復トレーニング

提案時は必ず最後に以下のJSON形式を含めてください：
<recommendation>{"symptomId":"neck"}</recommendation>
（symptomIdは: neck, shoulder_stiff, shoulder_pain, back, eye_fatigue, eye_recovery のいずれか）

【トーン】
- 親しみやすく温かい口調
- 専門的すぎず分かりやすく
- 短めの文章で（スマホで読みやすく）
- 絵文字は控えめに使用OK`;

export async function POST(req: NextRequest) {
  try {
    const { messages } = await req.json();

    // 初回（空の場合）は挨拶メッセージを返す
    const apiMessages = (!messages || messages.length === 0)
      ? [{ role: "user" as const, content: "こんにちは、相談したいです。" }]
      : messages;

    const response = await getClient().messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 500,
      system: SYSTEM_PROMPT,
      messages: apiMessages,
    });

    const text =
      response.content[0].type === "text" ? response.content[0].text : "";

    // recommendationタグからsymptomIdを抽出
    const match = text.match(/<recommendation>\s*(\{.*?\})\s*<\/recommendation>/);
    let recommendedSymptomId: string | null = null;
    let cleanText = text;
    if (match) {
      try {
        const parsed = JSON.parse(match[1]);
        recommendedSymptomId = parsed.symptomId;
      } catch { /* ignore */ }
      cleanText = text.replace(/<recommendation>[\s\S]*?<\/recommendation>/, "").trim();
    }

    return NextResponse.json({
      message: cleanText,
      recommendedSymptomId,
    });
  } catch (e) {
    console.error("Chat API error:", e);
    return NextResponse.json(
      { error: "AIとの通信に失敗しました" },
      { status: 500 }
    );
  }
}
