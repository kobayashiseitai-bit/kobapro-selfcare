import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const revalidate = 0;
export const fetchCache = "force-no-store";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
  );
}

function getClient() {
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
}

const SYMPTOM_LABELS: Record<string, string> = {
  neck: "首こり",
  shoulder_stiff: "肩こり",
  back: "腰痛",
  headache: "頭痛",
  eye_fatigue: "眼精疲労",
  kyphosis: "猫背",
};

const MOOD_LABELS: Record<number, string> = {
  1: "つらい",
  2: "いまいち",
  3: "普通",
  4: "いい感じ",
  5: "絶好調",
};

const NO_CACHE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, private",
  Pragma: "no-cache",
  Expires: "0",
};

/**
 * GET /api/checkin?deviceId=xxx
 * 今日のチェックイン状態を取得
 */
export async function GET(req: NextRequest) {
  try {
    const deviceId = req.nextUrl.searchParams.get("deviceId");
    if (!deviceId) {
      return NextResponse.json({ error: "deviceId required" }, { status: 400 });
    }

    const supabase = getSupabase();
    const { data: users } = await supabase
      .from("users")
      .select("id, name, created_at")
      .eq("device_id", deviceId);

    if (!users || users.length === 0) {
      return NextResponse.json(
        { hasToday: false, checkin: null, userFound: false },
        { headers: NO_CACHE_HEADERS }
      );
    }

    const user = users[0];

    // 今日の日付（JST）を YYYY-MM-DD で取得
    const now = new Date();
    const jstOffsetMs = 9 * 60 * 60 * 1000;
    const todayJst = new Date(now.getTime() + jstOffsetMs)
      .toISOString()
      .slice(0, 10);

    const { data: checkin } = await supabase
      .from("daily_checkins")
      .select("*")
      .eq("user_id", user.id)
      .eq("checkin_date", todayJst)
      .maybeSingle();

    // 登録からの経過日数を計算（キャラクター深化で使用）
    const registeredAt = new Date(user.created_at);
    const daysSinceRegistration = Math.floor(
      (Date.now() - registeredAt.getTime()) / (1000 * 60 * 60 * 24)
    );

    return NextResponse.json(
      {
        hasToday: !!checkin,
        checkin,
        userFound: true,
        userName: user.name,
        daysSinceRegistration,
        todayJst,
      },
      { headers: NO_CACHE_HEADERS }
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { error: "failed to load checkin", detail: msg },
      { status: 500 }
    );
  }
}

/**
 * POST /api/checkin
 * 今日のチェックインを保存＋ガイコツ先生のコメントを生成
 * Body: { deviceId, moodLevel: 1-5, bodyNote?: string }
 */
