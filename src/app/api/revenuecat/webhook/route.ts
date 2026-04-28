import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * RevenueCat Webhook 受信エンドポイント
 *
 * RevenueCat ダッシュボード → Project Settings → Integrations → Webhooks
 * URL: https://posture-app-steel.vercel.app/api/revenuecat/webhook
 *
 * Authorization Header に共有シークレットを設定しておき、
 * 環境変数 REVENUECAT_WEBHOOK_SECRET と照合する。
 *
 * イベント種別:
 *   INITIAL_PURCHASE / RENEWAL / NON_RENEWING_PURCHASE
 *     → status を active_monthly / active_yearly に
 *   CANCELLATION / EXPIRATION
 *     → status を cancelled / expired に
 *   PRODUCT_CHANGE → プラン変更
 */

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "",
    process.env.SUPABASE_SERVICE_ROLE_KEY || ""
  );
}

interface RevenueCatEvent {
  type: string;
  app_user_id: string;
  product_id?: string;
  expiration_at_ms?: number;
  purchased_at_ms?: number;
  entitlement_ids?: string[];
}

export async function POST(req: NextRequest) {
  // 認証チェック
  const authHeader = req.headers.get("authorization") || "";
  const secret = process.env.REVENUECAT_WEBHOOK_SECRET;
  if (!secret || authHeader !== `Bearer ${secret}`) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const event: RevenueCatEvent = body.event || body;
    if (!event?.type || !event?.app_user_id) {
      return Response.json({ error: "invalid event" }, { status: 400 });
    }

    const supabase = getSupabase();
    const deviceId = event.app_user_id;

    // deviceId からユーザーを特定
    const { data: users } = await supabase
      .from("users")
      .select("id")
      .eq("device_id", deviceId)
      .limit(1);
    if (!users || users.length === 0) {
      console.warn(`[revenuecat/webhook] user not found for ${deviceId}`);
      return Response.json({ ok: true, ignored: true });
    }
    const userId = users[0].id;

    // プラン判定
    const productId = event.product_id || "";
    let plan: "monthly" | "yearly" | null = null;
    if (productId.includes("monthly")) plan = "monthly";
    else if (productId.includes("yearly")) plan = "yearly";

    // ステータス決定
    type Status =
      | "free"
      | "trial"
      | "active_monthly"
      | "active_yearly"
      | "cancelled"
      | "expired";
    let status: Status = "free";
    switch (event.type) {
      case "INITIAL_PURCHASE":
      case "RENEWAL":
      case "PRODUCT_CHANGE":
      case "UNCANCELLATION":
        status = plan === "yearly" ? "active_yearly" : "active_monthly";
        break;
      case "CANCELLATION":
        status = "cancelled";
        break;
      case "EXPIRATION":
        status = "expired";
        break;
      case "BILLING_ISSUE":
        // 課金エラーは状態を維持（Apple側でリトライされる）
        return Response.json({ ok: true, note: "billing_issue logged" });
      default:
        // SUBSCRIBER_ALIAS など、その他のイベントは無視
        return Response.json({ ok: true, ignored: event.type });
    }

    const periodEnd = event.expiration_at_ms
      ? new Date(event.expiration_at_ms).toISOString()
      : null;
    const periodStart = event.purchased_at_ms
      ? new Date(event.purchased_at_ms).toISOString()
      : null;

    // upsert
    const { error: upsertError } = await supabase
      .from("subscriptions")
      .upsert({
        user_id: userId,
        status,
        plan,
        current_period_start: periodStart,
        current_period_end: periodEnd,
        revenuecat_app_user_id: deviceId,
        revenuecat_entitlement: event.entitlement_ids?.[0] || "premium",
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id" });

    if (upsertError) {
      console.error("[revenuecat/webhook] upsert failed:", upsertError);
      return Response.json({ error: "db error" }, { status: 500 });
    }

    return Response.json({ ok: true, status, plan });
  } catch (e) {
    console.error("[revenuecat/webhook] error:", e);
    return Response.json({ error: "server error" }, { status: 500 });
  }
}
