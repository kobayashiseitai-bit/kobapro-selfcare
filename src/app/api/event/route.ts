import { NextRequest, NextResponse } from "next/server";

import { createServerSupabase } from "../../lib/supabase-server";

export const dynamic = "force-dynamic";

/**
 * 効果測定の記録（2026-10-01 追加）。
 * 画面（page.tsx の trackEvent）が送りっぱなしで呼び、public.app_events に1行書く。
 * テーブル定義は supabase/migrations/app_events.sql（RLS 有効・ポリシーなし＝サーバーだけが書ける）。
 *
 * 受け付けるのは下の5つの event だけ。それ以外・形の崩れた送信は 400 で断る。
 * 書き込みに失敗しても画面は待っていないので、アプリは止まらない（ログとステータスで気づけるよう 500 を返す）。
 */
const ALLOWED_EVENTS = new Set([
  "register_view", // 登録画面を開いた
  "register_done", // 登録を終えた
  "upgrade_card_view", // 料金プランの案内カードを見た（props.feature = chat / meal / posture / before_after / coaching）
  "subscription_view", // 料金プラン画面を開いた
  "purchase_start", // 購入ボタンを押して、ストアの購入画面へ進んだ（props.plan）
  // "checkin_ai_free" はここに入れないこと。/api/checkin がサーバーで書き、新規・未課金の AI の1日の上限を数える台帳。
  // 画面から書けるようにすると、上限を偽って使い切らせられる
]);

const MAX_DEVICE_ID_LENGTH = 100;
const MAX_PROPS_BYTES = 1024; // props を JSON 文字列にしたときの上限（1KB）
const MAX_BODY_BYTES = 4096; // 本文全体の上限（大きな送信を読み込まないため）

const byteLength = (s: string) => new TextEncoder().encode(s).length;

function badRequest(error: string) {
  return NextResponse.json({ error }, { status: 400 });
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    const raw = await req.text();
    if (byteLength(raw) > MAX_BODY_BYTES) return badRequest("body too large");
    body = JSON.parse(raw);
  } catch {
    return badRequest("invalid json");
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return badRequest("invalid body");
  }

  const { deviceId, event, props } = body as Record<string, unknown>;

  if (typeof deviceId !== "string" || !deviceId || deviceId.length > MAX_DEVICE_ID_LENGTH) {
    return badRequest("invalid deviceId");
  }
  if (typeof event !== "string" || !ALLOWED_EVENTS.has(event)) {
    return badRequest("invalid event");
  }

  // props は省略可。渡すときは { feature: "chat" } のようなオブジェクトで、JSON にして1KB以下
  let propsValue: Record<string, unknown> | null = null;
  if (props !== undefined && props !== null) {
    if (typeof props !== "object" || Array.isArray(props)) {
      return badRequest("invalid props");
    }
    if (byteLength(JSON.stringify(props)) > MAX_PROPS_BYTES) {
      return badRequest("props too large");
    }
    propsValue = props as Record<string, unknown>;
  }

  try {
    // 既存APIと同じ no-store の共通クライアント（supabase-server.ts に経緯あり）
    const { error } = await createServerSupabase()
      .from("app_events")
      .insert({ device_id: deviceId, event, props: propsValue });
    if (error) {
      console.error("[event] insert failed:", event, error.message);
      return NextResponse.json({ error: "insert failed" }, { status: 500 });
    }
  } catch (e) {
    console.error("[event] insert threw:", event, e instanceof Error ? e.message : String(e));
    return NextResponse.json({ error: "insert failed" }, { status: 500 });
  }

  return new NextResponse(null, { status: 204 });
}
