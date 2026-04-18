import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import {
  getSubscriptionState,
  getUserIdByDeviceId,
  TRIAL_DAYS,
} from "../../lib/subscription";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
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
        usage: { posture: 0, chat: 0, meal: 0 },
        limits: { posture: 3, chat: 5, meal: 3 },
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
 * { action: 'start_trial' | 'subscribe' | 'cancel' | 'restore', deviceId, plan? }
 *
 * 注: 実際の決済はRevenueCat/Apple IAPが担う。
 * このAPIはSupabase上のサブスク状態を更新する薄いラッパー。
 * 本番ではRevenueCat Webhookがこの値を更新する想定。
 */
export async function POST(req: NextRequest) {
  try {
    const { action, deviceId, plan } = await req.json();
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

    if (action === "start_trial") {
      // 過去にtrial利用済みチェック
      const { data: existing } = await supabase
        .from("subscriptions")
        .select("trial_started_at")
        .eq("user_id", userId)
        .maybeSingle();

      if (existing?.trial_started_at) {
        return NextResponse.json(
          { error: "無料トライアルは既に利用済みです" },
          { status: 400 }
        );
      }

      const trialEnds = new Date(now.getTime() + TRIAL_DAYS * 24 * 60 * 60 * 1000);
      await supabase
        .from("subscriptions")
        .update({
          status: "trial",
          trial_started_at: now.toISOString(),
          trial_ends_at: trialEnds.toISOString(),
          updated_at: now.toISOString(),
        })
        .eq("user_id", userId);

      return NextResponse.json({ ok: true, status: "trial" });
    }

    if (action === "subscribe") {
      if (plan !== "monthly" && plan !== "yearly") {
        return NextResponse.json(
          { error: "invalid plan" },
          { status: 400 }
        );
      }

      const periodEnd =
        plan === "monthly"
          ? new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
          : new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);

      await supabase
        .from("subscriptions")
        .update({
          status: plan === "monthly" ? "active_monthly" : "active_yearly",
          plan,
          current_period_start: now.toISOString(),
          current_period_end: periodEnd.toISOString(),
          updated_at: now.toISOString(),
        })
        .eq("user_id", userId);

      return NextResponse.json({ ok: true, status: `active_${plan}` });
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
