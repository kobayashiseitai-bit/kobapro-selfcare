import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import { SAFE_LANGUAGE_RULES } from "../../lib/safe-language";

import { createServerSupabase } from "../../lib/supabase-server";
import { getSubscriptionState } from "../../lib/subscription";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const revalidate = 0;
export const fetchCache = "force-no-store";

// 読み取りがキャッシュされて古い値が返るのを防ぐため、
// no-store を指定した共通クライアントを使う（supabase-server.ts に経緯あり）
const getSupabase = createServerSupabase;

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

/** ひとことメモの上限（画面の入力欄 maxLength={60} と同じ。どちらも UTF-16 の長さで数える） */
const MAX_BODY_NOTE_LENGTH = 60;
/** AI に呼ばせる名前の上限（users.name は登録時に長さを見ていないため、ここで切る） */
const MAX_CALL_NAME_CHARS = 20;
/** deviceId の上限（ふつうは UUID 程度。巨大な値で DB を叩かせない） */
const MAX_DEVICE_ID_LENGTH = 200;
/**
 * 9/13 以降の新規・未課金の人に AI の一言を作るのは、アプリ全体でその日（日本時間）に
 * 新規・未課金の人へ AI を呼んだ回数がこの件数までのとき。超えたら決まった一言にする
 * （使い捨ての deviceId で大量に呼ばれたときの費用の歯止め。最悪でも1日この回数分）。
 * 回数は app_events の event='checkin_ai_free'（AI を呼ぶ直前にサーバーが1行書く）で数える。下の POST の説明 4.
 */
const NEW_USER_AI_DAILY_CAP = 150;
/**
 * 新規・未課金の人へ AI を呼んだ記録（app_events.event）。
 * サーバー（このファイル）だけが書く。/api/event の ALLOWED_EVENTS には入れないこと（画面から偽って書けないように）
 */
const FREE_AI_LEDGER_EVENT = "checkin_ai_free";

/**
 * 決まった一言（体調の段階ごと）。次のときに AI の代わりに保存して返す（おすすめケアも決まったもの: fixedCareFor）。
 *   - 2026-09-13 以降に登録した未課金の方で、その日の上限（NEW_USER_AI_DAILY_CAP）を超えたとき・回数を数えられなかったとき
 *   - 課金状態を読めなかったとき
 *   - AI が失敗したとき
 * 医療の言葉（治療・診断・症状など）は使わない（lib/safe-language.ts と同じ決まり）。80文字以内・絵文字は1個まで。
 */
const FIXED_MESSAGES_BY_MOOD: Record<number, string> = {
  1: "つらい日は、無理をしないのがいちばんのケアです。深呼吸して、ゆっくり過ごしてくださいね。つらさが続くときは医療機関にも相談を。",
  2: "いまいちな日もありますよね。首や肩をゆっくり回すなど、小さなケアから始めてみましょう。",
  3: "いつもどおりの一日ですね。ときどき背すじを伸ばして、体をラクに保っていきましょう。",
  4: "いい感じですね！この調子で、ストレッチを1つだけ足して、いい流れを続けましょう。",
  5: "絶好調、すばらしいです✨ 続けてきたケアの積み重ねですね。今日も気持ちよく過ごしましょう。",
};
const DEFAULT_FIXED_MESSAGE = "今日も一緒にコツコツやりましょう。無理せず過ごしてくださいね。";
function fixedMessageFor(moodLevel: number): string {
  return FIXED_MESSAGES_BY_MOOD[moodLevel] ?? DEFAULT_FIXED_MESSAGE;
}

type RecommendedCare = { symptomId: string; title: string; reason: string };

/**
 * 決まった「今日のおすすめケア」（2026-10-02）。決まった一言と同じとき（AI を呼ばない・AI が失敗した・
 * AI がケアを返さなかった）に、1〜2件を入れて返す。
 * 以前は空（[]）だったため、9/13 以降の新規の方は「今日のおすすめケア」の欄が毎回出なかった。
 * 登録直後の案内（page.tsx の ONBOARDING_STEPS）は「今日のおすすめケアを選びます」と約束して
 * この体調チェックへ誘導しているので、最初の体験で欠けないようにする。
 * - symptomId は画面（page.tsx の MorningCheckinCard）が onSelectSymptom で開ける6つだけ
 * - title はその画面に実際にあるストレッチの名前（lib/stretches.ts と同じ）
 * - reason は30文字以内・医療の言葉は使わない（決まった一言と同じ決まり）
 */