export async function POST(req: NextRequest) {
  try {
    const { deviceId, moodLevel, bodyNote } = await req.json();
    if (!deviceId || !moodLevel) {
      return NextResponse.json(
        { error: "deviceId and moodLevel required" },
        { status: 400 }
      );
    }
    if (moodLevel < 1 || moodLevel > 5) {
      return NextResponse.json(
        { error: "moodLevel must be 1-5" },
        { status: 400 }
      );
    }

    const supabase = getSupabase();
    const { data: users } = await supabase
      .from("users")
      .select("id, name, age, created_at")
      .eq("device_id", deviceId);

    if (!users || users.length === 0) {
      return NextResponse.json({ error: "user not found" }, { status: 404 });
    }
    const user = users[0];
    const userId = user.id;

    // 今日の日付（JST）
    const now = new Date();
    const jstOffsetMs = 9 * 60 * 60 * 1000;
    const todayJst = new Date(now.getTime() + jstOffsetMs)
      .toISOString()
      .slice(0, 10);

    // すでに今日チェックイン済みの場合はスキップ
    const { data: existing } = await supabase
      .from("daily_checkins")
      .select("id")
      .eq("user_id", userId)
      .eq("checkin_date", todayJst)
      .maybeSingle();

    if (existing) {
      return NextResponse.json(
        { error: "already checked in today" },
        { status: 409 }
      );
    }

    // ========= ユーザーの過去データを取得（パーソナライズ用） =========
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const [symptomRes, postureRes, checkinHistoryRes] = await Promise.all([
      supabase
        .from("symptom_selections")
        .select("symptom_id, created_at")
        .eq("user_id", userId)
        .gte("created_at", sevenDaysAgo)
        .order("created_at", { ascending: false })
        .limit(20),
      supabase
        .from("posture_records")
        .select("diagnosis, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(1),
      supabase
        .from("daily_checkins")
        .select("mood_level, checkin_date")
        .eq("user_id", userId)
        .order("checkin_date", { ascending: false })
        .limit(7),
    ]);

    const symptoms = symptomRes.data || [];
    const symptomCounts: Record<string, number> = {};
    symptoms.forEach((s) => {
      symptomCounts[s.symptom_id] = (symptomCounts[s.symptom_id] || 0) + 1;
    });
    const topSymptoms = Object.entries(symptomCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);

    const postureIssues: string[] = [];
    const latestPosture = (postureRes.data || [])[0];
    if (latestPosture && Array.isArray(latestPosture.diagnosis)) {
      latestPosture.diagnosis.forEach((d: { level: string; label: string }) => {
        if (d.level !== "good") postureIssues.push(d.label);
      });
    }

    // 登録からの経過日数
    const registeredAt = new Date(user.created_at);
    const daysSinceRegistration = Math.floor(
      (Date.now() - registeredAt.getTime()) / (1000 * 60 * 60 * 24)
    );

    // 過去のチェックイン傾向
    const pastMoods = (checkinHistoryRes.data || []).map((c) => c.mood_level);
    const avgMood =
      pastMoods.length > 0
        ? (pastMoods.reduce((a, b) => a + b, 0) / pastMoods.length).toFixed(1)
        : null;

    // ========= Claude でパーソナライズメッセージ生成 =========
    const moodLabel = MOOD_LABELS[moodLevel];
    const userName = user.name || "あなた";

    // 関係性レベルで口調を変える
    let toneInstruction = "";
    if (daysSinceRegistration <= 7) {
      toneInstruction = "丁寧な敬語で話す。「〜ですね」「〜ましょう」のような初対面の温かさ。";
    } else if (daysSinceRegistration <= 30) {
      toneInstruction = "親しみのある敬語。時々「〜だね」も混ぜる。";
    } else if (daysSinceRegistration <= 100) {
      toneInstruction = "親しい友人のような口調。名前で呼ぶ。「小林さん、〜ですよ」";
    } else {
      toneInstruction = "長年の付き合いのような信頼感。タメ口も混ぜる。「小林さん、〜してね」";
    }

    const analysisPrompt = `あなたは「ガイコツ先生」、ZERO-PAINセルフケアアプリ専属のAIカイロプラクターです。
生前は30年間、1万人の体を整えてきた名カイロプラクター。骨だけになった今もユーザーを大切に見守っています。

【今日のチェックイン】
- ユーザー: ${userName}さん
- 体調: ${moodLevel}/5（${moodLabel}）
- 一言: ${bodyNote || "（未入力）"}
- 登録から: ${daysSinceRegistration}日目
- 過去7日の平均体調: ${avgMood || "（初回）"}

【過去のデータ】
- よくあるお悩み: ${topSymptoms.map(([id, c]) => `${SYMPTOM_LABELS[id] || id}(${c}回)`).join("、") || "（まだ記録なし）"}
- 最新の姿勢チェックで気になった点: ${postureIssues.join("、") || "（まだなし）"}

【あなたの話し方】
${toneInstruction}

【返答ルール（絶対守る）】
- 「症状」「診断」「治療」「治る」「病気」などの医療用語は使わない
- 代わりに「お悩み」「チェック」「ケア」「ラクになる」「不調」を使う
- 80文字以内の一言メッセージ（改行なし）
- 体調に寄り添う温かさを大切に
- 絵文字は1個まで
- 小林さんの今日の気持ちに共感してから、今日のおすすめを1つ提案

【出力形式】
以下のJSON形式だけを返してください。他の文章は不要。

{
  "message": "ガイコツ先生からの一言（80文字以内）",
  "recommendedCare": [
    {"symptomId": "neck/shoulder_stiff/back/headache/eye_fatigue/kyphosis のどれか", "title": "ケア名（例: 首の横倒しストレッチ）", "reason": "なぜこれがおすすめか（30文字以内）"}
  ]
}

recommendedCare は1〜2個まで。体調が ${moodLabel} ならそれに合うケアを選ぶこと。`;

    const client = getClient();
    const response = await client.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 500,
      messages: [{ role: "user", content: analysisPrompt }],
    });

    const text =
      response.content[0].type === "text" ? response.content[0].text : "";

    let aiMessage = "今日も一緒にコツコツやりましょう。無理せず過ごしてくださいね。";
    let recommendedCare: Array<{ symptomId: string; title: string; reason: string }> = [];

    try {
      const match = text.match(/\{[\s\S]*\}/);
      if (match) {
        const parsed = JSON.parse(match[0]);
        if (parsed.message) aiMessage = parsed.message;
        if (Array.isArray(parsed.recommendedCare)) {
          recommendedCare = parsed.recommendedCare.slice(0, 2);
        }
      }
    } catch {
      /* フォールバック */
    }

    // 保存
    const { data: saved, error: insertErr } = await supabase
      .from("daily_checkins")
      .insert({
        user_id: userId,
        checkin_date: todayJst,
        mood_level: moodLevel,
        body_note: bodyNote || null,
        ai_message: aiMessage,
        recommended_care: recommendedCare,
      })
      .select()
      .single();

    if (insertErr) {
      return NextResponse.json(
        { error: "insert failed", detail: insertErr.message },
        { status: 500, headers: NO_CACHE_HEADERS }
      );
    }

    return NextResponse.json(
      {
        ok: true,
        checkin: saved,
      },
      { headers: NO_CACHE_HEADERS }
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("Checkin error:", e);
    return NextResponse.json(
      { error: "checkin failed", detail: msg },
      { status: 500, headers: NO_CACHE_HEADERS }
    );
  }
}
