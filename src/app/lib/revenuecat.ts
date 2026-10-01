import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * RevenueCat の商品ID → ZERO-PAIN のプランの対応（Webhook と購入直後の同期で共通）
 *
 * Product ID:
 *   zero_pain_monthly_1280 / zero_pain_yearly_12800     → 単身プラン
 *   zero_pain_family_1980 / zero_pain_family_19800      → 家族プラン
 * 家族プラン ID には monthly/yearly が含まれないので、価格部分で月額/年額を判別する。
 * Google Play の商品は「商品ID:ベースプランID」（例: zero_pain_family_1980:monthly）で届くため、
 * 「:」より前だけで判定する（そのままだと endsWith("1980") などが当たらない）。
 */
export type PaidPlan = "monthly" | "yearly" | "family_monthly" | "family_yearly";

export function planFromProductId(rawProductId: string): {
  plan: PaidPlan | null;
  isFamily: boolean;
} {
  const productId = (rawProductId || "").split(":")[0];
  const isFamily = productId.includes("family");
  let plan: PaidPlan | null = null;
  if (isFamily) {
    if (productId.endsWith("19800")) plan = "family_yearly";
    else if (productId.endsWith("1980")) plan = "family_monthly";
  } else if (productId.includes("monthly")) {
    plan = "monthly";
  } else if (productId.includes("yearly")) {
    plan = "yearly";
  }
  return { plan, isFamily };
}

/** 有料中の status（家族プランも課金周期で active_monthly / active_yearly に正規化） */
export function activeStatusFor(plan: PaidPlan | null): "active_monthly" | "active_yearly" {
  return plan === "yearly" || plan === "family_yearly" ? "active_yearly" : "active_monthly";
}

// ========== RevenueCat に「この人はいま有料か」を直接問い合わせる ==========
//
// 使う場所（2026-10-02）:
//   - /api/subscription/sync（購入・復元の直後。有料へ上げる向きだけ書く）
//   - /api/revenuecat/webhook の TRANSFER / PRODUCT_CHANGE / CANCELLATION / EXPIRATION
//     （「購入を復元」で購入が別の deviceId へ移ったとき、移し元を無料に戻す。プラン切替の反映。
//       遅れて届いた古い終わりの知らせで、買い直した人の有料の行を上書きしない）
//   - lib/subscription.ts の getSubscriptionState（active_* / trial のまま期限を過ぎた行を聞き直す歯止め）

export const ENTITLEMENT_ID = "premium"; // lib/iap.ts と同じ

// 公開キー（アプリに埋め込まれているもの）。RevenueCat の顧客情報の読み取りはこれで行える。
// 顧客情報はプロジェクト単位なので、どちらのキーでも iPhone・Android 両方の購入が返る。
const RC_IOS_KEY = process.env.NEXT_PUBLIC_REVENUECAT_IOS_KEY || "appl_uxudppFzNcOpKAVWjwRhcqhgBfQ";
const RC_ANDROID_KEY = process.env.NEXT_PUBLIC_REVENUECAT_ANDROID_KEY || "";

/** 有料中として書き込む内容（RevenueCat の今の状態から作る） */
export interface RevenueCatPaidState {
  status: "trial" | "active_monthly" | "active_yearly" | "cancelled";
  plan: PaidPlan | null;
  isFamily: boolean;
  periodStart: string | null;
  periodEnd: string | null;
}

export type RevenueCatLookup =
  /** 問い合わせに失敗した（通信・RevenueCat 側のエラー・時間切れ）。何も書かないこと */
  | { ok: false; httpStatus?: number }
  /** いま有料（entitlement "premium" が期限内） */
  | { ok: true; entitled: true; paid: RevenueCatPaidState }
  /** いま有料ではない */
  | { ok: true; entitled: false };

/**
 * GET https://api.revenuecat.com/v1/subscribers/{appUserId} で今の状態を読む。
 * 注意: RevenueCat は未知の ID を問い合わせると顧客を作ってしまう（201）。
 * 呼び出し元は、users に登録済みの deviceId（＝アプリが RevenueCat に渡している appUserID）だけを渡すこと。
 */
export async function fetchRevenueCatEntitlement(
  appUserId: string,
  opts: { platform?: "ios" | "android"; timeoutMs?: number } = {}
): Promise<RevenueCatLookup> {
  const useAndroid = opts.platform === "android" && !!RC_ANDROID_KEY;
  const key = useAndroid ? RC_ANDROID_KEY : RC_IOS_KEY;
  const xPlatform = useAndroid ? "android" : "ios";
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 8000);
  try {
    const res = await fetch(
      `https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(appUserId)}`,
      {
        headers: { Authorization: `Bearer ${key}`, "X-Platform": xPlatform },
        cache: "no-store",
        signal: controller.signal,
      }
    );
    if (!res.ok) {
      console.warn(`[revenuecat] GET subscriber ${res.status} for ${appUserId}`);
      return { ok: false, httpStatus: res.status };
    }
    const rc = await res.json();
    return parseSubscriber(rc?.subscriber ?? {});
  } catch (e) {
    console.warn(`[revenuecat] GET subscriber failed for ${appUserId}:`, e);
    return { ok: false };
  } finally {
    clearTimeout(timer);
  }
}

