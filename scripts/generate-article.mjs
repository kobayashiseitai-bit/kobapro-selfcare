#!/usr/bin/env node
/**
 * 自動記事生成スクリプト
 *
 * Usage:
 *   ANTHROPIC_API_KEY=xxx node scripts/generate-article.mjs
 *
 * 実行:
 *   1. 既存記事のタイトル/カテゴリを読み込み (重複回避)
 *   2. Claude API に記事生成依頼 (JSON形式)
 *   3. バリデーション後、articles-data.json に追記
 *
 * GitHub Actions から 2日に1回実行される (= 月15本ペース)
 */

import Anthropic from "@anthropic-ai/sdk";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, "..");
const DATA_FILE = path.join(PROJECT_ROOT, "src/app/lib/articles-data.json");

const VALID_CATEGORIES = ["posture", "stretch", "nutrition", "sleep", "mental", "science"];

const SYSTEM_PROMPT = `あなたはZERO-PAINセルフケアアプリの記事ライターです。姿勢ケア・健康習慣に関する読みやすく実践的な記事を1本生成してください。

重要なルール:
- セルフケアアプリのため、医療的断定表現は禁止: 「治療」「治す」「診断」「処方」「効果保証」「100%」「絶対に」
- 推奨表現: 「セルフケア」「ケア」「サポート」「楽になる」「役立つ」「整える」「予防」
- 重い症状(強い痛み・しびれ・めまい等)は医療機関受診を推奨
- 専門用語は使わず、誰にでもわかる日常語で
- 比喩や具体例を交えて親しみやすく

記事の構造:
- title: 30文字以内、好奇心を引くタイトル
- summary: 80文字以内、記事の魅力を伝える要約
- body: 8〜15段落の本文配列。各段落は1〜3文。
  - 段落の先頭に "## " を付けると見出しに
  - "**強調**" でボールド (1段落に1〜2箇所まで)
  - "- " で始めると箇条書き
- category: 以下のいずれか1つ
  - posture (姿勢・骨格)
  - stretch (ストレッチ・運動)
  - nutrition (食事・栄養)
  - sleep (睡眠)
  - mental (メンタル・ストレスケア)
  - science (科学・医学知識)
- emoji: 内容を表す絵文字1つ
- readingTimeMin: 3〜6 (本文文字数から逆算: 文字数÷400で分数)

出力は必ず以下のJSON形式で、それ以外のテキストは一切含めない:

{
  "title": "...",
  "summary": "...",
  "category": "posture",
  "emoji": "💪",
  "readingTimeMin": 4,
  "body": [
    "導入段落...",
    "## セクション1の見出し",
    "段落...",
    ...
  ]
}`;

function loadExistingArticles() {
  const json = fs.readFileSync(DATA_FILE, "utf8");
  return JSON.parse(json);
}

function pickUnderrepresentedCategory(articles) {
  const counts = Object.fromEntries(VALID_CATEGORIES.map((c) => [c, 0]));
  for (const a of articles) counts[a.category] = (counts[a.category] || 0) + 1;
  const sorted = Object.entries(counts).sort((a, b) => a[1] - b[1]);
  return sorted[0][0]; // 最も少ないカテゴリ
}

function buildPrompt(articles) {
  const targetCategory = pickUnderrepresentedCategory(articles);
  const recentTitles = articles
    .slice(-30)
    .map((a) => `- [${a.category}] ${a.title}`)
    .join("\n");

  return `今回は **${targetCategory}** カテゴリの記事を1本生成してください。

【既存記事 (重複を避けてください)】
${recentTitles}

【今回のテーマの方向性】
${targetCategory} カテゴリで、まだ取り上げていない切り口で、ユーザーの日常に役立つ実用的な内容を選んでください。

JSON 1件のみ出力してください。`;
}

function generateId(title) {
  // タイトルから簡易な英語IDを作る
  // ハッシュベースで一意性を担保
  const date = new Date().toISOString().slice(0, 10);
  const hash = Buffer.from(title).toString("hex").slice(0, 8);
  return `auto-${date}-${hash}`;
}

function validate(article) {
  const required = ["title", "summary", "category", "emoji", "readingTimeMin", "body"];
  for (const k of required) {
    if (!(k in article)) throw new Error(`Missing field: ${k}`);
  }
  if (!VALID_CATEGORIES.includes(article.category)) {
    throw new Error(`Invalid category: ${article.category}`);
  }
  if (!Array.isArray(article.body) || article.body.length < 5) {
    throw new Error(`body must be array of >=5 paragraphs (got ${article.body?.length})`);
  }
  if (article.title.length > 50) {
    throw new Error(`title too long: ${article.title.length} chars`);
  }
  // 禁止ワードチェック
  const fullText = [article.title, article.summary, ...article.body].join(" ");
  const banned = ["治療", "治す", "完治", "診断", "処方", "100%効果", "絶対に治"];
  for (const word of banned) {
    if (fullText.includes(word)) {
      throw new Error(`Contains banned word: ${word}`);
    }
  }
  return true;
}

async function main() {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("❌ ANTHROPIC_API_KEY not set");
    process.exit(1);
  }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const existing = loadExistingArticles();
  const prompt = buildPrompt(existing);

  console.log(`📚 Existing: ${existing.length} articles`);
  console.log(`🎯 Target category: ${pickUnderrepresentedCategory(existing)}`);

  const response = await client.messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: 4000,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: prompt }],
  });

  const text = response.content
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("");

  // JSON抽出 (Markdown コードブロック等の可能性に対応)
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    console.error("❌ No JSON found in response:", text.slice(0, 500));
    process.exit(1);
  }

  let article;
  try {
    article = JSON.parse(jsonMatch[0]);
  } catch (e) {
    console.error("❌ JSON parse error:", e.message);
    console.error("Raw:", jsonMatch[0].slice(0, 500));
    process.exit(1);
  }

  validate(article);

  // ID と publishedAt を付与
  article.id = generateId(article.title);
  article.publishedAt = new Date().toISOString().slice(0, 10);
  article.generated = true;

  // 重複ID チェック (同日に2回実行された場合の安全策)
  if (existing.find((a) => a.id === article.id)) {
    console.warn(`⚠️ Duplicate ID, skipping: ${article.id}`);
    process.exit(0);
  }

  // 重複タイトル チェック
  if (existing.find((a) => a.title === article.title)) {
    console.warn(`⚠️ Duplicate title, skipping: ${article.title}`);
    process.exit(0);
  }

  // 追記保存
  existing.push(article);
  fs.writeFileSync(DATA_FILE, JSON.stringify(existing, null, 2) + "\n");

  console.log(`✅ Generated: [${article.category}] ${article.emoji} ${article.title}`);
  console.log(`   ID: ${article.id}`);
  console.log(`   Total articles: ${existing.length}`);
}

main().catch((e) => {
  console.error("❌ Generation failed:", e.message);
  process.exit(1);
});
