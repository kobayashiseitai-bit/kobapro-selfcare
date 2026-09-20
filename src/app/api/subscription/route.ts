import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import {
  getSubscriptionState,
  getUserIdByDeviceId,
} from "../../lib/subscription";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "",
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
  );
}

/**
 * GET /api/subscription?deviceId=xxx
 * 現在のサブスク状態と利用回数を返却
 */
export async function GET(req: NextRequest) {
  try {
    const deviceId = req.nextUrl.searchParams.get("deviceId");
    if (!deviceId) {
      return NextResponse.json(
        { error: "deviceId required" },
        { status: 400 }
      );
    }

    const supabase = getSupabase();
    const userId = await getUserIdByDeviceId(supabase, deviceId);
    if (!userId) {
      return NextResponse.json({
        status: "free",
        isPaid: false,
        isTrial: false,
        isFamily: false,
        usage: { posture: 0, chat: 0, meal: 0 },
        // 未登録(=これから登録する新規)は無料枠なし。7日間の体験後は課金が必要
        limits: { posture: 0, chat: 0, meal: 0 },
      });
    }

    const state = await getSubscriptionState(supabase, userId);
    return NextResponse.json(state);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { error: "failed to load subscription", detail: msg },
      { status: 500 }
    );
  }
}

/**
 * POST /api/subscription
 * { action: 'cancel', deviceId }
 *
 * 課金状態を「有効にする」経路はここには無い。
 * 有料化は App Store / Google Play の購入 → RevenueCat Webhook
 * (/api/revenuecat/webhook, 共有シークレットで認証) のみが行う。
 *
 * かつてここに 'subscribe' と 'start_trial' があったが、deviceId さえ判れば
 * ブラウザから支払いなしで有料プランにできてしまうため 2026-09-20 に削除した。
 * 課金まわりを触ったときは、アプリだけでなくブラウザからも叩いて確認すること。
 */
export async function POST(req: NextRequest) {
  try {
    const { action, deviceId } = await req.json();
    if (!deviceId || !action) {
      return NextResponse.json(
        { error: "deviceId and action required" },
        { status: 400 }
      );
    }

    const supabase = getSupabase();
    const userId = await getUserIdByDeviceId(supabase, deviceId);
    if (!userId) {
      return NextResponse.json({ error: "user not found" }, { status: 404 });
    }

    const now = new Date();

    if (action === "subscribe" || action === "start_trial") {
      // ストアの購入を確認する手段がないため、ここでは決して有効化しない。
      // 正規の反映経路は RevenueCat Webhook。
      return NextResponse.json(
        {
          error:
            "ご購入はアプリからお願いします。ブラウザからはお申し込みいただけません。",
        },
        { status: 403 }
      );
    }

    if (action === "cancel") {
      await supabase
        .from("subscriptions")
        .update({
          status: "cancelled",
          updated_at: now.toISOString(),
        })
        .eq("user_id", userId);
      return NextResponse.json({ ok: true, status: "cancelled" });
    }

    return NextResponse.json({ error: "invalid action" }, { status: 400 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { error: "subscription update failed", detail: msg },
      { status: 500 }
    );
  }
}
