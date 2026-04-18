import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { checkAndIncrementUsage } from "../../lib/subscription";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function getClient() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      "ANTHROPIC_API_KEY not set. Check .env.local and restart the dev server."
    );
  }
  return new Anthropic({ apiKey });
}

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
  );
}

const SYMPTOM_LABELS: Record<string, string> = {
  neck: "首こり",
  shoulder_stiff: "肩こり",
  back: "腰痛",
  headache: "頭痛",
  eye_fatigue: "眼精疲労",
  kyphosis: "猫背",
};

// ZERO-PAIN 食事分析用プロンプト
const MEAL_SYSTEM_PROMPT = `あなたはZERO-PAINセルフケアアプリ専属のAI栄養士兼整体師です。
ユーザーが撮影した食事写真を見て、栄養分析と姿勢・体調に結びつけたアドバイスをします。

【役割】
- 食事写真からメニューを推定する
- カロリー・三大栄養素を概算する
- 姿勢の痛み（首こり・肩こり・腰痛など）と食事の関係を踏まえたアドバイス
- 専門用語は使わず、親しみやすい言葉で説明

【必ず守る回答フォーマット】
必ず以下のJSON形式1つだけを返してください。余計な前置きや囲みのコードブロックは不要です。

{
  "menu_name": "推定したメニュー名（例: 鶏の唐揚げ定食）",
  "meal_type": "推定食事区分（朝食/昼食/夕食/間食のいずれか）",
  "calories": 推定カロリー(整数kcal),
  "protein_g": タンパク質(g、小数第1位),
  "carbs_g": 炭水化物(g、小数第1位),
  "fat_g": 脂質(g、小数第1位),
  "score": バランススコア(0〜100の整数),
  "advice": "全体のアドバイス（200〜300文字、改行可）。写真から見えるポイント、栄養の良い点・気になる点、姿勢や痛みとの関係、次の食事の提案をまとめる。絵文字を1〜2個使って親しみやすく"
}

【アドバイスの書き方】
- 「写真を拝見しました」で始める
- 良い点を必ず1つ伝える
- 姿勢・痛みとの関係に触れる（例: タンパク質→筋肉→姿勢、糖質過多→炎症→痛み増悪）
- 次の食事のおすすめを具体的に

【注意】
- 写真から食事と判断できない場合は、menu_name を "判定不能" とし、advice に丁寧にその旨を記載
- 食品でない画像の場合も同様に丁寧に返す`;

async function buildUserContext(deviceId: string): Promise<string> {
  if (!deviceId) return "";
  const supabase = getSupabase();
  const { data: users } = await supabase
    .from("users")
    .select("id")
    .eq("device_id", deviceId);
  if (!users || users.length === 0) return "";
  const userId = users[0].id;

  const [symptomRes, postureRes] = await Promise.all([
    supabase
      .from("symptom_selections")
      .select("symptom_id")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("posture_records")
      .select("diagnosis, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1),
  ]);

  const parts: string[] = [];
  const symptoms = symptomRes.data || [];
  if (symptoms.length > 0) {
    const counts: Record<string, number> = {};
    symptoms.forEach((s) => {
      counts[s.symptom_id] = (counts[s.symptom_id] || 0) + 1;
    });
    const sorted = Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);
    const trend = sorted
      .map(([id, c]) => `${SYMPTOM_LABELS[id] || id}(${c}回)`)
      .join("、");
    parts.push(`このユーザーの主な症状傾向: ${trend}`);
  }

  const postures = postureRes.data || [];
  if (postures.length > 0) {
    const latest = postures[0];
    const diag = Array.isArray(latest.diagnosis) ? latest.diagnosis : [];
    const issues = diag
      .filter((d: { level: string }) => d.level !== "good")
      .map((d: { label: string }) => d.label);
    if (issues.length > 0) {
      parts.push(`最近の姿勢診断の気になる点: ${issues.join("、")}`);
    }
  }

  if (parts.length === 0) return "";
  return `\n\n【このユーザーの背景情報】\n${parts.join("\n")}\nこの情報を踏まえて、食事アドバイスに姿勢や痛みとの関連を自然に組み込んでください。`;
}

