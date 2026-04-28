/**
 * 食事撮影リマインダー
 *
 * 朝食/昼食/夕食のタイミングで「撮りましたか?」の通知を送信。
 * iOS ネイティブ: Capacitor Local Notifications を使用。
 * Web (PWA): Notification API でフォールバック (確実性は低い)。
 */

export type MealSlot = "breakfast" | "lunch" | "dinner";

export interface MealReminderConfig {
  enabled: Record<MealSlot, boolean>;
  times: Record<MealSlot, string>; // "HH:MM" 形式
}

const STORAGE_KEY = "zero_pain_meal_reminders_v1";

// ベースとなる通知ID (各スロットで予約・キャンセル時に使う)
const NOTIFICATION_IDS: Record<MealSlot, number> = {
  breakfast: 9001,
  lunch: 9002,
  dinner: 9003,
};

const SLOT_LABELS: Record<MealSlot, string> = {
  breakfast: "朝食",
  lunch: "昼食",
  dinner: "夕食",
};

const SLOT_EMOJI: Record<MealSlot, string> = {
  breakfast: "🍳",
  lunch: "🍱",
  dinner: "🍽️",
};

export const DEFAULT_CONFIG: MealReminderConfig = {
  enabled: {
    breakfast: true,
    lunch: true,
    dinner: true,
  },
  times: {
    breakfast: "07:30",
    lunch: "12:30",
    dinner: "19:00",
  },
};

export function loadConfig(): MealReminderConfig {
  if (typeof window === "undefined") return DEFAULT_CONFIG;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_CONFIG;
    const parsed = JSON.parse(raw);
    return {
      enabled: { ...DEFAULT_CONFIG.enabled, ...parsed.enabled },
      times: { ...DEFAULT_CONFIG.times, ...parsed.times },
    };
  } catch {
    return DEFAULT_CONFIG;
  }
}

export function saveConfig(config: MealReminderConfig): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}

function isCapacitorNative(): boolean {
  if (typeof window === "undefined") return false;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (window as any).Capacitor?.isNativePlatform?.() === true;
}

// "HH:MM" を {hour, minute} に分解
function parseTime(s: string): { hour: number; minute: number } {
  const [h, m] = s.split(":").map((n) => parseInt(n, 10));
  return { hour: isFinite(h) ? h : 0, minute: isFinite(m) ? m : 0 };
}

/**
 * 通知許可リクエスト & スケジュール
 * 起動時に config 読み込み後 → ここを呼ぶ。
 */
export async function applyMealReminders(config: MealReminderConfig): Promise<{
  ok: boolean;
  permitted: boolean;
  scheduled: MealSlot[];
  reason?: string;
}> {
  const scheduled: MealSlot[] = [];

  // ネイティブiOS/Android
  if (isCapacitorNative()) {
    try {
      const { LocalNotifications } = await import("@capacitor/local-notifications");

      // 許可確認・要求
      const perm = await LocalNotifications.checkPermissions();
      let granted = perm.display === "granted";
      if (!granted) {
        const req = await LocalNotifications.requestPermissions();
        granted = req.display === "granted";
      }
      if (!granted) {
        return { ok: false, permitted: false, scheduled, reason: "通知が許可されていません" };
      }

      // 既存通知をクリア
      const ids = Object.values(NOTIFICATION_IDS).map((id) => ({ id }));
      await LocalNotifications.cancel({ notifications: ids });

      // 各スロットで予約 (毎日同じ時刻)
      const toSchedule = (Object.keys(NOTIFICATION_IDS) as MealSlot[])
        .filter((slot) => config.enabled[slot])
        .map((slot) => {
          const { hour, minute } = parseTime(config.times[slot]);
          return {
            id: NOTIFICATION_IDS[slot],
            title: `${SLOT_EMOJI[slot]} ${SLOT_LABELS[slot]}の記録は済みましたか？`,
            body: "タップしてカメラから写真を撮影",
            schedule: {
              on: { hour, minute },
              repeats: true,
              allowWhileIdle: true,
            },
            extra: { kind: "meal_reminder", slot },
          };
        });

      if (toSchedule.length > 0) {
        await LocalNotifications.schedule({ notifications: toSchedule });
        toSchedule.forEach((n) => scheduled.push(n.extra.slot as MealSlot));
      }

      return { ok: true, permitted: true, scheduled };
    } catch (e) {
      return {
        ok: false,
        permitted: false,
        scheduled,
        reason: e instanceof Error ? e.message : String(e),
      };
    }
  }

  // Web フォールバック: Service Worker での schedule は標準化されていないため、
  // 設定のみ保存し、ユーザーがアプリを開いた時に「未撮影なら表示」する形にする。
  return {
    ok: true,
    permitted: false,
    scheduled,
    reason: "Web版では通知のスケジュール送信はサポートしていません(設定は保存されました)",
  };
}

/**
 * すべての食事リマインダー通知をキャンセル
 */
export async function cancelAllMealReminders(): Promise<void> {
  if (!isCapacitorNative()) return;
  try {
    const { LocalNotifications } = await import("@capacitor/local-notifications");
    const ids = Object.values(NOTIFICATION_IDS).map((id) => ({ id }));
    await LocalNotifications.cancel({ notifications: ids });
  } catch {
    /* noop */
  }
}

/**
 * 通知タップ時のハンドラを登録 (アプリ起動時に1回呼ぶ)
 * onMealReminderTap: 食事画面を開くなどの遷移処理
 */
export async function registerMealReminderTapHandler(
  onMealReminderTap: (slot: MealSlot) => void
): Promise<void> {
  if (!isCapacitorNative()) return;
  try {
    const { LocalNotifications } = await import("@capacitor/local-notifications");
    await LocalNotifications.addListener(
      "localNotificationActionPerformed",
      (notif) => {
        const extra = notif.notification.extra as { kind?: string; slot?: MealSlot } | undefined;
        if (extra?.kind === "meal_reminder" && extra.slot) {
          onMealReminderTap(extra.slot);
        }
      }
    );
  } catch {
    /* noop */
  }
}

export { SLOT_LABELS, SLOT_EMOJI };
