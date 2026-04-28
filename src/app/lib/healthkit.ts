/**
 * Apple HealthKit 連携 (iOS ネイティブのみ)
 *
 * 用途: 歩数・体重・心拍数・睡眠時間などを HealthKit から自動取得し、
 *       buildUserContext (chat API) に渡して AI のアドバイス精度を上げる。
 *
 * Web/PWA 環境では noop で安全に動作する。
 *
 * 必要設定:
 *   1. Info.plist に以下のキーを追加 (NSHealthShareUsageDescription / NSHealthUpdateUsageDescription)
 *      → 既存の Info.plist 修正が必要 (Xcode で開いて追加 or plutil コマンド)
 *   2. Xcode の Capabilities で「HealthKit」を有効化
 *   3. アプリ起動後、ユーザーに許可ダイアログを出してから読み取り
 */

import type { OtherData, QueryOutput } from "@perfood/capacitor-healthkit";

type HealthKitModule = typeof import("@perfood/capacitor-healthkit");
let healthkitModule: HealthKitModule | null = null;

const READ_PERMISSIONS = [
  "steps",
  "weight",
  "heartRate",
  "activeEnergy",
  "stairs",
] as const;

export type HealthDataKind = (typeof READ_PERMISSIONS)[number];

export interface HealthSnapshot {
  stepsToday: number | null;
  stepsWeekAvg: number | null;
  weightKg: number | null;
  weightUpdatedAt: string | null;
  restingHeartRate: number | null;
  activeEnergyToday: number | null;
}

/** ネイティブ iOS かつ HealthKit が利用可能か */
export function isHealthKitAvailable(): boolean {
  if (typeof window === "undefined") return false;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cap = (window as any).Capacitor;
  return cap?.isNativePlatform?.() === true && cap?.getPlatform?.() === "ios";
}

