/**
 * ZERO-PAIN サブスクリプション共通ロジック
 * サーバー側(API)で使用する制限チェック関数を提供
 */

import { SupabaseClient } from "@supabase/supabase-js";
import { applyRevenueCatLookup, fetchRevenueCatEntitlement } from "./revenuecat";

// ========== プラン・機能制限の設定 ==========

/**
 * 2026-09-13 より前に登録した既存ユーザー向けの無料枠。
 * 仕様変更前から使ってくれている方をいきなり締め出さないため残していたが、
 * 2026-10-31 で終了する（社長決定 2026-10-02。LEGACY_FREE_TIER_END）。
 * 11月1日からは新規の方と同じ扱い（申し込めば7日間無料→自動で有料）。
 */
export const LEGACY_FREE_LIMITS = {
  posture: 3, // 月3回まで
  chat: 5, // 月5回まで
  meal: 3, // 月3回まで
} as const;

/**
 * 新規ユーザー（2026-09-13 以降の登録）の無料枠。すべて 0回。
 * 姿勢チェック・チャット・食事分析は有料プランの機能で、お試しはストアの「7日間無料→自動で有料」に一本化する
 * （社長決定 2026-10-02。10-01 に姿勢チェックを月1回無料にしたが取りやめた）。
 * 申し込み前に無料で使えるのは体調チェック（/api/checkin。先生のひとことは AI・1日の上限あり）だけ。
 * ※ 履歴・過去の写真・ストレッチなど「本人のデータと静的コンテンツ」は
 *    引き続き閲覧できる（AI を呼ぶ機能だけを止める）。
 */
export const FREE_LIMITS = {
  posture: 0,
  chat: 0,
  meal: 0,
} as const;

/**
 * この日時より前に登録したユーザーは LEGACY_FREE_LIMITS を適用する。
 * 変更してはいけない: 後ろにずらすと既存ユーザーが突然使えなくなる。
 */
export const LEGACY_FREE_TIER_CUTOFF = new Date("2026-09-13T00:00:00Z");

/**
 * 既存ユーザーの無料枠（LEGACY_FREE_LIMITS）が終わる日時。日本時間 2026-11-01 0:00（＝10月31日いっぱいまで）。
 * これ以降は isLegacyUser が false になり、新規の方と同じ扱いになる
 * （無料枠0・30日コーチングとレポートの AI は有料のみ・体調チェックは新規と同じ1日の上限）。
 * 対象の方にはアプリのホームと料金プラン画面でお知らせする（LegacyFreeEndingNotice）。
 */
export const LEGACY_FREE_TIER_END = new Date("2026-10-31T15:00:00Z");
/** お知らせ・案内文で使う「無料分の最終日」 */
export const LEGACY_FREE_LAST_DAY_LABEL = "10月31日";

/**
 * App Store / Google Play の審査担当者用アカウント。
 *
 * 2026-09-13 に AI 機能を全面課金化したため、審査担当がアプリを開いても
 * 中身を確認できず、そのまま提出すると却下される。審査用に用意した
 * ユーザーだけ、課金なしで全機能を開放する。
 *
 * - 値は環境変数 REVIEWER_USER_IDS にカンマ区切りで入れる（users.id）。
 * - サーバー側でのみ判定する。クライアントから偽装できないようにするため、
 *   NEXT_PUBLIC_ は付けない。
 * - 審査が終わったら環境変数から外すこと。
 */
function getReviewerUserIds(): string[] {
  const raw = process.env.REVIEWER_USER_IDS || "";
  return raw
    .split(",")
    .map((v) => v.trim())
    .filter((v) => v.length > 0);
}

export function isReviewerUser(userId: string): boolean {
  if (!userId) return false;
  return getReviewerUserIds().includes(userId);
}

export const PLAN_PRICES = {
  monthly: {
    id: "zero_pain_monthly_1280",
    price: 880,
    label: "月額プラン",
  },
  yearly: {
    id: "zero_pain_yearly_12800",
    price: 8800,
    monthlyEquivalent: 733, // 8800 ÷ 12
    label: "年額プラン",
    discountLabel: "2ヶ月分お得",
    discountPercent: 17,
  },
  family_monthly: {
    id: "zero_pain_family_1980",
    price: 1380,
    label: "家族月額プラン",
    descLabel: "1契約で家族4人まで",
  },
  family_yearly: {
    id: "zero_pain_family_19800",
    price: 13800,
    monthlyEquivalent: 1150, // 13800 ÷ 12
    label: "家族年額プラン",
    descLabel: "1契約で家族4人まで",
    discountLabel: "2ヶ月分お得",
    discountPercent: 17,
  },
} as const;