const FIXED_CARE_BY_MOOD: Record<number, RecommendedCare> = {
  1: { symptomId: "neck", title: "首の横倒しストレッチ", reason: "座ったまま、ゆっくり首を伸ばすだけ" },
  2: { symptomId: "shoulder_stiff", title: "肩回し（前後）", reason: "固まりやすい肩まわりを軽くほぐします" },
  3: { symptomId: "kyphosis", title: "胸開きストレッチ", reason: "丸まりがちな背中と胸をリセット" },
  4: { symptomId: "kyphosis", title: "壁立ちエクササイズ", reason: "いい姿勢の感覚を体に覚えさせます" },
  5: { symptomId: "back", title: "キャット&カウ", reason: "背中をしなやかに動かして好調をキープ" },
};
/**
 * 登録時に選んだ「気になるところ」（users.pain_areas。カンマ区切り）→ 開けるケア。
 * 膝・腕・脚は、対応するケアの画面が無いので出さない
 */
const FIXED_CARE_BY_PAIN_AREA: Record<string, RecommendedCare> = {
  neck: { symptomId: "neck", title: "首の横倒しストレッチ", reason: "登録時に選んだ「首」のケアです" },
  shoulder: { symptomId: "shoulder_stiff", title: "肩回し（前後）", reason: "登録時に選んだ「肩」のケアです" },
  back: { symptomId: "back", title: "膝抱えストレッチ", reason: "登録時に選んだ「腰」のケアです" },
  head: { symptomId: "headache", title: "首の付け根マッサージ", reason: "登録時に選んだ「頭」のケアです" },
  eye: { symptomId: "eye_fatigue", title: "目のパチパチ体操", reason: "登録時に選んだ「目」のケアです" },
};
function fixedCareFor(moodLevel: number, painAreas: unknown): RecommendedCare[] {
  const care: RecommendedCare[] = [];
  if (typeof painAreas === "string") {
    const first = painAreas
      .split(",")
      .map((a) => a.trim())
      .find((a) => a in FIXED_CARE_BY_PAIN_AREA);
    if (first) care.push(FIXED_CARE_BY_PAIN_AREA[first]);
  }
  const byMood = FIXED_CARE_BY_MOOD[moodLevel] ?? FIXED_CARE_BY_MOOD[3];
  if (!care.some((c) => c.symptomId === byMood.symptomId)) care.push(byMood);
  return care.slice(0, 2);
}

/** プロンプトに入れる文から改行・タブなどの制御文字を除く（指示文の行を勝手に足させない） */
function toSingleLine(text: string): string {
  // eslint-disable-next-line no-control-regex
  return text.replace(/[\u0000-\u001f\u007f\u2028\u2029]+/g, " ").trim();
}

/**
 * \u65b0\u898f\u30fb\u672a\u8ab2\u91d1\u306e\u4eba\u3078 AI \u306e\u4e00\u8a00\u3092\u4f5c\u3063\u3066\u3088\u3044\u304b\uff08\u305d\u306e\u65e5\u306e\u4e0a\u9650 NEW_USER_AI_DAILY_CAP \u306e\u78ba\u4fdd\uff09\u3002
 * \u5148\u306b app_events \u30781\u884c\u66f8\u3044\u3066\u304b\u3089\u3001\u65e5\u672c\u6642\u9593\u306e\u305d\u306e\u65e5\u306e 0\u6642\u4ee5\u964d\u306e\u884c\u3092\u6570\u3048\u308b\u3002
 * \u81ea\u5206\u306e1\u884c\u3092\u542b\u3081\u3066\u4e0a\u9650\u4ee5\u4e0b\u306a\u3089 true\u3002\u540c\u6642\u306b\u4f55\u672c\u6765\u3066\u3082\u3001\u4e0a\u9650\u3092\u8d85\u3048\u305f\u9806\u756a\u306e\u5206\u306f false \u306b\u306a\u308b
 * \uff08\u5c11\u306a\u3081\u306b\u5012\u308c\u308b\u3053\u3068\u306f\u3042\u3063\u3066\u3082\u3001\u4e0a\u9650\u3092\u8d85\u3048\u3066 AI \u3092\u547c\u3076\u3053\u3068\u306f\u306a\u3044\uff09\u3002
 * \u66f8\u304d\u8fbc\u307f\u30fb\u6570\u3048\u308b\u306e\u306b\u5931\u6557\u3057\u305f\u3068\u304d\u306f false\uff08\u6c7a\u307e\u3063\u305f\u4e00\u8a00\u306b\u3059\u308b\uff09\u3002
 * app_events.device_id \u306f users \u3068\u3064\u306a\u304c\u3063\u3066\u3044\u306a\u3044\uff08\u5916\u90e8\u30ad\u30fc\u306a\u3057\uff09\u306e\u3067\u3001\u30a2\u30ab\u30a6\u30f3\u30c8\u3092\u6d88\u3057\u3066\u3082\u6570\u306f\u6e1b\u3089\u306a\u3044\u3002
 */
