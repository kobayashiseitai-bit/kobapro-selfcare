"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ChevronLeft, Newspaper, Clock } from "lucide-react";
import {
  ARTICLES,
  CATEGORY_LABELS,
  CATEGORY_COLORS,
  type ArticleCategory,
} from "../lib/articles";

const CATEGORIES: Array<{ id: ArticleCategory | "all"; label: string }> = [
  { id: "all", label: "すべて" },
  { id: "posture", label: "姿勢" },
  { id: "stretch", label: "ストレッチ" },
  { id: "nutrition", label: "食事" },
  { id: "sleep", label: "睡眠" },
  { id: "mental", label: "メンタル" },
  { id: "science", label: "科学" },
];

export default function ArticlesIndexPage() {
  const [filter, setFilter] = useState<ArticleCategory | "all">("all");

  const articles = useMemo(() => {
    const sorted = [...ARTICLES].sort((a, b) =>
      b.publishedAt.localeCompare(a.publishedAt)
    );
    return filter === "all" ? sorted : sorted.filter((a) => a.category === filter);
  }, [filter]);

  return (
    <main className="min-h-screen bg-gray-950 text-white pb-20">
      {/* ヘッダー */}
      <header className="sticky top-0 z-10 bg-gray-950/95 backdrop-blur-sm border-b border-gray-800/50 px-4 py-3">
        <div className="max-w-md mx-auto flex items-center gap-3">
          <Link href="/" className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm flex items-center gap-1">
            <ChevronLeft size={16} />
            戻る
          </Link>
          <h1 className="text-base font-extrabold flex items-center gap-1.5">
            <Newspaper size={18} className="text-emerald-400" />
            ニュース・コラム
          </h1>
        </div>
      </header>

      {/* カテゴリフィルタ */}
      <div className="px-4 pt-4">
        <div className="max-w-md mx-auto flex gap-2 overflow-x-auto pb-2 -mx-1 px-1">
          {CATEGORIES.map((c) => {
            const active = filter === c.id;
            return (
              <button
                key={c.id}
                onClick={() => setFilter(c.id)}
                className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-bold transition ${
                  active
                    ? "bg-emerald-500 text-white"
                    : "bg-gray-800 text-gray-300 hover:bg-gray-700"
                }`}
              >
                {c.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* 記事リスト */}
      <div className="px-4 pt-3">
        <div className="max-w-md mx-auto space-y-3">
          {articles.length === 0 && (
            <div className="text-center text-gray-500 py-10 text-sm">
              該当する記事がまだありません
            </div>
          )}
          {articles.map((a) => (
            <Link
              key={a.id}
              href={`/articles/${a.id}`}
              className="block card-base p-4 active:scale-[0.99] transition"
            >
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-gray-800 flex items-center justify-center text-2xl">
                  {a.emoji}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${CATEGORY_COLORS[a.category]}`}
                    >
                      {CATEGORY_LABELS[a.category]}
                    </span>
                    <span className="text-[10px] text-gray-500 flex items-center gap-0.5">
                      <Clock size={10} />
                      {a.readingTimeMin}分で読める
                    </span>
                  </div>
                  <h2 className="text-sm font-bold text-white leading-snug mb-1">
                    {a.title}
                  </h2>
                  <p className="text-[11px] text-gray-400 line-clamp-2 leading-relaxed">
                    {a.summary}
                  </p>
                  <p className="text-[10px] text-gray-500 mt-1.5">
                    {a.publishedAt.replace(/-/g, "/")}
                  </p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