type RcEntitlement = {
  expires_date?: string | null;
  grace_period_expires_date?: string | null;
  product_identifier?: string;
  purchase_date?: string | null;
};
type RcSubscription = {
  period_type?: string;
  unsubscribe_detected_at?: string | null;
};

function parseSubscriber(subscriber: {
  entitlements?: Record<string, RcEntitlement>;
  subscriptions?: Record<string, RcSubscription>;
}): RevenueCatLookup {
  const ent = subscriber.entitlements?.[ENTITLEMENT_ID];
  if (!ent) return { ok: true, entitled: false };
  const now = Date.now();
  const expiresMs = ent.expires_date ? Date.parse(ent.expires_date) : null;
  // ストアの「猶予期間」（支払いに失敗しても使える期間）中は grace_period_expires_date のほうが後ろ
  const graceMs = ent.grace_period_expires_date ? Date.parse(ent.grace_period_expires_date) : NaN;
  const endMs =
    expiresMs === null
      ? null // 期限の無い権利（買い切りなど）
      : Number.isFinite(graceMs)
        ? Math.max(expiresMs, graceMs)
        : expiresMs;
  if (endMs !== null && !(endMs > now)) return { ok: true, entitled: false };

  const productRaw = ent.product_identifier || "";
  // subscriptions のキーは iOS なら商品ID、Android なら「商品ID:ベースプランID」のことがある
  const subs = subscriber.subscriptions ?? {};
  const subKey = Object.keys(subs).find(
    (k) => k === productRaw || k.split(":")[0] === productRaw.split(":")[0]
  );
  const sub = subKey ? subs[subKey] : undefined;
  const { plan, isFamily } = planFromProductId(productRaw);

  // 自動更新を止めた人は cancelled（期限までは有料のまま。lib/subscription.ts の isPaidStatus）。
  // ストアの無料体験中は trial（料金プラン画面に解約の締め切りを出すため。Webhook と同じ扱い）。
  const status: RevenueCatPaidState["status"] = sub?.unsubscribe_detected_at
    ? "cancelled"
    : sub?.period_type === "trial"
      ? "trial"
      : activeStatusFor(plan);

  const startMs = ent.purchase_date ? Date.parse(ent.purchase_date) : NaN;
  return {
    ok: true,
    entitled: true,
    paid: {
      status,
      plan,
      isFamily,
      periodStart: Number.isFinite(startMs) ? new Date(startMs).toISOString() : null,
      periodEnd: endMs !== null ? new Date(endMs).toISOString() : null,
    },
  };
}

/** 有料扱いの status（lib/subscription.ts の isPaidStatus と同じ並び） */
const PAID_STATUSES = ["trial", "active_monthly", "active_yearly", "cancelled"];

/**
 * RevenueCat の今の状態を subscriptions に書く。
 * - 有料なら、status / plan / is_family / 期限をそのまま書く（行が無ければ作る）
 * - 有料でないときは、downgrade: true のときだけ、有料扱いの行を expired にする
 *   （購入・復元の直後の同期は上げる向きだけ。移し元の端末・期限切れの聞き直しは下げる向きも書く）
 *   expectedPeriodEnd を渡すと、その期限のままの行だけを書き換える
 *   （読んだあとに Webhook で更新された行を、古い判断で expired にしないため）
 * 返り値の status は書き込んだ値（何も書かなかったときは null）。
 */
export async function applyRevenueCatLookup(
  supabase: SupabaseClient,
  userId: string,
  appUserId: string,
  lookup: Extract<RevenueCatLookup, { ok: true }>,
  opts: { downgrade: boolean; expectedPeriodEnd?: string | null }
): Promise<{ error: string | null; status: string | null }> {
  if (lookup.entitled) {
    const p = lookup.paid;
    const upsertData: Record<string, unknown> = {
      user_id: userId,
      status: p.status,
      current_period_start: p.periodStart,
      current_period_end: p.periodEnd,
      revenuecat_app_user_id: appUserId,
      revenuecat_entitlement: ENTITLEMENT_ID,
      updated_at: new Date().toISOString(),
    };
    // 商品IDがこちらの知らないものだったときは、今のプラン・家族の別を消さない
    if (p.plan) {
      upsertData.plan = p.plan;
      upsertData.is_family = p.isFamily;
    }
    if (p.status === "trial") {
      upsertData.trial_ends_at = p.periodEnd;
      upsertData.trial_started_at = p.periodStart;
    }
    const { error } = await supabase
      .from("subscriptions")
      .upsert(upsertData, { onConflict: "user_id" });
    if (error) return { error: error.message, status: null };
    return { error: null, status: p.status };
  }

  if (!opts.downgrade) return { error: null, status: null };

  let q = supabase
    .from("subscriptions")
    .update({ status: "expired", updated_at: new Date().toISOString() })
    .eq("user_id", userId)
    .in("status", PAID_STATUSES);
  if (opts.expectedPeriodEnd !== undefined) {
    q =
      opts.expectedPeriodEnd === null
        ? q.is("current_period_end", null)
        : q.eq("current_period_end", opts.expectedPeriodEnd);
  }
  const { data, error } = await q.select("id");
  if (error) return { error: error.message, status: null };
  return { error: null, status: data && data.length > 0 ? "expired" : null };
}
