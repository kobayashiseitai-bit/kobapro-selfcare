/**
 * アプリ内記事 (ニュース・コラム) ロジック
 *
 * データは articles-data.json に分離されており、
 * - 手動キュレーション記事
 * - GitHub Actions による自動生成記事 (月約15本)
 * の両方が混在する。
 *
 * 自動生成は scripts/generate-article.mjs により
 * 2日に1回 Claude API で生成され、コミットされる。
 */

import data from "./articles-data.json";

export type ArticleCategory =
  | "posture"
  | "stretch"
  | "nutrition"
  | "sleep"
  | "mental"
  | "science";

export interface Article {
  id: string;
  title: string;
  summary: string;
  category: ArticleCategory;
  emoji: string;
  publishedAt: string; // YYYY-MM-DD
  readingTimeMin: number;
  body: string[];
  /** 自動生成された記事には true (任意フィールド) */
  generated?: boolean;
}

export const CATEGORY_LABELS: Record<ArticleCategory, string> = {
  posture: "姿勢・骨格",
  stretch: "ストレッチ",
  nutrition: "食事・栄養",
  sleep: "睡眠",
  mental: "メンタル",
  science: "科学・医学",
};

export const CATEGORY_COLORS: Record<ArticleCategory, string> = {
  posture: "text-blue-300 bg-blue-500/10 border-blue-500/30",
  stretch: "text-emerald-300 bg-emerald-500/10 border-emerald-500/30",
  nutrition: "text-orange-300 bg-orange-500/10 border-orange-500/30",
  sleep: "text-indigo-300 bg-indigo-500/10 border-indigo-500/30",
  mental: "text-pink-300 bg-pink-500/10 border-pink-500/30",
  science: "text-purple-300 bg-purple-500/10 border-purple-500/30",
};

export const ARTICLES: Article[] = data as Article[];

/** 公開日の新しい順に並んだ記事一覧 */
export function getArticles(): Article[] {
  return [...ARTICLES].sort((a, b) =>
    b.publishedAt.localeCompare(a.publishedAt)
  );
}

export function getArticleById(id: string): Article | undefined {
  return ARTICLES.find((a) => a.id === id);
}

export function getArticlesByCategory(cat: ArticleCategory): Article[] {
  return getArticles().filter((a) => a.category === cat);
}