export const TRIAL_DAYS = 7; // 2026-09-20: 3→7日。姿勢チェックは月1回の機能で、3日では価値が伝わらないため

/**
 * ストアの無料体験（status='trial'）が終わってから、期限切れの判定をするまでの猶予。
 * 無料体験のあとの課金（RENEWAL の Webhook）が少し遅れて届いても、払っている人を締め出さないため。
 * 猶予を過ぎても trial のままの行は、RevenueCat が知っている行なら expired にする前に聞き直す（2026-10-02。
 * resolveCurrentSubscription の b. を参照）。
 */
const TRIAL_EXPIRY_GRACE_MS = 6 * 60 * 60 * 1000;

/**
 * active_monthly / active_yearly の行が current_period_end を過ぎても更新の知らせ（RENEWAL の Webhook）が
 * 来ないとき、RevenueCat に今の状態を聞き直すまでの猶予（2026-10-02）。
 * 以前は active_* の期限を一度も見ていなかったため、知らせを取りこぼした行
 * （「購入を復元」で購入が別の deviceId へ移った移し元など）がずっと有料のままだった。
 * 聞き直して有料なら期限を書き直し（ストアの猶予期間中もここに入る）、有料でなければ expired にする。
 * RevenueCat が知らない行（revenuecat_app_user_id が無い）は、聞き直さずにこの猶予のあと expired にする
 * （resolveCurrentSubscription の a. を参照）。
 */
const ACTIVE_RECHECK_AFTER_MS = 24 * 60 * 60 * 1000;
/** 同じ人を聞き直す間隔（このサーバーの中で。RevenueCat が応答しないときに毎回待たせない） */
const ACTIVE_RECHECK_INTERVAL_MS = 10 * 60 * 1000;
/** 聞き直しの待ち時間の上限（画面の読み込みを長く止めない） */
const ACTIVE_RECHECK_TIMEOUT_MS = 4000;
const lastActiveRecheckAt = new Map<string, number>();

// ========== 上限に当たったときの案内文（画面とAPIで共通） ==========

/**
 * 案内文の対象。compare（Before/After比較）は chat の回数を使う。
 * coaching（30日コーチング）は有料プランだけの機能で、無料枠は無い（limit は常に 0 で呼ぶ）。
 */
export type LimitGuideFeature = "posture" | "chat" | "meal" | "compare" | "coaching";

const LIMIT_GUIDE_LABELS: Record<LimitGuideFeature, { use: string; quota: string }> = {
  chat: { use: "先生への相談", quota: "先生への相談" },
  compare: { use: "Before/After の比較分析", quota: "先生への相談（Before/After の比較分析も含む）" },
  meal: { use: "食事の写真分析", quota: "食事の写真分析" },
  posture: { use: "姿勢チェックの記録", quota: "姿勢チェック" },
  coaching: { use: "30日コーチング", quota: "30日コーチング" },
};

/**
 * 上限に当たったときの案内文。画面の案内カード（page.tsx の PlanGuideCard）と
 * API が返す message で同じ文を使い、食い違わないようにする。
 * - limit が 0（2026-09-13 以降の新規）: 最初から有料プランの機能だと伝える。「月0回まで」とは書かない
 * - limit が 1 以上（旧ユーザーなど）: 今月の無料分を使い切ったと伝える
 * 回数が戻るのは日本時間の毎月1日9時（月の区切りをサーバーのUTCで数えているため）。
 * 「1日に」とは書かず「来月になると」と書く。
 * 「無料」と書くときは必ず「はじめての方は」の条件を付ける（ストアのお試しは初回だけ）。
 */
/** 日本時間で次の月の1日0時（UTCのミリ秒）。利用回数がリセットされる時刻 */
function nextMonthStartJst(now: number = Date.now()): number {
  const jst = new Date(now + 9 * 60 * 60 * 1000);
  return Date.UTC(jst.getUTCFullYear(), jst.getUTCMonth() + 1, 1) - 9 * 60 * 60 * 1000;
}