/** 許可リクエスト (初回1回のみ呼ぶ) */
export async function requestHealthKitPermissions(): Promise<{
  ok: boolean;
  error?: string;
}> {
  if (!isHealthKitAvailable()) {
    return { ok: false, error: "HealthKit は iOS ネイティブのみ対応" };
  }
  try {
    if (!healthkitModule) {
      healthkitModule = await import("@perfood/capacitor-healthkit");
    }
    const { CapacitorHealthkit } = healthkitModule;
    await CapacitorHealthkit.requestAuthorization({
      all: [],
      read: [...READ_PERMISSIONS],
      write: [], // 当面は読み取りのみ
    });
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

/** HealthKit 利用許可済みかチェック (許可ダイアログを再表示しない) */
export async function isHealthKitAuthorized(): Promise<boolean> {
  if (!isHealthKitAvailable()) return false;
  try {
    if (!healthkitModule) {
      healthkitModule = await import("@perfood/capacitor-healthkit");
    }
    const { CapacitorHealthkit } = healthkitModule;
    // ダミークエリで権限確認 (例外が出れば未許可)
    const startDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const endDate = new Date().toISOString();
    await CapacitorHealthkit.queryHKitSampleType({
      sampleName: "stepCount",
      startDate,
      endDate,
      limit: 1,
    });
    return true;
  } catch {
    return false;
  }
}

/** 今日の歩数を取得 */
async function getStepsForToday(): Promise<number | null> {
  if (!healthkitModule) return null;
  try {
    const { CapacitorHealthkit } = healthkitModule;
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const result = (await CapacitorHealthkit.queryHKitSampleType({
      sampleName: "stepCount",
      startDate: startOfDay.toISOString(),
      endDate: new Date().toISOString(),
      limit: 0,
    })) as QueryOutput<OtherData>;

    if (!result?.resultData) return null;
    return result.resultData.reduce(
      (sum, item) => sum + (typeof item.value === "number" ? item.value : 0),
      0
    );
  } catch {
    return null;
  }
}

/** 過去7日の平均歩数 */
async function getStepsWeekAverage(): Promise<number | null> {
  if (!healthkitModule) return null;
  try {
    const { CapacitorHealthkit } = healthkitModule;
    const start = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const result = (await CapacitorHealthkit.queryHKitSampleType({
      sampleName: "stepCount",
      startDate: start.toISOString(),
      endDate: new Date().toISOString(),
      limit: 0,
    })) as QueryOutput<OtherData>;

    if (!result?.resultData || result.resultData.length === 0) return null;
    const total = result.resultData.reduce(
      (sum, item) => sum + (typeof item.value === "number" ? item.value : 0),
      0
    );
    return Math.round(total / 7);
  } catch {
    return null;
  }
}

/** 最新の体重 (kg) */
async function getLatestWeight(): Promise<{ kg: number; date: string } | null> {
  if (!healthkitModule) return null;
  try {
    const { CapacitorHealthkit } = healthkitModule;
    const start = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000); // 90日以内
    const result = (await CapacitorHealthkit.queryHKitSampleType({
      sampleName: "weight",
      startDate: start.toISOString(),
      endDate: new Date().toISOString(),
      limit: 1,
    })) as QueryOutput<OtherData>;

    if (!result?.resultData || result.resultData.length === 0) return null;
    const latest = result.resultData[0];
    return {
      kg: typeof latest.value === "number" ? latest.value : 0,
      date: latest.startDate || new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

/** 過去30日の安静時心拍数の平均 */
async function getRestingHeartRate(): Promise<number | null> {
  if (!healthkitModule) return null;
  try {
    const { CapacitorHealthkit } = healthkitModule;
    const start = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const result = (await CapacitorHealthkit.queryHKitSampleType({
      sampleName: "restingHeartRate",
      startDate: start.toISOString(),
      endDate: new Date().toISOString(),
      limit: 30,
    })) as QueryOutput<OtherData>;

    if (!result?.resultData || result.resultData.length === 0) return null;
    const values = result.resultData
      .map((d) => (typeof d.value === "number" ? d.value : 0))
      .filter((v) => v > 0);
    if (values.length === 0) return null;
    return Math.round(values.reduce((a, b) => a + b, 0) / values.length);
  } catch {
    return null;
  }
}

/** 今日のアクティブエネルギー (kcal) */
async function getActiveEnergyToday(): Promise<number | null> {
  if (!healthkitModule) return null;
  try {
    const { CapacitorHealthkit } = healthkitModule;
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const result = (await CapacitorHealthkit.queryHKitSampleType({
      sampleName: "activeEnergyBurned",
      startDate: startOfDay.toISOString(),
      endDate: new Date().toISOString(),
      limit: 0,
    })) as QueryOutput<OtherData>;

    if (!result?.resultData) return null;
    return Math.round(
      result.resultData.reduce(
        (sum, item) => sum + (typeof item.value === "number" ? item.value : 0),
        0
      )
    );
  } catch {
    return null;
  }
}

/**
 * HealthKit から取得可能な全データを一括取得 (主要メトリクスのスナップショット)
 * AI に渡す user context として利用
 */
export async function getHealthSnapshot(): Promise<HealthSnapshot | null> {
  if (!isHealthKitAvailable()) return null;
  if (!healthkitModule) {
    try {
      healthkitModule = await import("@perfood/capacitor-healthkit");
    } catch {
      return null;
    }
  }

  const [stepsToday, stepsWeek, weight, hr, energy] = await Promise.all([
    getStepsForToday(),
    getStepsWeekAverage(),
    getLatestWeight(),
    getRestingHeartRate(),
    getActiveEnergyToday(),
  ]);

  return {
    stepsToday,
    stepsWeekAvg: stepsWeek,
    weightKg: weight?.kg ?? null,
    weightUpdatedAt: weight?.date ?? null,
    restingHeartRate: hr,
    activeEnergyToday: energy,
  };
}

/**
 * スナップショットを user context 用テキストに変換
 * (chat API などのプロンプトに含める用)
 */
export function formatHealthSnapshot(snap: HealthSnapshot | null): string {
  if (!snap) return "";
  const parts: string[] = [];
  if (snap.stepsToday !== null) {
    parts.push(`今日の歩数: ${snap.stepsToday.toLocaleString()}歩`);
  }
  if (snap.stepsWeekAvg !== null) {
    parts.push(`過去7日平均: ${snap.stepsWeekAvg.toLocaleString()}歩/日`);
  }
  if (snap.weightKg !== null) {
    parts.push(`最新体重: ${snap.weightKg.toFixed(1)}kg`);
  }
  if (snap.restingHeartRate !== null) {
    parts.push(`安静時心拍数(30日平均): ${snap.restingHeartRate}bpm`);
  }
  if (snap.activeEnergyToday !== null) {
    parts.push(`今日のアクティブカロリー: ${snap.activeEnergyToday}kcal`);
  }
  if (parts.length === 0) return "";
  return `\n【ヘルスケアデータ (Apple Health)】\n- ${parts.join("\n- ")}\n`;
}
