"use client";

/**
 * 多言語対応の入口
 *
 * 使い方:
 *   const t = useT();
 *   <h1>{t("home.title")}</h1>
 *   <p>{t("home.greeting", { name: userName })}</p>
 *
 * 文言は dictionaries/ja.ts と en.ts に定義する。
 * 英語の文言が未定義なら日本語にフォールバックし、開発中だけ警告を出す。
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { ja } from "./dictionaries/ja";
import { en } from "./dictionaries/en";
import { resolveLocale, saveLocale, clearSavedLocale, hasSavedLocale } from "./locale";
import { DEFAULT_LOCALE, type Dictionary, type Locale } from "./types";

const DICTIONARIES: Record<Locale, Dictionary> = { ja, en };

/** 未定義キーの警告を1回だけ出すための記録(ログの洪水を防ぐ) */
const warned = new Set<string>();

/** {name} を値に差し替える */
function interpolate(template: string, vars?: Record<string, string | number>): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (whole, key: string) => {
    const value = vars[key];
    return value === undefined ? whole : String(value);
  });
}

export function translate(
  locale: Locale,
  key: string,
  vars?: Record<string, string | number>,
): string {
  const dict = DICTIONARIES[locale] ?? DICTIONARIES[DEFAULT_LOCALE];
  let text = dict[key];

  if (text === undefined) {
    // 英語が未翻訳なら日本語で表示する(空欄よりはるかにマシ)
    text = DICTIONARIES[DEFAULT_LOCALE][key];
    if (process.env.NODE_ENV !== "production" && !warned.has(`${locale}:${key}`)) {
      warned.add(`${locale}:${key}`);
      console.warn(`[i18n] 未翻訳: locale=${locale} key=${key}`);
    }
  }

  if (text === undefined) {
    // 辞書にキー自体が無い。キー名を出して気づけるようにする
    if (process.env.NODE_ENV !== "production" && !warned.has(`missing:${key}`)) {
      warned.add(`missing:${key}`);
      console.warn(`[i18n] キーが辞書にありません: ${key}`);
    }
    return key;
  }

  return interpolate(text, vars);
}

export type TranslateFn = (key: string, vars?: Record<string, string | number>) => string;

interface LocaleContextValue {
  locale: Locale;
  /** 表示言語を切り替えて保存する */
  setLocale: (locale: Locale) => void;
  /** 「端末に合わせる」に戻す */
  resetLocale: () => void;
  /** ユーザーが明示的に選んでいるか */
  isExplicit: boolean;
  t: TranslateFn;
}

const LocaleContext = createContext<LocaleContextValue | null>(null);

export function LocaleProvider({ children }: { children: ReactNode }) {
  // サーバー描画と初回クライアント描画を一致させるため、初期値は DEFAULT_LOCALE。
  // マウント直後に実際の言語へ切り替える(ハイドレーション不一致を避ける)。
  const [locale, setLocaleState] = useState<Locale>(DEFAULT_LOCALE);
  const [isExplicit, setIsExplicit] = useState(false);

  useEffect(() => {
    setLocaleState(resolveLocale());
    setIsExplicit(hasSavedLocale());
  }, []);

  // <html lang> を実際の言語に合わせる。
  // 日本語の禁則処理(単語途中での改行)はこれが無いと壊れる。
  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.lang = locale;
    }
  }, [locale]);

  const setLocale = useCallback((next: Locale) => {
    saveLocale(next);
    setLocaleState(next);
    setIsExplicit(true);
  }, []);

  const resetLocale = useCallback(() => {
    clearSavedLocale();
    setLocaleState(resolveLocale());
    setIsExplicit(false);
  }, []);

  const t = useCallback<TranslateFn>(
    (key, vars) => translate(locale, key, vars),
    [locale],
  );

  const value = useMemo<LocaleContextValue>(
    () => ({ locale, setLocale, resetLocale, isExplicit, t }),
    [locale, setLocale, resetLocale, isExplicit, t],
  );

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

function useLocaleContext(): LocaleContextValue {
  const ctx = useContext(LocaleContext);
  if (!ctx) {
    throw new Error("LocaleProvider の外で useT / useLocale は使えません");
  }
  return ctx;
}

/** 文言を引くだけならこれ */
export function useT(): TranslateFn {
  return useLocaleContext().t;
}

/** 言語の切り替えが必要な画面(設定など)ではこれ */
export function useLocale(): Omit<LocaleContextValue, "t"> {
  const { t: _t, ...rest } = useLocaleContext();
  return rest;
}

export { LOCALES, DEFAULT_LOCALE } from "./types";
export type { Locale } from "./types";
