/**
 * In-App Purchase ラッパー (RevenueCat 統合)
 *
 * iOS / Android ネイティブビルド時のみ動作。Web/PWA では noop となり、
 * 既存の /api/subscription を使用する。
 *
 * 必要な事前準備:
 *   1. ストアにサブスク商品を登録(iOS/Android で同じ商品ID)
 *      - zero_pain_monthly_1280
 *      - zero_pain_yearly_12800
 *      ※Android は Google Play Console →「定期購入」で作成
 *   2. RevenueCat ダッシュボードでアプリ登録
 *      - iOS: Apple App Store API キー / Android: Google Play サービスアカウント
 *      - Entitlement「premium」作成(iOS/Android 共通)
 *      - 上記商品を premium にひも付け
 *   3. 環境変数を設定
 *      - NEXT_PUBLIC_REVENUECAT_IOS_KEY     (appl_ で始まる公開キー)
 *      - NEXT_PUBLIC_REVENUECAT_ANDROID_KEY (goog_ で始まる公開キー)
 *   4. RevenueCat の Webhook を /api/revenuecat/webhook に設定
 */

import type { CustomerInfo, PurchasesPackage } from "@revenuecat/purchases-capacitor";

// 動的importでバンドル時の型エラーを回避（webでは未使用）
type PurchasesModule = typeof import("@revenuecat/purchases-capacitor");

let purchasesModule: PurchasesModule | null = null;
let initialized = false;

const ENTITLEMENT_ID = "premium"; // RevenueCat側で設定したentitlement名

/** ネイティブのプラットフォーム名を返す (Web/PWA なら null) */
export function nativePlatform(): "ios" | "android" | null {
  if (typeof window === "undefined") return null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cap = (window as any).Capacitor;
  if (cap?.isNativePlatform?.() !== true) return null;
  const p = cap?.getPlatform?.();
  return p === "ios" || p === "android" ? p : null;
}

/** ストア課金が使える環境か (iOS / Android のネイティブビルド) */
export function isNativeIAP(): boolean {
  return nativePlatform() !== null;
}

/**
 * @deprecated isNativeIAP() を使うこと。Android 対応前の名残り。
 * 互換のため残しているが、判定内容は「iOS または Android」になっている。
 */
export const isNativeIOS = isNativeIAP;

/** RevenueCat SDK の初期化 (アプリ起動時に1回呼ぶ) */
export async function initIAP(deviceId: string): Promise<boolean> {
  console.log("[IAP] initIAP called, deviceId:", deviceId);
  const platform = nativePlatform();
  if (!platform) {
    console.log("[IAP] not a native platform, skipping");
    return false;
  }
  if (initialized) {
    console.log("[IAP] already initialized");
    return true;
  }

  // RevenueCat の公開キーはクライアント埋め込み前提の設計(env が空でも動くようフォールバック)
  const apiKey =
    platform === "android"
      ? process.env.NEXT_PUBLIC_REVENUECAT_ANDROID_KEY || ""
      : process.env.NEXT_PUBLIC_REVENUECAT_IOS_KEY ||
        "appl_uxudppFzNcOpKAVWjwRhcqhgBfQ";
  if (!apiKey) {
    // Android キー未設定のまま初期化すると RevenueCat 側で例外になるため手前で止める
    console.warn(`[IAP] ${platform} の RevenueCat API キーが未設定のため IAP を無効化`);
    return false;
  }
  console.log("[IAP] platform:", platform, "apiKey present:", !!apiKey);

  try {
    if (!purchasesModule) {
      console.log("[IAP] importing @revenuecat/purchases-capacitor");
      purchasesModule = await import("@revenuecat/purchases-capacitor");
    }
    const { Purchases, LOG_LEVEL } = purchasesModule;
    await Purchases.setLogLevel({ level: LOG_LEVEL.WARN });
    await Purchases.configure({
      apiKey,
      appUserID: deviceId, // ZERO-PAIN の deviceId を RevenueCat User ID として使う
    });
    initialized = true;
    console.log("[IAP] initialized OK");
    return true;
  } catch (e) {
    console.error("[IAP] init failed:", e);
    return false;
  }
}

/** 購入可能なサブスク商品一覧を取得 */
export async function getAvailablePackages(): Promise<PurchasesPackage[]> {
  if (!isNativeIAP() || !initialized || !purchasesModule) return [];
  try {
    const { Purchases } = purchasesModule;
    const offerings = await Purchases.getOfferings();
    return offerings.current?.availablePackages || [];
  } catch (e) {
    console.error("[IAP] getOfferings failed:", e);
    return [];
  }
}

/** サブスク購入を開始 */
export async function purchasePackage(
  pkg: PurchasesPackage
): Promise<{ success: boolean; customerInfo?: CustomerInfo; error?: string }> {
  if (!isNativeIAP() || !initialized || !purchasesModule) {
    return { success: false, error: "IAP はアプリ版のみ対応" };
  }
  try {
    const { Purchases } = purchasesModule;
    const result = await Purchases.purchasePackage({ aPackage: pkg });
    const isPremium =
      !!result.customerInfo.entitlements.active[ENTITLEMENT_ID];
    return { success: isPremium, customerInfo: result.customerInfo };
  } catch (e) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const err = e as any;
    if (err?.userCancelled) {
      return { success: false, error: "キャンセルされました" };
    }
    return { success: false, error: err?.message || "購入処理でエラーが発生しました" };
  }
}

/** 購入の復元 (App Store ガイドライン必須) */
export async function restorePurchases(): Promise<{
  success: boolean;
  isPremium: boolean;
  error?: string;
}> {
  if (!isNativeIAP() || !initialized || !purchasesModule) {
    return { success: false, isPremium: false, error: "IAP はアプリ版のみ対応" };
  }
  try {
    const { Purchases } = purchasesModule;
    const customerInfo = await Purchases.restorePurchases();
    const isPremium = !!customerInfo.customerInfo.entitlements.active[ENTITLEMENT_ID];
    return { success: true, isPremium };
  } catch (e) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return { success: false, isPremium: false, error: (e as any)?.message };
  }
}

/** 現在のサブスク状態を取得 */
export async function getCustomerInfo(): Promise<CustomerInfo | null> {
  if (!isNativeIAP() || !initialized || !purchasesModule) return null;
  try {
    const { Purchases } = purchasesModule;
    const result = await Purchases.getCustomerInfo();
    return result.customerInfo;
  } catch (e) {
    console.error("[IAP] getCustomerInfo failed:", e);
    return null;
  }
}

/** プレミアム状態かどうか */
export async function isPremium(): Promise<boolean> {
  const info = await getCustomerInfo();
  if (!info) return false;
  return !!info.entitlements.active[ENTITLEMENT_ID];
}
