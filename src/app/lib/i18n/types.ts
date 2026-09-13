/**
 * 多言語対応の型定義
 *
 * 対応言語を増やすには Locale に追加し、dictionaries に同名ファイルを置く。
 */

export const LOCALES = ["ja", "en"] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "ja";

/** 辞書は「キー → 文言」のフラットな対応表 */
export type Dictionary = Record<string, string>;

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}