export function buildLimitReachedMessage(
  feature: LimitGuideFeature,
  limit: number
): string {
  const label = LIMIT_GUIDE_LABELS[feature];
  const trial = `はじめての方は${TRIAL_DAYS}日間無料体験つき`;
  if (limit <= 0) {
    return `${label.use}は有料プランでご利用いただけます（${trial}）。`;
  }
  // 無料枠が残っているのは既存ユーザーだけ。その枠は LEGACY_FREE_TIER_END で終わるので、
  // 次の月が終了後なら「来月になるとまた使えます」とは書かない
  if (nextMonthStartJst() >= LEGACY_FREE_TIER_END.getTime()) {
    return `${label.quota}の今月の無料分（${limit}回）を使い切りました。以前からご利用の方の無料分は${LEGACY_FREE_LAST_DAY_LABEL}で終わります。続けて使う場合は、料金プランをご覧ください（${trial}）。`;
  }
  return `${label.quota}の今月の無料分（${limit}回）を使い切りました。来月になるとまた使えます。続けて使う場合は、料金プランをご覧ください（${trial}）。`;
}

/**
 * 先生への相談を使えない人（新規で上限0回・今月分を使い切った人）に出す、決まった文のあいさつ。
 * AIにあいさつを作らせると、その先に進めないのに費用だけかかるため、固定文にしている。
 * 画面（page.tsx のチャット）と /api/chat（あいさつの依頼が来たとき）で同じ文を使う。
 */
export const CHAT_LOCKED_GREETING =
  "こんにちは！ここでは、肩や首のこり・腰のつらさ・姿勢のことなどを、ふだんの言葉で先生に相談できます。";

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
  is_family?: boolean | null;
  /** Webhook / 購入直後の同期が書く（＝RevenueCat が知っている人）。手作業で入れた行には無い */
  revenuecat_app_user_id?: string | null;
}

/** subscriptions から読む列（getSubscriptionState と家族の判定で共通） */
const SUBSCRIPTION_COLUMNS =
  "status, plan, trial_ends_at, current_period_end, is_family, revenuecat_app_user_id";

