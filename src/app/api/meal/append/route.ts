/**
 * 食事記録に「コース料理の追加皿」を追記する API。
 *
 * 用途: レストランで料理が順番に運ばれてきた時、最初の1皿を撮影して保存した
 * meal_records レコードに対し、後から運ばれてきた皿を追加で撮影・分析し
 * 同じレコードに集約する。
 *
 * 仕様:
 * - 親レコードの created_at から MAX_WINDOW_MS 以内のみ追加可能
 * - 親レコードを含めて MAX_TOTAL_PHOTOS 枚まで
 * - 利用回数は1食事として扱うため checkAndIncrementUsage は呼ばない
 * - menu_name は "/" で連結、calories/protein_g/carbs_g/fat_g は加算、score は平均
 * - advice は更新しない（皿ごとの advice は additional_images に保持）
 */

import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { getSignedImageUrl } from "../../../lib/supabase-storage";
import { SAFE_LANGUAGE_RULES } from "../../../lib/safe-language";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// 親レコード作成からこの時間内なら追加可能（1食事の合理的な所要時間）
const MAX_WINDOW_MS = 3 * 60 * 60 * 1000; // 3時間
const MAX_TOTAL_PHOTOS = 6; // 親 + additional = 最大6皿

interface AdditionalImage {
  image_url: string;
  menu_name: string | null;
  calories: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  score: number | null;
  advice: string | null;
  added_at: string;
}

const APPEND_SYSTEM_PROMPT = `あなたはZERO-PAINセルフケアアプリ専属のAI栄養士です。
ユーザーがレストランで「順番に運ばれてくるコース料理の1皿」を追加で撮影した写真を分析します。

【重要】
- これは1食の中の「追加の1皿」です。すでに別の皿が分析済みです
- 写真に写っている1皿だけのカロリー・栄養素を推定してください
- 容器・パッケージの文字情報があれば必ず読み取り正確に判定する
- 紙カップ/缶/ペットボトル/皿/丼などの容器の種類を正確に判別する

【必ず以下のJSON形式1つだけを返す】
{
  "menu_name": "推定した皿名（例: シーザーサラダ / 鶏のグリル / ティラミス）",
  "calories": 整数kcal,
  "protein_g": 小数第1位のg,
  "carbs_g": 小数第1位のg,
  "fat_g": 小数第1位のg,
  "score": 0〜100の整数,
  "advice": "この1皿に対する短いコメント（80〜120文字、絵文字1つまで）"
}

【判定不能の場合】
menu_name を "判定不能" とし、advice で再撮影を促してください。`;

function getAnthropic() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not set");
  return new Anthropic({ apiKey });
}

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "",
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
  );
}

interface DishAnalysis {
  menu_name?: string;
  calories?: number;
  protein_g?: number;
  carbs_g?: number;
  fat_g?: number;
  score?: number;
  advice?: string;
}

function sumNum(a: number | null | undefined, b: number | null | undefined): number | null {
  const av = typeof a === "number" ? a : 0;
  const bv = typeof b === "number" ? b : 0;
  if (a == null && b == null) return null;
  return Math.round((av + bv) * 10) / 10;
}

