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
    // Product ID:
    //   zero_pain_monthly_1280 / zero_pain_yearly_12800     → 単身プラン
    //   zero_pain_family_1980 / zero_pain_family_19800      → 家族プラン
    // 家族プラン ID には monthly/yearly が含まれないので、価格部分で月額/年額を判別する
    const productId = event.product_id || "";
    const isFamily = productId.includes("family");
    let plan:
      | "monthly"
      | "yearly"
      | "family_monthly"
      | "family_yearly"
      | null = null;
    if (isFamily) {
      if (productId.endsWith("19800")) plan = "family_yearly";
      else if (productId.endsWith("1980")) plan = "family_monthly";
    } else if (productId.includes("monthly")) {
      plan = "monthly";
    } else if (productId.includes("yearly")) {
      plan = "yearly";
    }

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
        // 家族プランも課金周期ベースで active_monthly / active_yearly に正規化
        // 家族プラン購入かどうかは is_family カラムで別管理
        status =
          plan === "yearly" || plan === "family_yearly"
            ? "active_yearly"
            : "active_monthly";
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

    // 家族プラン購入時は is_family=true、解約/期限切れでも一度家族プランを買った人は維持
    // （Apple サブスクの仕様上、PRODUCT_CHANGE で単身⇄家族の切替も起こりうる）
    const isFamilyPlan = isFamily;

    // upsert
    const upsertData: Record<string, unknown> = {
      user_id: userId,
      status,
      plan,
      current_period_start: periodStart,
      current_period_end: periodEnd,
      revenuecat_app_user_id: deviceId,
      revenuecat_entitlement: event.entitlement_ids?.[0] || "premium",
      updated_at: new Date().toISOString(),
    };
    // INITIAL_PURCHASE / PRODUCT_CHANGE 時のみ is_family を更新
    // RENEWAL や CANCELLATION では plan の情報が薄いことがあるので変更しない
    if (
      event.type === "INITIAL_PURCHASE" ||
      event.type === "PRODUCT_CHANGE" ||
      event.type === "UNCANCELLATION"
    ) {
      upsertData.is_family = isFamilyPlan;
    }

    const { error: upsertError } = await supabase
      .from("subscriptions")
      .upsert(upsertData, { onConflict: "user_id" });

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
