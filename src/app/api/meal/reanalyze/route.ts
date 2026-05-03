/**
 * メニュー名から AI に栄養素・アドバイスを再計算してもらう API。
 *
 * 用途: ユーザーが「✏️ 修正」でメニュー名を変えた時に、
 * カロリー・PFC・アドバイスを新しいメニューに合わせて自動再計算する。
 *
 * - 写真は使わず、メニュー名のテキストのみから推定 (軽量・高速)
 * - 結果は editDraft に詰めて返す (ユーザー確認後、saveEdit で本保存)
 * - 利用回数カウントは加算しない (修正補助なので)
 */

import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import { SAFE_LANGUAGE_RULES } from "../../../lib/safe-language";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function getAnthropic() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not set");
  return new Anthropic({ apiKey });
}

const SYSTEM_PROMPT = `あなたはZERO-PAINセルフケアアプリ専属のAI栄養士です。
ユーザーが入力した「メニュー名」だけをもとに、その料理の標準的な
カロリー・三大栄養素・バランススコア・アドバイスを推定します。

【ルール】
- メニュー名から一般的な1人前の量を想定して推定
- 推定が難しい曖昧な名前 (例:「料理」「ご飯」) は ambiguous=true を返す
- カフェラテ・ブラックコーヒー等、飲料も対象
- 「症状」「診断」「治療」などの医療用語は使わず「お悩み」「チェック」「ケア」と表現
- アドバイスは「写真を拝見しました」のような写真前提の表現は使わない

【出力フォーマット (JSON 1件のみ、余計な前置き・コードブロック禁止)】
{
  "menu_name": "正規化したメニュー名",
  "ambiguous": false,
  "calories": 整数kcal,
  "protein_g": 小数第1位のg,
  "carbs_g": 小数第1位のg,
  "fat_g": 小数第1位のg,
  "score": 0〜100の整数,
  "advice": "200〜300文字のアドバイス。良い点1つ + 姿勢・体調との関係 + 次の食事の提案。絵文字1〜2個まで。"
}`;

interface ReanalyzeResult {
  menu_name?: string;
  ambiguous?: boolean;
  calories?: number;
  protein_g?: number;
  carbs_g?: number;
  fat_g?: number;
  score?: number;
  advice?: string;
}

export async function POST(req: NextRequest) {
  try {
    const { menu_name, meal_type } = (await req.json()) as {
      menu_name?: string;
      meal_type?: string;
    };

    if (!menu_name || typeof menu_name !== "string" || menu_name.trim() === "") {
      return NextResponse.json(
        { error: "menu_name required" },
        { status: 400 }
      );
    }

    const userPrompt = `メニュー名: 「${menu_name.trim()}」${
      meal_type ? `\n食事区分: ${meal_type}` : ""
    }\n\nこのメニューの栄養素とアドバイスを推定し、JSON1件で返してください。`;

    const client = getAnthropic();
    const response = await client.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 800,
      system: SAFE_LANGUAGE_RULES + "\n\n" + SYSTEM_PROMPT,
      messages: [{ role: "user", content: userPrompt }],
    });

    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      return NextResponse.json({ error: "AI応答が空でした" }, { status: 500 });
    }
    const jsonMatch = textBlock.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json(
        { error: "AI応答の解析に失敗しました", raw: textBlock.text },
        { status: 500 }
      );
    }

    let result: ReanalyzeResult;
    try {
      result = JSON.parse(jsonMatch[0]) as ReanalyzeResult;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return NextResponse.json(
        { error: "JSON解析エラー", detail: msg, raw: textBlock.text },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true, result });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("Meal reanalyze API error:", e);
    return NextResponse.json(
      { error: "再分析に失敗しました", detail: msg },
      { status: 500 }
    );
  }
}