export async function POST(req: NextRequest) {
  try {
    const { imageData, deviceId } = await req.json();

    if (!imageData || !deviceId) {
      return NextResponse.json(
        { error: "imageData and deviceId required" },
        { status: 400 }
      );
    }

    const supabase = getSupabase();

    // 1. ユーザーID取得 or 作成
    let userId: string;
    const { data: existingUsers } = await supabase
      .from("users")
      .select("id")
      .eq("device_id", deviceId);

    if (existingUsers && existingUsers.length > 0) {
      userId = existingUsers[0].id;
    } else {
      const { data: newUsers, error: insertErr } = await supabase
        .from("users")
        .insert({ device_id: deviceId })
        .select("id");
      if (insertErr || !newUsers || newUsers.length === 0) {
        return NextResponse.json(
          { error: "user creation failed" },
          { status: 500 }
        );
      }
      userId = newUsers[0].id;
    }

    // 1.5 利用制限チェック（無料プランは月3回まで）
    const limitCheck = await checkAndIncrementUsage(supabase, userId, "meal");
    if (!limitCheck.allowed) {
      return NextResponse.json(
        {
          error: "limit_reached",
          feature: "meal",
          usage: limitCheck.usage,
          limit: limitCheck.limit,
          message: `無料プランの食事分析は月${limitCheck.limit}回までです。無制限にするには有料プランにアップグレードしてください。`,
        },
        { status: 402 }
      );
    }

    // 2. 画像をSupabase Storageへアップロード（meal-images バケット）
    const base64 = imageData.replace(/^data:image\/\w+;base64,/, "");
    const buffer = Buffer.from(base64, "base64");
    const timestamp = Date.now();
    const filePath = `${userId}/${timestamp}.jpg`;

    const { error: uploadError } = await supabase.storage
      .from("meal-images")
      .upload(filePath, buffer, {
        contentType: "image/jpeg",
        upsert: false,
      });

    if (uploadError) {
      console.error("Supabase Storage upload error:", uploadError);
      return NextResponse.json(
        {
          error: "upload failed",
          detail: `${uploadError.message} (bucket: meal-images, path: ${filePath})`,
        },
        { status: 500 }
      );
    }

    const { data: urlData } = supabase.storage
      .from("meal-images")
      .getPublicUrl(filePath);
    const imageUrl = urlData.publicUrl;

    // 3. Claude Haiku 3.5 で食事分析（コスト削減のためHaikuを使用）
    const userContext = await buildUserContext(deviceId);
    const client = getClient();

    // 画像はbase64でClaude APIに直接渡す
    const mediaType = imageData.match(/^data:image\/(\w+);base64,/)?.[1]
      ? `image/${imageData.match(/^data:image\/(\w+);base64,/)![1]}`
      : "image/jpeg";

    const response = await client.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 1000,
      system: MEAL_SYSTEM_PROMPT + userContext,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: mediaType as "image/jpeg" | "image/png" | "image/webp" | "image/gif",
                data: base64,
              },
            },
            {
              type: "text",
              text: "この食事の写真を見て、分析結果をJSONで返してください。",
            },
          ],
        },
      ],
    });

    // 4. レスポンスからJSONを抽出
    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      return NextResponse.json(
        { error: "AI応答が空でした" },
        { status: 500 }
      );
    }

    const aiText = textBlock.text;
    const jsonMatch = aiText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json(
        { error: "AI応答の解析に失敗しました", raw: aiText },
        { status: 500 }
      );
    }

    interface MealAnalysis {
      menu_name?: string;
      meal_type?: string;
      calories?: number;
      protein_g?: number;
      carbs_g?: number;
      fat_g?: number;
      score?: number;
      advice?: string;
    }

    let analysis: MealAnalysis;
    try {
      analysis = JSON.parse(jsonMatch[0]) as MealAnalysis;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return NextResponse.json(
        { error: "JSON解析エラー", detail: msg, raw: aiText },
        { status: 500 }
      );
    }

    // 5. Supabaseに保存
    const { data: savedRecord } = await supabase
      .from("meal_records")
      .insert({
        user_id: userId,
        image_url: imageUrl,
        meal_type: analysis.meal_type || null,
        menu_name: analysis.menu_name || null,
        calories: analysis.calories ?? null,
        protein_g: analysis.protein_g ?? null,
        carbs_g: analysis.carbs_g ?? null,
        fat_g: analysis.fat_g ?? null,
        advice: analysis.advice || null,
        score: analysis.score ?? null,
      })
      .select("id, created_at")
      .single();

    return NextResponse.json({
      ok: true,
      id: savedRecord?.id,
      imageUrl,
      analysis,
      createdAt: savedRecord?.created_at,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("Meal API error:", e);
    return NextResponse.json(
      { error: "食事分析に失敗しました", detail: msg },
      { status: 500 }
    );
  }
}

// 食事履歴の取得
export async function GET(req: NextRequest) {
  try {
    const deviceId = req.nextUrl.searchParams.get("deviceId");
    if (!deviceId) {
      return NextResponse.json({ records: [] });
    }

    const supabase = getSupabase();
    const { data: users } = await supabase
      .from("users")
      .select("id")
      .eq("device_id", deviceId);
    if (!users || users.length === 0) {
      return NextResponse.json({ records: [] });
    }
    const userId = users[0].id;

    const { data: records } = await supabase
      .from("meal_records")
      .select(
        "id, image_url, meal_type, menu_name, calories, protein_g, carbs_g, fat_g, advice, score, created_at"
      )
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(30);

    return NextResponse.json({ records: records || [] });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { error: "履歴の取得に失敗しました", detail: msg },
      { status: 500 }
    );
  }
}