export interface SubscriptionState {
  status: SubscriptionStatus;
  isPaid: boolean; // 有料(trial含む)プランが有効か
  isTrial: boolean;
  isFamily: boolean; // 家族プラン購入者かどうか（家族グループ作成の可否判定に使用）
  /** 仕様変更(2026-09-13)より前からの利用者か。無料枠の有無がこれで変わる */
  isLegacyUser: boolean;
  /** 既存ユーザーの無料枠が終わる日時（無料枠が有効な未課金の既存ユーザーだけ。それ以外は null / 無し） */
  legacyFreeEndsAt?: string | null;
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

/**
 * その行の契約が家族プランか（2026-10-02）。
 * plan は課金が始まる・続く・戻るたびに（Webhook の INITIAL_PURCHASE / RENEWAL / UNCANCELLATION、購入直後の同期）
 * そのときの商品から書き直されるので plan を優先し、plan が無い古い行だけ is_family を見る。
 * 以前は is_family だけを見ていたが、is_family は切替のあとの RENEWAL で書き直されていなかったため、
 * 家族→単身に下げた人が家族プランのまま扱われていた。
 */
export function isFamilyPlanRow(row: { plan?: string | null; is_family?: boolean | null }): boolean {
  if (row.plan) return row.plan.startsWith("family_");
  return !!row.is_family;
}

// ========== 期限切れの判定（本人と家族のオーナーで共通） ==========

/**
 * active_* / trial のまま期限を過ぎた行を RevenueCat に聞き直す
 * （ACTIVE_RECHECK_AFTER_MS・TRIAL_EXPIRY_GRACE_MS の説明を参照）。返り値は「今」の行。
 * - 聞き直せた: 有料なら有料のまま（RevenueCat の今の期限で書き直す）。有料でなければ expired
 *   （読んだときの期限のままの行だけを書き換える）
 * - 聞き直さなかった（同じ人を少し前に聞き直した・別の読み込みが聞き直している最中）・
 *   聞き直せなかった（時間切れ・RevenueCat の 5xx / 429 など）: 何も書かず、今の行のまま（有料）を返す。
 *   2026-10-02 まで: このときに期限から30日を過ぎていれば expired にしていた。30日は「聞き直せなくなってから」ではなく
 *   行の期限から数えていたので、RENEWAL の Webhook を取りこぼして期限から30日を過ぎた年額の人などは、
 *   同時に来たもう1本の読み込みが聞き直しを飛ばしただけ・RevenueCat が1回時間切れになっただけで expired になっていた。
 *   expired の行はここでは聞き直さないので、次の RENEWAL（年額なら1年後）か「購入を復元」まで
 *   無料扱いのままだった（家族プランのオーナーなら家族全員も）。
 *   聞き直せない状態が続いても有料のまま扱う（払っている人を締め出すより害が小さい）。
 *   本当に終わった契約は、EXPIRATION の Webhook か、次に聞き直せたときに expired になる。
 * 呼び出し元は revenuecat_app_user_id がある行だけを渡すこと。
 */
async function recheckStalePaid(
  supabase: SupabaseClient,
  userId: string,
  sub: SubscriptionRecord
): Promise<SubscriptionRecord> {
  const appUserId = sub.revenuecat_app_user_id as string;
  const now = Date.now();
  const last = lastActiveRecheckAt.get(userId);
  if (last !== undefined && now - last < ACTIVE_RECHECK_INTERVAL_MS) {
    // 少し前に聞き直した（または別の読み込みが聞き直している最中）。何も書かずに今の行のまま返す
    return sub;
  }
  if (lastActiveRecheckAt.size > 5000) lastActiveRecheckAt.clear();
  lastActiveRecheckAt.set(userId, now);
  const lookup = await fetchRevenueCatEntitlement(appUserId, {
    timeoutMs: ACTIVE_RECHECK_TIMEOUT_MS,
  });
  if (!lookup.ok) {
    // 聞き直せなかった（時間切れ・5xx・429 など）。何も書かずに今の行のまま（有料）返す
    console.warn(
      `[subscription] stale paid (${sub.status}) recheck failed for user ${userId} (http ${lookup.httpStatus ?? "-"}); keeping current row`
    );
    return sub;
  }

  // 読んだときの期限のままの行だけを書き換える（その間に Webhook で更新された行は上書きしない）
  const applied = await applyRevenueCatLookup(supabase, userId, appUserId, lookup, {
    downgrade: true,
    expectedPeriodEnd: sub.current_period_end,
  });
  if (applied.error) {
    console.error("[subscription] stale paid (active_* / trial) recheck write failed:", applied.error);
  }
  if (lookup.entitled) {
    const p = lookup.paid;
    return {
      ...sub,
      status: p.status,
      plan: p.plan ?? sub.plan,
      is_family: p.plan ? p.isFamily : sub.is_family,
      current_period_end: p.periodEnd,
      trial_ends_at: p.status === "trial" ? p.periodEnd : sub.trial_ends_at,
    };
  }
  if (applied.status === "expired") {
    await warnIfFamilyOwnerExpired(supabase, userId, appUserId);
  }
  if (applied.error || applied.status === "expired") {
    return { ...sub, status: "expired" };
  }
  // 0件（読んだあとに Webhook で行が変わった）: 今の行を読み直して返す
  const { data: fresh } = await supabase
    .from("subscriptions")
    .select(SUBSCRIPTION_COLUMNS)
    .eq("user_id", userId)
    .maybeSingle();
  return (fresh as SubscriptionRecord | null) ?? { ...sub, status: "expired" };
}

/**
 * 聞き直しで expired にした人が家族のオーナーなら、サポートで追えるように記録する（2026-10-02）。
 * 家族のメンバーはオーナーの行（families.owner_user_id）だけを見て有料かを決めるので、
 * オーナーの行が expired になると家族全員が無料扱いになる。
 * 「購入を復元」で購入が別の deviceId へ移ったとき、Webhook の TRANSFER が届いていれば家族ごと移し先へ付け替えるが、
 * ここ（聞き直し）では移し先が分からないので付け替えられない。移し先が分かったら
 * families.owner_user_id と family_members のオーナーの行（role='owner'）の user_id を移し先の users.id に直す。
 */
async function warnIfFamilyOwnerExpired(
  supabase: SupabaseClient,
  userId: string,
  appUserId: string
): Promise<void> {
  try {
    const { data: owned } = await supabase.from("families").select("id").eq("owner_user_id", userId);
    if (owned && owned.length > 0) {
      console.warn(
        `[subscription] family owner expired by recheck: user=${userId} revenuecat_app_user_id=${appUserId} families=${owned
          .map((f: { id: string }) => f.id)
          .join(",")}. Members are now free. If the purchase moved to another deviceId, move the family owner to it.`
      );
    }
  } catch {
    // 記録だけなので、失敗しても判定は止めない
  }
}

/**
 * 行の status を「今」の状態に直す（期限切れの判定）。期限切れなら DB も expired に書き換える。
 */
async function resolveCurrentSubscription(
  supabase: SupabaseClient,
  userId: string,
  row: SubscriptionRecord
): Promise<SubscriptionRecord> {
  let sub = row;

  // a. active_* の期限切れ（期限から ACTIVE_RECHECK_AFTER_MS を過ぎた行）。
  //    - RevenueCat が知っている行（revenuecat_app_user_id がある）: 更新の知らせの取りこぼし・購入が別の deviceId へ
  //      移った移し元など。RevenueCat に聞き直す（recheckStalePaid）
  //    - RevenueCat が知らない行（revenuecat_app_user_id が無い）: 聞き直さずに expired にする（2026-10-02）。
  //      2026-09-20 に塞いだ穴（旧 POST /api/subscription の subscribe。ストアの購入を確かめずに active_* と
  //      30日後・365日後の期限を書いていた）で作られた行がこれに当たる。以前はどの判定にも掛からず、ずっと有料のままだった。
  //      本物の購入は Webhook・購入直後の同期が必ず revenuecat_app_user_id を書くので、ここには来ない。
  //      手作業で有料にする行は、期限を空にしておけば対象にならない（今までどおり）。
  //      DB を書き換えるのは「読んだときの status・期限のままの行」だけ（その間に Webhook で変わった行は上書きしない）
  if (
    (sub.status === "active_monthly" || sub.status === "active_yearly") &&
    sub.current_period_end
  ) {
    const endMs = Date.parse(sub.current_period_end);
    if (Number.isFinite(endMs) && endMs + ACTIVE_RECHECK_AFTER_MS < Date.now()) {
      if (sub.revenuecat_app_user_id) {
        sub = await recheckStalePaid(supabase, userId, sub);
      } else {
        const readStatus = sub.status;
        const readPeriodEnd = sub.current_period_end;
        sub = { ...sub, status: "expired" };
        const { error: expireErr } = await supabase
          .from("subscriptions")
          .update({ status: "expired", updated_at: new Date().toISOString() })
          .eq("user_id", userId)
          .eq("status", readStatus)
          .eq("current_period_end", readPeriodEnd);
        if (expireErr) {
          console.error("[subscription] failed to expire active_* row without RevenueCat:", expireErr.message);
        }
      }
    }
  }

  // b. ストアの無料体験（Webhook・購入直後の同期が status='trial' で保存）は、終了と同時にストアが更新して
  //    RENEWAL の Webhook が届き active に変わる。Webhook が数分〜数時間遅れても有料の人を締め出さないよう、
  //    終了から TRIAL_EXPIRY_GRACE_MS 過ぎるまでは trial のまま扱う。猶予を過ぎても trial のままの行は:
  //    - RevenueCat が知っている行（revenuecat_app_user_id がある）: expired にする前に RevenueCat に聞き直す
  //      （2026-10-02。active_* の a. と同じ処理）。有料なら active / cancelled と新しい期限を書き、
  //      有料でないと返ったときだけ expired にする。聞き直せなければ trial のまま（有料）扱う
  //      （recheckStalePaid の説明を参照）。
  //      以前は聞き直さずに expired にしていたため、RENEWAL の Webhook を取りこぼした人（Webhook の障害で
  //      再送もすべて失敗した・体験終了時の決済が失敗してストアの猶予期間に入り BILLING_ISSUE しか届かない）が、
  //      払っているのに次の RENEWAL（年額なら1年後）まで無料扱いになっていた（家族プランのオーナーなら家族全員も）。
  //    - それ以外（手作業で入れた行など）: 今までどおり expired にする。DB を書き換えるのは「まだ trial のままの行」だけ
  //      （読み込んだ後に RENEWAL で active になった行を、expired で上書きしないため）。
  if (sub.status === "trial" && sub.trial_ends_at) {
    const trialEndMs = Date.parse(sub.trial_ends_at);
    if (Number.isFinite(trialEndMs) && trialEndMs + TRIAL_EXPIRY_GRACE_MS < Date.now()) {
      if (sub.revenuecat_app_user_id) {
        sub = await recheckStalePaid(supabase, userId, sub);
      } else {
        sub = { ...sub, status: "expired" };
        await supabase
          .from("subscriptions")
          .update({ status: "expired" })
          .eq("user_id", userId)
          .eq("status", "trial");
      }
    }
  }
  // b2. 期限も RevenueCat の ID も無い cancelled の行は expired にする（2026-10-02）。
  //     2026-09-21 に消した旧 POST /api/subscription の cancel（88acb54 で削除）は、今の status や期限を見ずに
  //     行の status を 'cancelled' に書き換えるだけだったので、無料の行・旧 start_trial の行（どちらも期限は NULL）に
  //     呼ばれるとこの状態が残る。isPaidStatus は cancelled を有料として扱い、c. は期限がある行しか見ず、
  //     a. / b. も cancelled を見ないので、以前はずっと有料（チャット・食事分析が無制限・30日コーチング・
  //     体調チェックの AI が新規・未課金の1日の上限を通らない）のままで、Webhook も来ないので自然には直らなかった。
  //     本物の解約は Webhook（CANCELLATION）・聞き直しが revenuecat_app_user_id を書くので、ここには来ない。
  //     DB を書き換えるのは「読んだときと同じく cancelled・期限なし・RevenueCat の ID なしの行」だけ
  //     （その間に Webhook・購入直後の同期で変わった行は上書きしない）
  if (sub.status === "cancelled" && !sub.current_period_end && !sub.revenuecat_app_user_id) {
    sub = { ...sub, status: "expired" };
    const { error: expireErr } = await supabase
      .from("subscriptions")
      .update({ status: "expired", updated_at: new Date().toISOString() })
      .eq("user_id", userId)
      .eq("status", "cancelled")
      .is("current_period_end", null)
      .is("revenuecat_app_user_id", null);
    if (expireErr) {
      console.error(
        "[subscription] failed to expire cancelled row without period end / RevenueCat:",
        expireErr.message
      );
    }
  }

  const now = new Date();
  // c. 解約済み（期限までは有料）
  if (sub.status === "cancelled" && sub.current_period_end) {
    if (new Date(sub.current_period_end) < now) {
      sub = { ...sub, status: "expired" };
      // 読み込んだ後に Webhook（UNCANCELLATION など）で変わった行は上書きしない
      await supabase
        .from("subscriptions")
        .update({ status: "expired" })
        .eq("user_id", userId)
        .eq("status", "cancelled");
    }
  }
  return sub;
}

// ========== 家族プラン判定: 家族のオーナーが家族プランで有料なら全員プレミアム ==========

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
  const { data: ownerRow } = await supabase
    .from("subscriptions")
    .select(SUBSCRIPTION_COLUMNS)
    .eq("user_id", family.owner_user_id)
    .maybeSingle();