export async function POST(req: NextRequest) {
  try {
    const { imageData, deviceId, recordId } = await req.json();

    if (!imageData || !deviceId || !recordId) {
      return NextResponse.json(
        { error: "imageData, deviceId, recordId required" },
        { status: 400 }
      );
    }

    const supabase = getSupabase();

    // 1. ユーザー特定
    const { data: users } = await supabase
      .from("users")
      .select("id")
      .eq("device_id", deviceId);
    if (!users || users.length === 0) {
      return NextResponse.json({ error: "user not found" }, { status: 404 });
    }
    const userId = users[0].id;

    // 2. 親レコード取得 + 所有確認 + 上限チェック
    const { data: parent, error: parentErr } = await supabase
      .from("meal_records")
      .select(
        "id, user_id, image_url, meal_type, menu_name, calories, protein_g, carbs_g, fat_g, advice, score, created_at, additional_images"
      )
      .eq("id", recordId)
      .maybeSingle();

    if (parentErr || !parent) {
      return NextResponse.json(
        { error: "record not found", detail: parentErr?.message },
        { status: 404 }
      );
    }
    if (parent.user_id !== userId) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    const additional: AdditionalImage[] = Array.isArray(parent.additional_images)
      ? (parent.additional_images as AdditionalImage[])
      : [];
    const totalCount = 1 + additional.length;
    if (totalCount >= MAX_TOTAL_PHOTOS) {
      return NextResponse.json(
        {
          error: "too_many_photos",
          message: `1食につき最大${MAX_TOTAL_PHOTOS}皿までです`,
        },
        { status: 400 }
      );
    }

    const createdAt = new Date(parent.created_at).getTime();
    if (Date.now() - createdAt > MAX_WINDOW_MS) {
      return NextResponse.json(
        {
          error: "window_expired",
          message:
            "前の撮影から時間が経ちすぎています。新しい食事として撮影してください。",
        },
        { status: 400 }
      );
    }

    // 3. 画像を Supabase Storage にアップロード
    const base64 = imageData.replace(/^data:image\/\w+;base64,/, "");
    const buffer = Buffer.from(base64, "base64");
    const timestamp = Date.now();
    const filePath = `${userId}/${timestamp}_add${additional.length + 1}.jpg`;

    const { error: uploadError } = await supabase.storage
      .from("meal-images")
      .upload(filePath, buffer, {
        contentType: "image/jpeg",
        upsert: false,
      });

    if (uploadError) {
      return NextResponse.json(
        { error: "upload failed", detail: uploadError.message },
        { status: 500 }
      );
    }

    const { data: urlData } = supabase.storage
      .from("meal-images")
      .getPublicUrl(filePath);
    const imageUrl = urlData.publicUrl;

    // 4. AI 分析（追加皿用の軽量プロンプト）
    const mediaTypeMatch = imageData.match(/^data:image\/(\w+);base64,/);
    const mediaType = mediaTypeMatch ? `image/${mediaTypeMatch[1]}` : "image/jpeg";

    const client = getAnthropic();
    const response = await client.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 600,
      system: SAFE_LANGUAGE_RULES + "\n\n" + APPEND_SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: mediaType as
                  | "image/jpeg"
                  | "image/png"
                  | "image/webp"
                  | "image/gif",
                data: base64,
              },
            },
            {
              type: "text",
              text: "このコース料理の追加1皿を分析してください。JSON1件のみ返してください。",
            },
          ],
        },
      ],
    });

    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      return NextResponse.json({ error: "AI応答が空でした" }, { status: 500 });
    }
    const jsonMatch = textBlock.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json(
        { error: "AI応答の解析に失敗しました", raw: textBlock.text },
        { status: 500 }
      );
    }

    let dish: DishAnalysis;
    try {
      dish = JSON.parse(jsonMatch[0]) as DishAnalysis;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return NextResponse.json(
        { error: "JSON解析エラー", detail: msg, raw: textBlock.text },
        { status: 500 }
      );
    }

    const newAdditional: AdditionalImage = {
      image_url: imageUrl,
      menu_name: dish.menu_name ?? null,
      calories: dish.calories ?? null,
      protein_g: dish.protein_g ?? null,
      carbs_g: dish.carbs_g ?? null,
      fat_g: dish.fat_g ?? null,
      score: dish.score ?? null,
      advice: dish.advice ?? null,
      added_at: new Date().toISOString(),
    };

    // 5. 親レコードの集計値を更新
    const updatedAdditional = [...additional, newAdditional];

    // menu_name は連結（重複ガード付き）
    const dishName = (dish.menu_name || "").trim();
    let combinedMenuName = parent.menu_name || "";
    if (dishName && dishName !== "判定不能") {
      const parts = combinedMenuName ? combinedMenuName.split(" / ") : [];
      if (!parts.includes(dishName)) {
        parts.push(dishName);
        combinedMenuName = parts.join(" / ");
      }
    }

    // score は平均（null は除外）
    const allScores = [
      parent.score,
      ...updatedAdditional.map((a) => a.score),
    ].filter((s): s is number => typeof s === "number");
    const avgScore =
      allScores.length > 0
        ? Math.round(allScores.reduce((s, v) => s + v, 0) / allScores.length)
        : parent.score;

    const { data: updated, error: updErr } = await supabase
      .from("meal_records")
      .update({
        menu_name: combinedMenuName || parent.menu_name,
        calories: sumNum(parent.calories, dish.calories ?? null),
        protein_g: sumNum(parent.protein_g, dish.protein_g ?? null),
        carbs_g: sumNum(parent.carbs_g, dish.carbs_g ?? null),
        fat_g: sumNum(parent.fat_g, dish.fat_g ?? null),
        score: avgScore,
        additional_images: updatedAdditional,
      })
      .eq("id", recordId)
      .select(
        "id, image_url, meal_type, menu_name, calories, protein_g, carbs_g, fat_g, advice, score, created_at, additional_images"
      )
      .single();

    if (updErr || !updated) {
      return NextResponse.json(
        { error: "update failed", detail: updErr?.message },
        { status: 500 }
      );
    }

    // 6. 追加された皿の Signed URL も返す（クライアントでサムネ表示用）
    const newSignedImageUrl = await getSignedImageUrl(
      supabase,
      filePath,
      "meal-images"
    );

    return NextResponse.json({
      ok: true,
      record: updated,
      added: {
        ...newAdditional,
        image_url: newSignedImageUrl || imageUrl,
      },
      addedDish: dish,
      totalPhotos: 1 + updatedAdditional.length,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("Meal append API error:", e);
    return NextResponse.json(
      { error: "追加皿の分析に失敗しました", detail: msg },
      { status: 500 }
    );
  }
}
