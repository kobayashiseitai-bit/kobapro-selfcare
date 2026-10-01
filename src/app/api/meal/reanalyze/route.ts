/**
 * メニュー名から AI に栄養素・アドバイスを再計算してもらう API。
 *
 * 用途: ユーザーが「✏️ 修正」でメニュー名を変えた時に、
 * カロリー・PFC・アドバイスを新しいメニューに合わせて自動再計算する。
 *
 * - 写真は使わず、メニュー名のテキストのみから推定 (軽量・高速)
 * - 結果は editDraft に詰めて返す (ユーザー確認後、saveEdit で本保存)
 * - 食事分析の利用回数（usage_counters の meal）には数えない (修正補助なので)
 *
 * 2026-10-02: 以前は deviceId を受け取らず、登録・回数・入力長のどれも確かめずに毎回 AI を呼んでいた。
 * URL さえ分かれば誰でも無制限に AI を呼べ、menu_name に任意の長文を詰めることもできた。
 * AI を呼ぶ前に次を確かめる。
 *   1. deviceId が登録済みであること（無ければ 404）
 *   2. 直す対象の食事記録（recordId）がその人のものであること（違えば 403）
 *   3. いま食事分析を使える人であること（2026-10-02）: 有料・トライアル中（家族プランの家族・審査用アカウントを含む）と、
 *      2026-09-13 より前に登録した方だけ（/api/checkin・/api/coaching と同じ判定）。それ以外は 402 と案内文。
 *      課金状態を読めなかったときも AI は呼ばずに断る。
 *      以前は「食事記録は食事分析を使える人しか作れない」ことに頼っていたが、記録は有料でなくなった後も残る。
 *      そのため無料体験を解約した新規の方（食事分析の無料枠は0回）でも、残った1件の記録から
 *      好きなメニュー名を入れて、毎月 MONTHLY_REANALYZE_LIMIT 回まで「文字で行う食事分析」として AI を呼べた
 *   4. menu_name は前後の空白を除いて MAX_MENU_NAME_LENGTH 文字まで（超えたら 400）。
 *      meal_type は4つの区分のどれかだけをプロンプトに入れる
 *   5. 再計算は1つの記録につき月 PER_RECORD_REANALYZE_LIMIT 回まで（1件の記録を使い回して、
 *      写真の食事分析の代わりにさせない）、1人あたり月 MONTHLY_REANALYZE_LIMIT 回まで（ボタンの連打でも費用が積み上がらないように）。
 *      回数は usage_counters に数える（食事分析の回数とは別）。1人あたりは feature="meal_reanalyze"、
 *      記録ごとは feature="meal_reanalyze:<記録のid>"（getSubscriptionState は posture / chat / meal 以外の行を読まない）
 */

import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import { SAFE_LANGUAGE_RULES } from "../../../lib/safe-language";
import { createServerSupabase } from "../../../lib/supabase-server";
import {
  buildLimitReachedMessage,
  getCurrentPeriodMonth,
  getSubscriptionState,
} from "../../../lib/subscription";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function getAnthropic() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not set");
  return new Anthropic({ apiKey });
}

/** メニュー名の上限（複数の料理を「 / 」でつないだ名前も入る長さ） */
const MAX_MENU_NAME_LENGTH = 80;
/** 再計算の回数の上限（1人あたり・1か月） */
const MONTHLY_REANALYZE_LIMIT = 60;
const REANALYZE_FEATURE = "meal_reanalyze";
/** 再計算の回数の上限（1つの記録あたり・1か月）。メニュー名の打ち直しには足りる回数 */
const PER_RECORD_REANALYZE_LIMIT = 5;
function perRecordFeature(recordId: string): string {
  return `${REANALYZE_FEATURE}:${recordId.toLowerCase()}`;
}
/** 数値は手で直して保存できる（回数の上限・有料の機能で断ったときに添える） */
const MANUAL_EDIT_HINT = "カロリーなどの数値は、下の欄で直接直して保存できます。";
const VALID_MEAL_TYPES = ["朝食", "昼食", "夕食", "間食"];
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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

