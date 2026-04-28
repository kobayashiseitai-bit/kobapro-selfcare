/**
 * In-App Purchase ラッパー (RevenueCat 統合)
 *
 * iOS ネイティブビルド時のみ動作。Web/PWA では noop となり、
 * 既存の /api/subscription を使用する。
 *
 * 必要な事前準備:
 *   1. App Store Connect でサブスク商品登録
 *      - zero_pain_monthly_1280
 *      - zero_pain_yearly_12800
 *   2. RevenueCat ダッシュボードでアプリ登録
 *      - Apple App Store API キー設定
 *      - Entitlement「premium」作成
 *      - 上記2商品を premium にひも付け
 *   3. NEXT_PUBLIC_REVENUECAT_IOS_KEY 環境変数を設定
 *   4. RevenueCat の Webhook を /api/revenuecat/webhook に設定
 */

import type { CustomerInfo, PurchasesPackage } from "@revenuecat/purchases-capacitor";

// 動的importでバンドル時の型エラーを回避（webでは未使用）
type PurchasesModule = typeof import("@revenuecat/purchases-capacitor");

let purchasesModule: PurchasesModule | null = null;
let initialized = false;

const ENTITLEMENT_ID = "premium"; // RevenueCat側で設定したentitlement名

/** ネイティブiOS環境かどうか */
export function isNativeIOS(): boolean {
  if (typeof window === "undefined") return false;
  // Capacitor.getPlatform() === "ios" の判定
  // Capacitor.isNativePlatform() で WebView 内ネイティブ判定
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cap = (window as any).Capacitor;
  return cap?.isNativePlatform?.() === true && cap?.getPlatform?.() === "ios";
}

/** RevenueCat SDK の初期化 (アプリ起動時に1回呼ぶ) */
export async function initIAP(deviceId: string): Promise<boolean> {
  if (!isNativeIOS()) return false;
  if (initialized) return true;

  const apiKey = process.env.NEXT_PUBLIC_REVENUECAT_IOS_KEY;
  if (!apiKey) {
    console.warn("[IAP] NEXT_PUBLIC_REVENUECAT_IOS_KEY 未設定");
    return false;
  }

  try {
    if (!purchasesModule) {
      purchasesModule = await import("@revenuecat/purchases-capacitor");
    }
    const { Purchases, LOG_LEVEL } = purchasesModule;
    await Purchases.setLogLevel({ level: LOG_LEVEL.WARN });
    await Purchases.configure({
      apiKey,
      appUserID: deviceId, // ZERO-PAIN の deviceId を RevenueCat User ID として使う
    });
    initialized = true;
    return true;
  } catch (e) {
    console.error("[IAP] init failed:", e);
    return false;
  }
}

/** 購入可能なサブスク商品一覧を取得 */
export async function getAvailablePackages(): Promise<PurchasesPackage[]> {
  if (!isNativeIOS() || !initialized || !purchasesModule) return [];
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
  if (!isNativeIOS() || !initialized || !purchasesModule) {
    return { success: false, error: "IAP は iOS ネイティブのみ対応" };
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
  if (!isNativeIOS() || !initialized || !purchasesModule) {
    return { success: false, isPremium: false, error: "IAP は iOS ネイティブのみ対応" };
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
  if (!isNativeIOS() || !initialized || !purchasesModule) return null;
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
