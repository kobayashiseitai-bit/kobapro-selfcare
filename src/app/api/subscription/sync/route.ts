import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "../../../lib/supabase-server";
import { getSubscriptionState } from "../../../lib/subscription";
import { applyRevenueCatLookup, fetchRevenueCatEntitlement } from "../../../lib/revenuecat";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * POST /api/subscription/sync  { deviceId, platform?: "ios" | "android" }
 *
 * 購入・復元の直後に画面から呼ぶ。RevenueCat に「この人はいま有料か」を直接問い合わせ、
 * 有料なら subscriptions を書き換えてから、最新の状態（GET /api/subscription と同じ形）を返す。
 *
 * なぜ要るか（2026-10-01）: 購入の記録は RevenueCat の Webhook で届くが、購入の直後に画面が
 * 状態を読むとまだ届いておらず「無料プラン」のまま案内カードが出る。払ったのに使えない、を防ぐ。
 *
 * - RevenueCat の判定そのものを読むので、ここから有料を偽ることはできない
 *   （他人の deviceId を送っても、その人の本当の状態が反映されるだけ）。
 * - 有料へ上げる方向だけ書く。無料へ下げるのは Webhook（EXPIRATION / TRANSFER など）に任せる
 *   （RevenueCat への問い合わせが一時的に失敗したときに、有料の人を締め出さないため）。
 * - 「購入を復元」で購入が別の deviceId から移ってきたとき、移し元の deviceId を無料に戻すのは
 *   Webhook の TRANSFER（2026-10-02〜）。ここでは移し先（この端末）を有料にするだけ。
 * - users に無い deviceId は 404。RevenueCat は未知の ID を問い合わせると顧客を作ってしまうため、
 *   登録済みの人だけを問い合わせる。
 * - RevenueCat への問い合わせと書き込みは lib/revenuecat.ts（Webhook・期限切れの聞き直しと共通）。
 */
export async function POST(req: NextRequest) {
  let body: { deviceId?: unknown; platform?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const deviceId = typeof body.deviceId === "string" ? body.deviceId.trim() : "";
  if (!deviceId || deviceId.length > 200) {
    return NextResponse.json({ error: "deviceId required" }, { status: 400 });
  }
  const platform = body.platform === "android" ? "android" : "ios";

  try {
    const supabase = createServerSupabase();
    const { data: users, error: userErr } = await supabase
      .from("users")
      .select("id")
      .eq("device_id", deviceId)
      .limit(1);
    if (userErr) {
      return NextResponse.json({ error: "failed to load user" }, { status: 500 });
    }
    const userId = users?.[0]?.id as string | undefined;
    if (!userId) {
      return NextResponse.json({ error: "user not found" }, { status: 404 });
    }

    const lookup = await fetchRevenueCatEntitlement(deviceId, { platform });
    if (!lookup.ok) {
      // 問い合わせに失敗しても、今の状態はそのまま返す（Webhook が届けば反映される）
      const state = await getSubscriptionState(supabase, userId);
      return NextResponse.json({ ...state, synced: false });
    }

    // 有料へ上げる向きだけ書く（downgrade: false）
    const applied = await applyRevenueCatLookup(supabase, userId, deviceId, lookup, {
      downgrade: false,
    });
    if (applied.error) {
      console.error("[subscription/sync] upsert failed:", applied.error);
      return NextResponse.json({ error: "db error" }, { status: 500 });
    }

    const state = await getSubscriptionState(supabase, userId);
    return NextResponse.json({ ...state, synced: true, entitled: lookup.entitled });
  } catch (e) {
    console.error("[subscription/sync] error:", e);
    return NextResponse.json({ error: "sync failed" }, { status: 500 });
  }
}