async function claimFreeAiSlot(
  supabase: ReturnType<typeof createServerSupabase>,
  deviceId: string,
  todayJst: string
): Promise<boolean> {
  const { error: insertErr } = await supabase
    .from("app_events")
    .insert({ device_id: deviceId, event: FREE_AI_LEDGER_EVENT, props: { checkin_date: todayJst } });
  if (insertErr) {
    console.error("[checkin] failed to record free AI use, using fixed message:", insertErr.message);
    return false;
  }
  const startOfTodayJst = `${todayJst}T00:00:00+09:00`;
  const { count, error: countErr } = await supabase
    .from("app_events")
    .select("id", { count: "exact", head: true })
    .eq("event", FREE_AI_LEDGER_EVENT)
    .gte("created_at", startOfTodayJst);
  if (countErr || typeof count !== "number") {
    console.error("[checkin] failed to count free AI use, using fixed message:", countErr?.message);
    return false;
  }
  if (count > NEW_USER_AI_DAILY_CAP) {
    console.warn(`[checkin] new-user AI daily cap reached (count=${count}), using fixed message`);
    return false;
  }
  return true;
}

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
 *
 * 2026-10-02: 登録直後の新規の方（未課金）も使える「無料で AI が動く」入口になったため、AI を呼ぶ前に次を確かめる。
 *   1. moodLevel は 1〜5 の整数だけ。bodyNote は文字列だけで、前後の空白を除いて 60 文字まで（超えたら 400）。
 *      プロンプトに入れる名前（users.name）は 20 文字で切る。どちらも改行は空白にする
 *   2. その日の行（daily_checkins）を AI より先に作って「今日の1回分」を確保する。
 *      UNIQUE(user_id, checkin_date) に当たったら 409 を返し、AI は呼ばない。
 *      以前は「確認（SELECT）→ AI → 保存」の順だったので、同時に何本も送ると全部が確認を通り、
 *      保存できない分まで AI の費用がかかっていた。
 *   3. 行を確保できた1本だけが AI を呼び、結果で行を更新する。AI が失敗したときは決まった一言で更新する
 *      （体調の記録は残し、もう一度 AI を呼ばせない）。
 *   4. 有料・トライアル中（家族プランのメンバーを含む）と、2026-09-13 より前に登録した方は、いつも AI の一言。
 *      9/13 以降の新規・未課金の方も AI の一言（社長決定 2026-10-01。費用は承知のうえ）。ただし
 *      deviceId は /api/save に任意の文字列を送るだけで登録でき、アカウントの削除（DELETE /api/account）も
 *      deviceId だけでできるため、「1日1回」の制限だけでは deviceId を使い捨てにして AI を何回でも呼べる
 *      （1回およそ1〜2円）。そこで新規・未課金の方に AI を呼ぶ回数を、アプリ全体で1日 NEW_USER_AI_DAILY_CAP 回までにする。
 *      回数は daily_checkins ではなく app_events（event='checkin_ai_free'）で数える。daily_checkins の行は
 *      アカウントを消すと一緒に消える（ON DELETE CASCADE）ので、登録→体調チェック→削除をくり返すと数が増えず、
 *      上限が効かなかった（2026-10-02）。app_events は users とつながっていないので、削除しても残る。
 *      AI を呼ぶ直前に1行書いてから数える（同時に何本来ても、上限を超えて呼ぶことはない）。
 *      上限を超えたとき・回数を数えられなかったとき・課金状態を読めなかったときは、体調の段階ごとの決まった一言と、
 *      決まったおすすめケア（体調の段階と登録時に選んだ気になるところから1〜2件）を保存して返す（AI は呼ばない）。
 */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => null)) as {
      deviceId?: unknown;
      moodLevel?: unknown;
      bodyNote?: unknown;
    } | null;
    const deviceId = body?.deviceId;
    const moodLevel = body?.moodLevel;
    const rawBodyNote = body?.bodyNote;

    if (
      typeof deviceId !== "string" ||
      deviceId.length === 0 ||
      deviceId.length > MAX_DEVICE_ID_LENGTH ||
      moodLevel === undefined ||
      moodLevel === null
    ) {
      return NextResponse.json(
        { error: "deviceId and moodLevel required" },
        { status: 400 }
      );
    }
    if (typeof moodLevel !== "number" || !Number.isInteger(moodLevel) || moodLevel < 1 || moodLevel > 5) {
      return NextResponse.json(
        { error: "moodLevel must be 1-5" },
        { status: 400 }
      );
    }
    // ひとことメモ: 無し（undefined / null / 空）か、60文字までの文字列だけを受け付ける
    if (rawBodyNote !== undefined && rawBodyNote !== null && typeof rawBodyNote !== "string") {
      return NextResponse.json(
        { error: "bodyNote must be a string" },
        { status: 400 }
      );
    }
    const trimmedNote = typeof rawBodyNote === "string" ? rawBodyNote.trim() : "";
    if (trimmedNote.length > MAX_BODY_NOTE_LENGTH) {
      return NextResponse.json(
        { error: `ひとことは${MAX_BODY_NOTE_LENGTH}文字以内で入力してください` },
        { status: 400 }
      );
    }
    const bodyNote = trimmedNote ? toSingleLine(trimmedNote) : "";

    const supabase = getSupabase();
    const { data: users } = await supabase
      .from("users")
      .select("id, name, age, created_at, pain_areas")
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

    // すでに今日チェックイン済みの場合はスキップ（ふつうの二度押しはここで返す）
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

    // ========= 今日の1回分を先に確保する（AI はこの行を作れた1本だけが呼ぶ） =========
    // ai_message は AI の結果が出るまで空（null）。画面は ai_message が無ければ一言の欄を出さない
    const { data: reserved, error: reserveErr } = await supabase
      .from("daily_checkins")
      .insert({
        user_id: userId,
        checkin_date: todayJst,
        mood_level: moodLevel,
        body_note: bodyNote || null,
        ai_message: null,
        recommended_care: null,
      })
      .select()
      .single();

    if (reserveErr || !reserved) {
      // 同時に送られた別の1本が先に行を作った（UNIQUE(user_id, checkin_date) 違反）
      if (reserveErr?.code === "23505") {
        return NextResponse.json(
          { error: "already checked in today" },
          { status: 409, headers: NO_CACHE_HEADERS }
        );
      }
      return NextResponse.json(
        { error: "insert failed", detail: reserveErr?.message },
        { status: 500, headers: NO_CACHE_HEADERS }
      );
    }

    // AI を呼ばない・AI が失敗した・AI がケアを返さなかったときは、決まった一言と決まったおすすめケアになる
    let aiMessage = fixedMessageFor(moodLevel);
    let recommendedCare: RecommendedCare[] = fixedCareFor(moodLevel, user.pain_areas);

    // AI を呼んでよい人か（説明の 4.）。読めなかったときは呼ばない
    // - 有料・トライアル中・旧ユーザー（2026-09-13 より前の登録）: いつも AI の一言
    // - 9/13 以降の新規・未課金: これも AI の一言（社長決定 2026-10-01: 登録直後の最初の一歩を体調チェックにし、
    //   先生の返事が無料で届く体験にする。費用は承知のうえ）。ただし deviceId は認証なしで作れて消せるので、
    //   使い捨ての deviceId で何度も呼ばれても費用に上限が掛かるよう、新規・未課金の人へ AI を呼んだ回数
    //   （app_events の checkin_ai_free。アカウントを消しても消えない）がアプリ全体のその日に
    //   NEW_USER_AI_DAILY_CAP を超えたら、決まった一言にする（本当の新規は1日数人なので当たらない）
    let useAi = false;
    try {
      const subState = await getSubscriptionState(supabase, userId);
      if (subState.isPaid || subState.isLegacyUser) {
        useAi = true;
      } else {
        useAi = await claimFreeAiSlot(supabase, deviceId, todayJst);
      }
    } catch (stateErr) {
      console.error("[checkin] failed to load subscription state, using fixed message:", stateErr);
    }

    if (useAi) {
      try {
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
          // 今日の行は上で作ったばかりなので除く（「過去7日の平均」に今日を混ぜない）
          supabase
            .from("daily_checkins")
            .select("mood_level, checkin_date")
            .eq("user_id", userId)
            .lt("checkin_date", todayJst)
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
        // AIに呼ばせる名前。このお客様の名前（users.name）に「さん」を付ける。名前が無いときは「あなた」
        // （以前は指示文の一部に別の人の名前が固定で入っていたので、すべてここから作る）
        // users.name は登録時に長さを見ていないので、改行を除いて20文字（絵文字なども1文字）で切る
        const trimmedName =
          typeof user.name === "string"
            ? Array.from(toSingleLine(user.name)).slice(0, MAX_CALL_NAME_CHARS).join("").trim()
            : "";
        const callName = trimmedName ? `${trimmedName}さん` : "あなた";

        // 関係性レベルで口調を変える（chat/route.ts と統一）
        let toneInstruction = "";
        if (daysSinceRegistration <= 3) {
          toneInstruction = `丁寧な敬語で話す。「〜ですね」「〜ましょう」のような初対面の温かさ。「${callName}」と呼ぶ。`;
        } else if (daysSinceRegistration <= 14) {
          toneInstruction = `親しみのある敬語。時々「〜だね」も混ぜる。「${callName}」と呼ぶ。`;
        } else if (daysSinceRegistration <= 30) {
          toneInstruction = `親しい友人のような口調。「${callName}、」と呼びかけて始める。敬語と「〜だね」混在。`;
        } else {
          toneInstruction = `気の置けない関係。タメ口も混ぜる。「${callName}、〜してね」「〜だよ」。これまでの継続への敬意を込めて。`;
        }

        const analysisPrompt = `あなたは「ガイコツ先生」、ZERO-PAINセルフケアアプリ専属のAIカイロプラクターです。
生前は30年間、1万人の体を整えてきた名カイロプラクター。骨だけになった今もユーザーを大切に見守っています。

【今日のチェックイン】
- ユーザー: ${callName}
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
- ${callName}の今日の気持ちに共感してから、今日のおすすめを1つ提案

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
          model: "claude-sonnet-5",
          // Sonnet 5 は既定で adaptive thinking ON。小さな max_tokens だと本文が途切れるため無効化（4.5時代と同じ挙動）
          thinking: { type: "disabled" },
          max_tokens: 500,
          system: SAFE_LANGUAGE_RULES,
          messages: [{ role: "user", content: analysisPrompt }],
        });

        const text =
          response.content[0]?.type === "text" ? response.content[0].text : "";

        try {
          const match = text.match(/\{[\s\S]*\}/);
          if (match) {
            const parsed = JSON.parse(match[0]);
            if (typeof parsed.message === "string" && parsed.message.trim()) aiMessage = parsed.message;
            if (Array.isArray(parsed.recommendedCare) && parsed.recommendedCare.length > 0) {
              recommendedCare = parsed.recommendedCare.slice(0, 2);
            }
          }
        } catch {
          /* フォールバック */
        }
      } catch (aiErr) {
        // AI（または過去データの読み込み）が失敗しても、体調の記録は残して決まった一言を返す。
        // 行を消してやり直させると、そのたびに AI を呼ばせることになるため
        console.error("[checkin] AI message generation failed, using fallback:", aiErr);
      }
    }

    // 確保した行に AI の結果を書き込む
    const { data: saved, error: updateErr } = await supabase
      .from("daily_checkins")
      .update({
        ai_message: aiMessage,
        recommended_care: recommendedCare,
      })
      .eq("id", reserved.id)
      .select()
      .single();

    if (updateErr || !saved) {
      // 体調の記録はできている。一言だけ保存できなかったので、今回の画面には結果をそのまま返す
      console.error("[checkin] failed to save AI message:", updateErr);
      return NextResponse.json(
        {
          ok: true,
          checkin: { ...reserved, ai_message: aiMessage, recommended_care: recommendedCare },
        },
        { headers: NO_CACHE_HEADERS }
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
