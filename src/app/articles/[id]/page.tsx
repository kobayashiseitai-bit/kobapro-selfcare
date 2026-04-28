"use client";

import Link from "next/link";
import { use } from "react";
import { ChevronLeft, Clock, Share2 } from "lucide-react";
import { notFound } from "next/navigation";
import {
  getArticleById,
  CATEGORY_LABELS,
  CATEGORY_COLORS,
} from "../../lib/articles";
import { shareArticle } from "../../lib/share";

export default function ArticleDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const article = getArticleById(id);

  if (!article) {
    notFound();
  }

  const handleShare = async () => {
    await shareArticle({
      id: article.id,
      title: article.title,
      summary: article.summary,
    });
  };

  return (
    <main className="min-h-screen bg-gray-950 text-white pb-24">
      <header className="sticky top-0 z-10 bg-gray-950/95 backdrop-blur-sm border-b border-gray-800/50 px-4 py-3">
        <div className="max-w-md mx-auto flex items-center justify-between gap-3">
          <Link href="/articles" className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm flex items-center gap-1">
            <ChevronLeft size={16} />
            一覧
          </Link>
          <button
            onClick={handleShare}
            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 rounded-lg text-xs font-bold flex items-center gap-1"
          >
            <Share2 size={14} />
            シェア
          </button>
        </div>
      </header>

      <article className="px-4 pt-5">
        <div className="max-w-md mx-auto">
          {/* ヒーロー */}
          <div className="text-center mb-5">
            <div className="text-5xl mb-3">{article.emoji}</div>
            <div className="flex items-center justify-center gap-2 mb-2">
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${CATEGORY_COLORS[article.category]}`}
              >
                {CATEGORY_LABELS[article.category]}
              </span>
              <span className="text-[10px] text-gray-500 flex items-center gap-0.5">
                <Clock size={10} />
                {article.readingTimeMin}分
              </span>
            </div>
            <h1 className="text-xl font-extrabold leading-tight mb-2">
              {article.title}
            </h1>
            <p className="text-xs text-gray-400">{article.publishedAt.replace(/-/g, "/")}</p>
          </div>

          {/* 本文 */}
          <div className="space-y-3">
            {article.body.map((para, i) => {
              // # / ## のヘッダー
              if (para.startsWith("## ")) {
                return (
                  <h2 key={i} className="text-base font-extrabold text-emerald-300 mt-5 mb-1">
                    {para.replace(/^## /, "")}
                  </h2>
                );
              }
              if (para.startsWith("# ")) {
                return (
                  <h1 key={i} className="text-lg font-extrabold text-emerald-300 mt-5 mb-2">
                    {para.replace(/^# /, "")}
                  </h1>
                );
              }
              // - で始まるリスト (連続する - 行をまとめる対応はせず簡易に)
              if (para.startsWith("- ")) {
                return (
                  <p key={i} className="text-sm text-gray-200 leading-relaxed pl-4 -indent-4">
                    • {renderInline(para.replace(/^- /, ""))}
                  </p>
                );
              }
              // 通常段落
              return (
                <p key={i} className="text-sm text-gray-200 leading-relaxed">
                  {renderInline(para)}
                </p>
              );
            })}
          </div>

          {/* 末尾 */}
          <div className="mt-8 card-accent-emerald p-4 text-center">
            <p className="text-sm text-emerald-200 font-bold mb-1">この記事は役に立ちましたか？</p>
            <p className="text-xs text-gray-300 mb-3">
              他の人にもシェアして、健康習慣の輪を広げましょう。
            </p>
            <button
              onClick={handleShare}
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 rounded-xl text-sm font-bold inline-flex items-center gap-1.5"
            >
              <Share2 size={14} />
              シェアする
            </button>
          </div>

          <Link
            href="/articles"
            className="mt-5 block text-center text-sm text-gray-400 underline"
          >
            ← 他の記事を読む
          </Link>
        </div>
      </article>
    </main>
  );
}

/** **bold** だけ簡易対応 (改行は段落で区切る) */
function renderInline(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((p, i) => {
    if (p.startsWith("**") && p.endsWith("**")) {
      return (
        <strong key={i} className="font-bold text-white">
          {p.slice(2, -2)}
        </strong>
      );
    }
    return <span key={i}>{p}</span>;
  });
}
