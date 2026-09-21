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

/*
 * POST は置いていない。
 *
 * かつて subscribe / start_trial / cancel を受けていたが、
 * deviceId さえ判れば誰でも叩けるうえ、実態と合っていなかった。
 *   - subscribe / start_trial … ストアの購入を確認せずに有料化できてしまった（2026-09-20 削除）
 *   - cancel … このDBだけ「解約済み」にしても、ストアの請求は止まらない（2026-09-21 削除）
 *
 * 課金状態を動かすのは RevenueCat Webhook（/api/revenuecat/webhook・
 * 共有シークレットで認証）だけ。解約は App Store / Google Play の管理画面で行う。
 *
 * Capacitor の server.url で全端末がこの本番Webを読み込むため、
 * 古いアプリがここを叩くことはない。
 */