/** 同時に送られたほかの再計算と数え方がぶつかったときに、数え直す回数 */
const CLAIM_ATTEMPTS = 3;

/**
 * 今月の再計算の回数を1つ確保する（2026-10-02）。feature ごとに数え、limit 回まで。
 * 以前は「読む → used+1 を書く（id だけを条件に）→ AI」だったため、同時に何本も送ると全部が同じ used を読み、
 * 全部が used+1 を書いて全部が AI を呼べた（カウンターは1しか増えず、月の上限が効かなかった）。
 * いまは「読んだときの count のままなら +1」という条件付きの書き込みにして、書けた1本だけが AI を呼ぶ。
 * 行がまだ無いときは insert（UNIQUE(user_id, feature, period_month) があるので、同時の2本目は失敗する）。
 * ぶつかった分は CLAIM_ATTEMPTS 回まで読み直してやり直し、それでも取れなければ "busy"。
 * 確保できた回数の合計は必ず上限以下になる。
 */
async function claimReanalyzeSlot(
  supabase: ReturnType<typeof createServerSupabase>,
  userId: string,
  feature: string,
  limit: number
): Promise<"ok" | "limit" | "busy" | "error"> {
  const period = getCurrentPeriodMonth();
  for (let attempt = 0; attempt < CLAIM_ATTEMPTS; attempt++) {
    const { data: counter, error: counterError } = await supabase
      .from("usage_counters")
      .select("id, count")
      .eq("user_id", userId)
      .eq("feature", feature)
      .eq("period_month", period)
      .maybeSingle();
    if (counterError) return "error";
    const used: number = counter?.count ?? 0;
    if (used >= limit) return "limit";

    if (counter) {
      const { data: updated, error: updateError } = await supabase
        .from("usage_counters")
        .update({ count: used + 1, updated_at: new Date().toISOString() })
        .eq("id", counter.id)
        .eq("count", used)
        .select("id");
      if (updateError) return "error";
      if (updated && updated.length > 0) return "ok";
      // 読んだあとに別の1本が数えた: 読み直してやり直す
      continue;
    }

    const { error: insertError } = await supabase.from("usage_counters").insert({
      user_id: userId,
      feature,
      period_month: period,
      count: 1,
    });
    if (!insertError) return "ok";
    // 同時の別の1本が先に行を作った（UNIQUE 違反）: 読み直してやり直す
    if (insertError.code === "23505") continue;
    return "error";
  }
  return "busy";
}

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
    const { deviceId, recordId, menu_name, meal_type } = (await req.json()) as {
      deviceId?: string;
      recordId?: string;
      menu_name?: string;
      meal_type?: string;
    };

    if (
      !deviceId ||
      typeof deviceId !== "string" ||
      !recordId ||
      typeof recordId !== "string" ||
      !UUID_RE.test(recordId)
    ) {
      return NextResponse.json(
        { error: "直す対象の記録が見つかりません。撮影し直してください。" },
        { status: 400 }
      );
    }
    if (!menu_name || typeof menu_name !== "string" || menu_name.trim() === "") {
      return NextResponse.json(
        { error: "menu_name required" },
        { status: 400 }
      );
    }
    const menuName = menu_name.trim();
    if (menuName.length > MAX_MENU_NAME_LENGTH) {
      return NextResponse.json(
        { error: `メニュー名は${MAX_MENU_NAME_LENGTH}文字以内で入力してください` },
        { status: 400 }
      );
    }
    // 区分は決まった4つだけをプロンプトに入れる（任意の文を埋め込ませない）
    const mealType =
      typeof meal_type === "string" && VALID_MEAL_TYPES.includes(meal_type) ? meal_type : null;

    const supabase = createServerSupabase();

    // 1. 登録済みの端末か（AI を呼ぶ前に断る）
    const { data: users, error: userError } = await supabase
      .from("users")
      .select("id")
      .eq("device_id", deviceId)
      .limit(1);
    if (userError) {
      return NextResponse.json({ error: "再計算に失敗しました" }, { status: 500 });
    }
    if (!users || users.length === 0) {
      return NextResponse.json({ error: "ユーザーが見つかりません" }, { status: 404 });
    }
    const userId: string = users[0].id;

    // 2. 直す対象の食事記録が、この人のものか
    const { data: record, error: recordError } = await supabase
      .from("meal_records")
      .select("id, user_id")
      .eq("id", recordId)
      .maybeSingle();
    if (recordError) {
      return NextResponse.json({ error: "再計算に失敗しました" }, { status: 500 });
    }
    if (!record) {
      return NextResponse.json(
        { error: "直す対象の記録が見つかりません。撮影し直してください。" },
        { status: 404 }
      );
    }
    if (record.user_id !== userId) {
      return NextResponse.json({ error: "この記録は再計算できません" }, { status: 403 });
    }

    // 3. いま食事分析を使える人か（有料・トライアル中と、2026-09-13 より前に登録した方だけ）。
    //    回数を数える前に断る。読めなかったときも AI は呼ばない（通さない側に倒す）
    let canUseMealAi = false;
    try {
      const subState = await getSubscriptionState(supabase, userId);
      canUseMealAi = subState.isPaid || subState.isLegacyUser;
    } catch (stateErr) {
      console.error("[meal/reanalyze] failed to load subscription state:", stateErr);
      return NextResponse.json({ error: "再計算に失敗しました" }, { status: 500 });
    }
    if (!canUseMealAi) {
      // 画面（page.tsx の reanalyzeFromMenuName）は error の文をそのまま出すので、案内文を error に入れる
      const message = `${buildLimitReachedMessage("meal", 0)}${MANUAL_EDIT_HINT}`;
      return NextResponse.json(
        { error: message, code: "limit_reached", feature: "meal", limit: 0, message },
        { status: 402 }
      );
    }

    // 5. 再計算の回数（AI を呼ぶ前に数える。失敗した呼び出しも費用がかかりうるので数えたままにする）。
    //    記録ごとの回数を先に確保する（1人あたりの回数を、記録ごとの上限で断る分まで減らさないため）
    const claimResponse = (claim: "ok" | "limit" | "busy" | "error", limitMessage: string) => {
      if (claim === "limit") {
        return NextResponse.json({ error: limitMessage }, { status: 429 });
      }
      if (claim === "busy") {
        return NextResponse.json(
          { error: "ほかの再計算と重なりました。少しおいてから、もう一度お試しください。" },
          { status: 429 }
        );
      }
      if (claim === "error") {
        // 数えられないまま AI を呼ぶと上限が効かないので、呼ばずに断る
        return NextResponse.json({ error: "再計算に失敗しました" }, { status: 500 });
      }
      return null;
    };
    const recordClaim = await claimReanalyzeSlot(
      supabase,
      userId,
      perRecordFeature(recordId),
      PER_RECORD_REANALYZE_LIMIT
    );
    const recordRejected = claimResponse(
      recordClaim,
      `この記録の自動再計算は、今月はここまでです（${PER_RECORD_REANALYZE_LIMIT}回まで）。${MANUAL_EDIT_HINT}`
    );
    if (recordRejected) return recordRejected;

    const monthlyClaim = await claimReanalyzeSlot(
      supabase,
      userId,
      REANALYZE_FEATURE,
      MONTHLY_REANALYZE_LIMIT
    );
    const monthlyRejected = claimResponse(
      monthlyClaim,
      `今月の自動再計算の回数（${MONTHLY_REANALYZE_LIMIT}回）に達しました。${MANUAL_EDIT_HINT}`
    );
    if (monthlyRejected) return monthlyRejected;

    const userPrompt = `メニュー名: 「${menuName}」${
      mealType ? `\n食事区分: ${mealType}` : ""
    }\n\nこのメニューの栄養素とアドバイスを推定し、JSON1件で返してください。`;

    const client = getAnthropic();
    const response = await client.messages.create({
      model: "claude-sonnet-5",
      // Sonnet 5 は既定で adaptive thinking ON。小さな max_tokens だと本文が途切れるため無効化（4.5時代と同じ挙動）
      thinking: { type: "disabled" },
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
