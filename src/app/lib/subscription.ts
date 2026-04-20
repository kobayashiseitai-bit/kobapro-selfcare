/**
 * ZERO-PAIN サブスクリプション共通ロジック
 * サーバー側(API)で使用する制限チェック関数を提供
 */

import { SupabaseClient } from "@supabase/supabase-js";

// ========== プラン・機能制限の設定 ==========

export const FREE_LIMITS = {
  posture: 3, // 月3回まで
  chat: 5, // 月5回まで
  meal: 3, // 月3回まで
} as const;

export const PLAN_PRICES = {
  monthly: {
    id: "zero_pain_monthly_1280",
    price: 1280,
    label: "月額プラン",
  },
  yearly: {
    id: "zero_pain_yearly_12800",
    price: 12800,
    monthlyEquivalent: 1067, // 12800 ÷ 12
    label: "年額プラン",
    discountLabel: "2ヶ月分お得",
    discountPercent: 17,
  },
} as const;

export const TRIAL_DAYS = 7;

// ========== 型定義 ==========

export type SubscriptionStatus =
  | "free"
  | "trial"
  | "active_monthly"
  | "active_yearly"
  | "cancelled"
  | "expired";

export interface SubscriptionRecord {
  status: SubscriptionStatus;
  plan: string | null;
  trial_ends_at: string | null;
  current_period_end: string | null;
}

export interface SubscriptionState {
  status: SubscriptionStatus;
  isPaid: boolean; // 有料(trial含む)プランが有効か
  isTrial: boolean;
  trialEndsAt: string | null;
  currentPeriodEnd: string | null;
  usage: {
    posture: number;
    chat: number;
    meal: number;
  };
  limits: {
    posture: number | "unlimited";
    chat: number | "unlimited";
    meal: number | "unlimited";
  };
}

// ========== ユーティリティ ==========

export function getCurrentPeriodMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function isPaidStatus(status: SubscriptionStatus): boolean {
  // trial / active_monthly / active_yearly / cancelled(期限内) は有料扱い
  return (
    status === "trial" ||
    status === "active_monthly" ||
    status === "active_yearly" ||
    status === "cancelled"
  );
}

// ========== 家族プラン判定: 家族のオーナーがプレミアムなら全員プレミアム ==========

