/**
 * 日本語文字列を洗い出して辞書の下書きを作る(調査専用・ファイルは書き換えない)
 *
 *   node scripts/extract-i18n.mjs src/app/page.tsx
 *
 * 出力: 種類ごとに分類した一覧。置換の難易度を見積もるために使う。
 */
import { readFileSync } from "node:fs";

const JP = /[ぁ-んァ-ヶ一-龥]/;
const target = process.argv[2];
if (!target) {
  console.error("使い方: node scripts/extract-i18n.mjs <ファイル>");
  process.exit(1);
}

const src = readFileSync(target, "utf8");
const lines = src.split("\n");

const buckets = {
  comment: [],      // コメント(翻訳不要)
  jsxText: [],      // JSXの地の文
  stringLiteral: [] // "..." や '...'
  ,templateLiteral: [] // `...${}...`
  ,other: [],
};

let inBlockComment = false;

lines.forEach((line, i) => {
  const no = i + 1;
  const trimmed = line.trim();
  if (!JP.test(line)) return;

  if (inBlockComment) {
    buckets.comment.push([no, trimmed]);
    if (trimmed.includes("*/")) inBlockComment = false;
    return;
  }
  if (trimmed.startsWith("/*")) {
    buckets.comment.push([no, trimmed]);
    if (!trimmed.includes("*/")) inBlockComment = true;
    return;
  }
  if (trimmed.startsWith("//") || trimmed.startsWith("*")) {
    buckets.comment.push([no, trimmed]);
    return;
  }
  // 行末コメントだけが日本語のケース
  const codePart = line.replace(/\/\/.*$/, "");
  if (!JP.test(codePart)) {
    buckets.comment.push([no, trimmed]);
    return;
  }
  // JSXコメント {/* ... */}
  if (/^\{\s*\/\*/.test(trimmed)) {
    buckets.comment.push([no, trimmed]);
    return;
  }

  if (/`[^`]*[ぁ-んァ-ヶ一-龥]/.test(codePart)) {
    buckets.templateLiteral.push([no, trimmed]);
  } else if (/["'][^"']*[ぁ-んァ-ヶ一-龥]/.test(codePart)) {
    buckets.stringLiteral.push([no, trimmed]);
  } else if (/>[^<]*[ぁ-んァ-ヶ一-龥]/.test(codePart) || /^[^<>{}]*[ぁ-んァ-ヶ一-龥]/.test(trimmed)) {
    buckets.jsxText.push([no, trimmed]);
  } else {
    buckets.other.push([no, trimmed]);
  }
});

const labels = {
  comment: "コメント(翻訳不要)",
  jsxText: "JSXの地の文",
  stringLiteral: '文字列リテラル "..."',
  templateLiteral: "テンプレートリテラル `...`",
  other: "分類不能(要目視)",
};

console.log(`\n===== ${target} =====`);
for (const [key, label] of Object.entries(labels)) {
  console.log(`\n--- ${label}: ${buckets[key].length} 行 ---`);
  if (key === "comment") continue; // 量が多く不要なので中身は出さない
  for (const [no, text] of buckets[key].slice(0, 200)) {
    console.log(`${String(no).padStart(5)}: ${text.slice(0, 160)}`);
  }
  if (buckets[key].length > 200) console.log(`  ... 他 ${buckets[key].length - 200} 行`);
}