  if (!ownerRow) return false;
  // オーナーの契約が家族プランでなければ、メンバーは有料にならない（単身プランの契約で家族全員が使えないように）
  if (!isFamilyPlanRow(ownerRow as SubscriptionRecord)) return false;

  // 期限切れの判定は本人の判定（getSubscriptionState）と同じ（trial の猶予・active_* の聞き直しを含む）
  const owner = await resolveCurrentSubscription(
    supabase,
    family.owner_user_id,
    ownerRow as SubscriptionRecord
  );
  return isPaidStatus(owner.status) && isFamilyPlanRow(owner);
}

// ========== サーバー側: サブスク情報取得 ==========

export async function getSubscriptionState(
  supabase: SupabaseClient,
  userId: string
): Promise<SubscriptionState> {
  // 0. 審査担当者用アカウントは、課金状態に関係なく全機能を開放する。
  //    DB は一切書き換えず、この応答だけを差し替える。
  if (isReviewerUser(userId)) {
    return {
      status: "active_monthly",
      isPaid: true,
      isTrial: false,
      isFamily: false,
      isLegacyUser: false,
      trialEndsAt: null,
      currentPeriodEnd: null,
      usage: { posture: 0, chat: 0, meal: 0 },
      limits: { posture: "unlimited", chat: "unlimited", meal: "unlimited" },
    };
  }

  // 1. subscriptions テーブルから取得（なければ作る）
  //    読み込みの失敗を「行が無い＝無料」として扱うと、有料・トライアル中の人を
  //    無料の上限で締め出してしまう（画面は /api/subscription の応答で入力欄をカードに置き換える）。
  //    失敗は例外にして、呼び出し元の try/catch で 500 にする（user_id は UNIQUE なので重複では失敗しない）。
  const { data: subRow, error: subError } = await supabase
    .from("subscriptions")
    .select(SUBSCRIPTION_COLUMNS)
    .eq("user_id", userId)
    .maybeSingle();
  if (subError) {
    throw new Error(`failed to load subscription: ${subError.message}`);
  }
  let sub = subRow as SubscriptionRecord | null;

  if (!sub) {
    await supabase
      .from("subscriptions")
      .insert({ user_id: userId, status: "free" });
    sub = {
      status: "free",
      plan: null,
      trial_ends_at: null,
      current_period_end: null,
      is_family: false,
      revenuecat_app_user_id: null,
    };
  }

  // 2. 期限切れの判定（active_* / trial の聞き直し・trial の猶予・cancelled の期限。家族のオーナーの判定と共通）
  sub = await resolveCurrentSubscription(supabase, userId, sub);
  const status = sub.status as SubscriptionStatus;

  // 2-b. 仕様変更前から使っている既存ユーザーかどうか（無料枠を残すため）
  //      users.created_at が取れない場合は「既存扱い」に倒す。
  //      判定に失敗して現役ユーザーを締め出すより、少し甘い方が害が小さい。
  //      無料枠は LEGACY_FREE_TIER_END（日本時間 10/31 いっぱい）で終わるので、それ以降は誰も既存扱いにしない
  const legacyTierOpen = Date.now() < LEGACY_FREE_TIER_END.getTime();
  let isLegacyUser = legacyTierOpen;
  try {
    const { data: u } = await supabase
      .from("users")
      .select("created_at")
      .eq("id", userId)
      .maybeSingle();
    if (u?.created_at) {
      isLegacyUser = legacyTierOpen && new Date(u.created_at) < LEGACY_FREE_TIER_CUTOFF;
    }
  } catch {
    // 取得できなければ既存扱いのまま
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
    // 家族グループを作れるのは、本人の契約が家族プランで有料扱い（無料体験・解約後の期限内を含む）のときだけ。
    // 家族メンバーとして有料になっている人は含めない（/api/family の create も同じ判定）
    isFamily: isPaidStatus(status) && isFamilyPlanRow(sub),
    isLegacyUser,
    // 既存ユーザーで無料枠がまだ有効な間だけ、終わる日時を返す（画面のお知らせ用）
    legacyFreeEndsAt: isLegacyUser && !isPaid ? LEGACY_FREE_TIER_END.toISOString() : null,
    trialEndsAt: sub.trial_ends_at,
    currentPeriodEnd: sub.current_period_end,
    usage,
    limits: isPaid
      ? { posture: "unlimited", chat: "unlimited", meal: "unlimited" }
      : isLegacyUser
      ? {
          posture: LEGACY_FREE_LIMITS.posture,
          chat: LEGACY_FREE_LIMITS.chat,
          meal: LEGACY_FREE_LIMITS.meal,
        }
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

/**
 * checkAndIncrementUsage で数えた1回を取り消す（数えたあとの保存が失敗したとき用）。
 * 取り消さないと、記録が入っていないのに今月の無料分だけが減り、
 * 新規の方（姿勢チェック 月1回）はやり直しの保存が必ず断られてしまう。
 */
export async function decrementUsage(
  supabase: SupabaseClient,
  userId: string,
  feature: "posture" | "chat" | "meal"
): Promise<void> {
  const period = getCurrentPeriodMonth();
  const { data: existing } = await supabase
    .from("usage_counters")
    .select("id, count")
    .eq("user_id", userId)
    .eq("feature", feature)
    .eq("period_month", period)
    .maybeSingle();
  if (!existing || existing.count <= 0) return;
  await supabase
    .from("usage_counters")
    .update({
      count: existing.count - 1,
      updated_at: new Date().toISOString(),
    })
    .eq("id", existing.id);
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