async function isFamilyPremium(
  supabase: SupabaseClient,
  userId: string
): Promise<boolean> {
  // 自分が所属する家族を探す
  const { data: membership } = await supabase
    .from("family_members")
    .select("family_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (!membership) return false;

  // その家族のオーナーIDを取得
  const { data: family } = await supabase
    .from("families")
    .select("owner_user_id")
    .eq("id", membership.family_id)
    .maybeSingle();

  if (!family || family.owner_user_id === userId) {
    // 自分がオーナーなら自分のサブスクをチェック（無限ループ防止）
    return false;
  }

  // オーナーのサブスクを取得
  const { data: ownerSub } = await supabase
    .from("subscriptions")
    .select("status, trial_ends_at, current_period_end")
    .eq("user_id", family.owner_user_id)
    .maybeSingle();

  if (!ownerSub) return false;

  let ownerStatus = ownerSub.status as SubscriptionStatus;
  const now = new Date();

  // trial期限チェック
  if (ownerStatus === "trial" && ownerSub.trial_ends_at) {
    if (new Date(ownerSub.trial_ends_at) < now) ownerStatus = "expired";
  }
  // cancelled期限チェック
  if (ownerStatus === "cancelled" && ownerSub.current_period_end) {
    if (new Date(ownerSub.current_period_end) < now) ownerStatus = "expired";
  }

  return isPaidStatus(ownerStatus);
}

// ========== サーバー側: サブスク情報取得 ==========

export async function getSubscriptionState(
  supabase: SupabaseClient,
  userId: string
): Promise<SubscriptionState> {
  // 1. subscriptions テーブルから取得（なければ作る）
  let { data: sub } = await supabase
    .from("subscriptions")
    .select("status, plan, trial_ends_at, current_period_end")
    .eq("user_id", userId)
    .maybeSingle();

  if (!sub) {
    await supabase
      .from("subscriptions")
      .insert({ user_id: userId, status: "free" });
    sub = {
      status: "free",
      plan: null,
      trial_ends_at: null,
      current_period_end: null,
    };
  }

  let status = sub.status as SubscriptionStatus;

  // 2. trial / cancelled の期限切れチェック
  const now = new Date();
  if (status === "trial" && sub.trial_ends_at) {
    if (new Date(sub.trial_ends_at) < now) {
      status = "expired";
      await supabase
        .from("subscriptions")
        .update({ status: "expired" })
        .eq("user_id", userId);
    }
  }
  if (status === "cancelled" && sub.current_period_end) {
    if (new Date(sub.current_period_end) < now) {
      status = "expired";
      await supabase
        .from("subscriptions")
        .update({ status: "expired" })
        .eq("user_id", userId);
    }
  }

  // 個人サブスクが無料/期限切れなら、家族オーナーがプレミアムかチェック
  let isPaid = isPaidStatus(status);
  if (!isPaid) {
    const familyPremium = await isFamilyPremium(supabase, userId);
    if (familyPremium) {
      isPaid = true;
    }
  }

  // 3. 今月の利用回数取得
  const period = getCurrentPeriodMonth();
  const { data: counters } = await supabase
    .from("usage_counters")
    .select("feature, count")
    .eq("user_id", userId)
    .eq("period_month", period);

  const usage = { posture: 0, chat: 0, meal: 0 };
  (counters || []).forEach((c: { feature: string; count: number }) => {
    if (c.feature in usage) {
      usage[c.feature as keyof typeof usage] = c.count;
    }
  });

  return {
    status,
    isPaid,
    isTrial: status === "trial",
    trialEndsAt: sub.trial_ends_at,
    currentPeriodEnd: sub.current_period_end,
    usage,
    limits: isPaid
      ? { posture: "unlimited", chat: "unlimited", meal: "unlimited" }
      : {
          posture: FREE_LIMITS.posture,
          chat: FREE_LIMITS.chat,
          meal: FREE_LIMITS.meal,
        },
  };
}

// ========== サーバー側: 利用制限チェック ==========

export interface LimitCheckResult {
  allowed: boolean;
  reason?: "limit_reached";
  usage: number;
  limit: number | "unlimited";
  isPaid: boolean;
}

export async function checkAndIncrementUsage(
  supabase: SupabaseClient,
  userId: string,
  feature: "posture" | "chat" | "meal"
): Promise<LimitCheckResult> {
  const state = await getSubscriptionState(supabase, userId);
  const limit = state.limits[feature];
  const currentUsage = state.usage[feature];

  // 有料プランは無制限
  if (limit === "unlimited") {
    await incrementCounter(supabase, userId, feature);
    return {
      allowed: true,
      usage: currentUsage + 1,
      limit: "unlimited",
      isPaid: true,
    };
  }

  // 無料プランの制限チェック
  if (currentUsage >= limit) {
    return {
      allowed: false,
      reason: "limit_reached",
      usage: currentUsage,
      limit,
      isPaid: false,
    };
  }

  await incrementCounter(supabase, userId, feature);
  return {
    allowed: true,
    usage: currentUsage + 1,
    limit,
    isPaid: false,
  };
}

async function incrementCounter(
  supabase: SupabaseClient,
  userId: string,
  feature: "posture" | "chat" | "meal"
): Promise<void> {
  const period = getCurrentPeriodMonth();

  // upsert: 行があればcount+1、なければ新規作成
  const { data: existing } = await supabase
    .from("usage_counters")
    .select("id, count")
    .eq("user_id", userId)
    .eq("feature", feature)
    .eq("period_month", period)
    .maybeSingle();

  if (existing) {
    await supabase
      .from("usage_counters")
      .update({
        count: existing.count + 1,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id);
  } else {
    await supabase.from("usage_counters").insert({
      user_id: userId,
      feature,
      period_month: period,
      count: 1,
    });
  }
}

// ========== ユーザー取得ヘルパ ==========

export async function getUserIdByDeviceId(
  supabase: SupabaseClient,
  deviceId: string
): Promise<string | null> {
  if (!deviceId) return null;
  const { data: users } = await supabase
    .from("users")
    .select("id")
    .eq("device_id", deviceId)
    .maybeSingle();
  return users?.id || null;
}
