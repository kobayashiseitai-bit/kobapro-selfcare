/**
 * 表示言語の判定と保存
 *
 * 優先順位:
 *   1. ユーザーが設定画面で選んだ言語(localStorage)
 *   2. 端末の言語(navigator.language) — 日本語なら ja、それ以外は en
 *   3. DEFAULT_LOCALE
 *
 * ※ 海外ユーザーは端末が英語なので、何もしなくても英語で立ち上がる。
 */

import { DEFAULT_LOCALE, isLocale, type Locale } from "./types";

const STORAGE_KEY = "zeropain_locale";

/** 端末の言語から表示言語を推定する(日本語圏だけ ja、他は en) */
export function detectDeviceLocale(): Locale {
  if (typeof navigator === "undefined") return DEFAULT_LOCALE;
  const langs = [navigator.language, ...(navigator.languages ?? [])];
  for (const lang of langs) {
    if (!lang) continue;
    if (lang.toLowerCase().startsWith("ja")) return "ja";
  }
  return "en";
}

/** 保存された選択があればそれを、なければ端末言語を返す */
export function resolveLocale(): Locale {
  if (typeof window === "undefined") return DEFAULT_LOCALE;
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (isLocale(saved)) return saved;
  } catch {
    // プライベートブラウズ等で localStorage が使えない場合は端末言語にフォールバック
  }
  return detectDeviceLocale();
}

/** 設定画面で言語を選んだときに呼ぶ */
export function saveLocale(locale: Locale): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, locale);
  } catch {
    // 保存できなくても表示自体は切り替わる(次回起動時に端末言語へ戻るだけ)
  }
}

/** 「端末に合わせる」に戻す */
export function clearSavedLocale(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // 何もしない
  }
}

/** ユーザーが明示的に言語を選んでいるか */
export function hasSavedLocale(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return isLocale(window.localStorage.getItem(STORAGE_KEY));
  } catch {
    return false;
  }
}
