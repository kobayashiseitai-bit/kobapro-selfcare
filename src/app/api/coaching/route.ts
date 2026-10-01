import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import { SAFE_LANGUAGE_RULES } from "../../lib/safe-language";
import { buildLimitReachedMessage, getSubscriptionState } from "../../lib/subscription";

import { createServerSupabase } from "../../lib/supabase-server";

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

const NO_CACHE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, private",
  Pragma: "no-cache",
  Expires: "0",
};

const SYMPTOM_LABELS: Record<string, string> = {
  neck: "首こり",
  shoulder_stiff: "肩こり",
  back: "腰痛",
  headache: "頭痛",
  eye_fatigue: "眼精疲労",
  kyphosis: "猫背",
};

const GOAL_LABELS: Record<string, string> = {
  posture: "🧍 姿勢改善（猫背・反り腰）",
  pain: "💊 痛み軽減（首・肩・腰）",
  weight: "⚖️ 体重管理（理想体型へ）",
  fitness: "💪 体力アップ・運動習慣",
  wellness: "🌿 全体的な健康づくり",
};

// ===== 開始（action=start）の歯止め（2026-10-02） =====
// 開始は claude-sonnet-5 に最大 8000 トークンを書かせる、アプリで一番大きい AI の呼び出し。
// 以前は課金も回数も確かめずに呼んでいたので、未課金の方でも「中止 → 開始」を繰り返すたびに費用がかかり、
// /api/save が自動で作る deviceId から、長い goalText を入れて何度でも呼べた。

/** 具体的な希望（goalText）の上限。超えたら 400 */
const MAX_GOAL_TEXT_LENGTH = 100;
/** 1か月に始められる回数（作り終えたプログラム。中止したものも数える） */
const MAX_STARTS_PER_MONTH = 3;
/** 1か月に AI を呼べる回数（作るのに失敗した分も含む）。失敗の繰り返しで費用が積み上がらないようにする */
const MAX_ATTEMPTS_PER_MONTH = 6;
/**
 * 作成中（status=generating）の行を「まだ作っている」とみなす時間。
 * これより古い作成中の行は、途中で止まった（時間切れなど）とみなし、次の開始を止めない
 */
const GENERATING_STALE_MS = 15 * 60 * 1000;
/** 作り終えたプログラムの状態（月の回数に数える）。generating / failed は数えない */
const STARTED_STATUSES = new Set(["active", "completed", "abandoned", "paused"]);

/** プロンプトに入れる文から改行・タブなどの制御文字を除く（指示文の行を勝手に足させない。/api/checkin と同じ） */
function toSingleLine(text: string): string {
  // eslint-disable-next-line no-control-regex
  return text.replace(/[\u0000-\u001f\u007f\u2028\u2029]+/g, " ").trim();
}

/**
 * 進行中のプログラム（active）と、作成中（generating、GENERATING_STALE_MS 以内）の行を返す。
 * 読み込みに失敗したら例外（「無い」と扱って AI を呼ばないため）
 */
async function listInFlightPrograms(
  supabase: ReturnType<typeof getSupabase>,
  userId: string
): Promise<Array<{ id: string; status: string; created_at: string }>> {
  const { data, error } = await supabase
    .from("coaching_programs")
    .select("id, status, created_at")
    .eq("user_id", userId)
    .in("status", ["active", "generating"])
    .order("created_at", { ascending: true })
    .limit(20);
  if (error) {
    throw new Error(`failed to load coaching programs: ${error.message}`);
  }
  const staleBefore = Date.now() - GENERATING_STALE_MS;
  return (data || []).filter(
    (p) => p.status === "active" || new Date(p.created_at).getTime() >= staleBefore
  );
}

interface UserProfile {
  id: string;
  name: string | null;
  age: number | null;
  height_cm: number | null;
  weight_kg: number | null;
  gender: string | null;
}

interface CoachingTask {
  day_number: number;
  scheduled_date: string;
  category: "stretch" | "meal" | "mindset" | "check" | "reading";
  title: string;
  description: string;
  symptom_id: string | null;
  estimated_minutes: number;
}

async function getUserProfile(
  supabase: ReturnType<typeof getSupabase>,
  deviceId: string
): Promise<UserProfile | null> {
  const { data } = await supabase
    .from("users")
    .select("id, name, age, height_cm, weight_kg, gender")
    .eq("device_id", deviceId)
    .maybeSingle();
  return data || null;
}

/**
 * AIに30日プランを生成させる
 */
async function generateCoachingPlan(
  user: UserProfile,
  goalType: string,
  goalText: string,
  symptoms: Record<string, number>,
  postureIssues: string[]
): Promise<{
  summary: string;
  advice: string;
  tasks: Omit<CoachingTask, "scheduled_date">[];
}> {
  const goalLabel = GOAL_LABELS[goalType] || goalText;
  // users.name は登録時に長さを見ていないので、プロンプトに入れる前に1行・20文字に切る（/api/checkin と同じ）
  const promptName = user.name
    ? Array.from(toSingleLine(user.name)).slice(0, 20).join("").trim()
    : "";
  const symptomLines = Object.entries(symptoms)
    .map(([id, count]) => `${SYMPTOM_LABELS[id] || id}(${count}回)`)
    .join("、");

  const prompt = `あなたは「ガイコツ先生」、ZERO-PAINセルフケアアプリ専属のAIカイロプラクターです。
ユーザーが新しく30日コーチングプログラムを開始しようとしています。
ユーザーの背景データを元に、実行可能で効果のある30日プランを生成してください。

【ユーザー情報】
- お名前: ${promptName || "ユーザー"}さん
- 年齢: ${user.age || "不明"}歳
- 身長: ${user.height_cm || "不明"}cm / 体重: ${user.weight_kg || "不明"}kg
- 性別: ${user.gender || "不明"}

【ゴール】
${goalLabel}
${goalText && goalText !== goalLabel ? `（具体的な希望: ${goalText}）` : ""}

【過去のお悩み傾向】
${symptomLines || "（記録なし）"}

【最近の姿勢診断で気になった点】
${postureIssues.join("、") || "（特になし）"}

【30日プランの構成ルール】
- 全30タスク（1日1タスク）
- 各タスクは5〜10分以内で完了できる現実的なもの
- カテゴリは以下のいずれか:
  - stretch: ストレッチ・体操（symptom_idで該当部位を指定可）
  - meal: 食事・栄養に関するアドバイス
  - mindset: 心構え・モチベーション
  - check: 自分の状態をチェックする
  - reading: 知識を学ぶ短い読み物

- 1〜10日目: 基礎づくり期（習慣化フォーカス、簡単な内容）
- 11〜20日目: 強化期（種類を増やし、効果を実感）
- 21〜30日目: 応用期（パーソナライズ、未来へ向けて）

- ストレッチを多めに（30タスクの半分程度）
- 週1回はチェックタスク、週1回は食事関連
- ゴールタイプに応じて重み付け

【symptom_id の選択肢】
neck / shoulder_stiff / back / headache / eye_fatigue / kyphosis

【出力フォーマット】
以下の JSON 形式で回答してください。他の文章は不要です。

{
  "summary": "プログラム概要（80文字以内、具体的なゴールイメージ）",
  "advice": "ガイコツ先生からの励ましメッセージ（150文字以内、温かく）",
  "tasks": [
    {
      "day_number": 1,
      "category": "stretch",
      "title": "首の横倒しストレッチ（30秒×左右）",
      "description": "詳細説明（80文字以内）",
      "symptom_id": "neck",
      "estimated_minutes": 5
    },
    ... 全30タスク ...
  ]
}

【ルール】
- 「症状」「診断」「治療」などの医療用語は使わず、「お悩み」「チェック」「ケア」と表現
- titleは30文字以内、descriptionは80文字以内
- symptom_idは stretch カテゴリでのみ使用（他のカテゴリでは null）
- 必ず30日分（day_number 1〜30）すべてを生成`;

  const client = getClient();
  const response = await client.messages.create({
    model: "claude-sonnet-5",
      // Sonnet 5 は既定で adaptive thinking ON。小さな max_tokens だと本文が途切れるため無効化（4.5時代と同じ挙動）
      thinking: { type: "disabled" },
    max_tokens: 8000,
    system: SAFE_LANGUAGE_RULES,
    messages: [{ role: "user", content: prompt }],
  });

  const text =
    response.content[0].type === "text" ? response.content[0].text : "";

  // JSON部分を抽出
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) {
    throw new Error("AI応答の解析に失敗しました");
  }

  const parsed = JSON.parse(match[0]);

  if (!Array.isArray(parsed.tasks) || parsed.tasks.length === 0) {
    throw new Error("タスクが生成されませんでした");
  }

  return {
    summary: parsed.summary || "あなた専用の30日プログラムです",
    advice: parsed.advice || "今日も一緒にコツコツやりましょう！",
    tasks: parsed.tasks.slice(0, 30).map((t: Partial<CoachingTask>) => ({
      day_number: t.day_number || 1,
      category: t.category || "stretch",
      title: t.title || "タスク",
      description: t.description || "",
      symptom_id: t.symptom_id || null,
      estimated_minutes: t.estimated_minutes || 5,
    })),
  };
}

/**
 * GET /api/coaching?deviceId=xxx
 * 現在のアクティブプログラム + 今日の課題を返す
 */
export async function GET(req: NextRequest) {
  try {
    const deviceId = req.nextUrl.searchParams.get("deviceId");
    if (!deviceId) {
      return NextResponse.json({ error: "deviceId required" }, { status: 400 });
    }

    const supabase = getSupabase();
    const user = await getUserProfile(supabase, deviceId);
    if (!user) {
      return NextResponse.json(
        { hasProgram: false, reason: "user_not_found" },
        { headers: NO_CACHE_HEADERS }
      );
    }

    // アクティブなプログラムを取得
    const { data: program } = await supabase
      .from("coaching_programs")
      .select("*")
      .eq("user_id", user.id)
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!program) {
      return NextResponse.json(
        { hasProgram: false },
        { headers: NO_CACHE_HEADERS }
      );
    }

    // 今日の日付（JST）
    const now = new Date();
    const jstOffsetMs = 9 * 60 * 60 * 1000;
    const todayJst = new Date(now.getTime() + jstOffsetMs)
      .toISOString()
      .slice(0, 10);

    // 全タスクを取得
    const { data: allTasks } = await supabase
      .from("coaching_tasks")
      .select("*")
      .eq("program_id", program.id)
      .order("day_number", { ascending: true });

    const tasks = allTasks || [];
    const todayTask = tasks.find((t) => t.scheduled_date === todayJst);
    const completedCount = tasks.filter((t) => t.completed_at).length;
    const currentDayNumber = todayTask?.day_number || 0;

    // 進捗パーセンテージ
    const progressPercent = Math.round((completedCount / program.total_days) * 100);

    return NextResponse.json(
      {
        hasProgram: true,
        program: {
          id: program.id,
          status: program.status,
          goalType: program.goal_type,
          goalText: program.goal_text,
          summary: program.ai_summary,
          advice: program.ai_advice,
          startDate: program.start_date,
          endDate: program.end_date,
          totalDays: program.total_days,
          createdAt: program.created_at,
        },
        todayTask: todayTask
          ? {
              id: todayTask.id,
              dayNumber: todayTask.day_number,
              category: todayTask.category,
              title: todayTask.title,
              description: todayTask.description,
              symptomId: todayTask.symptom_id,
              estimatedMinutes: todayTask.estimated_minutes,
              completed: !!todayTask.completed_at,
            }
          : null,
        progress: {
          completedCount,
          totalDays: program.total_days,
          progressPercent,
          currentDayNumber,
        },
        allTasks: tasks.map((t) => ({
          id: t.id,
          dayNumber: t.day_number,
          scheduledDate: t.scheduled_date,
          category: t.category,
          title: t.title,
          description: t.description,
          symptomId: t.symptom_id,
          estimatedMinutes: t.estimated_minutes,
          completed: !!t.completed_at,
          completedAt: t.completed_at,
        })),
      },
      { headers: NO_CACHE_HEADERS }
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { error: "failed to load coaching", detail: msg },
      { status: 500 }
    );
  }
}

/**
 * POST /api/coaching
 * Body: { action, deviceId, ... }
 *
 * action:
 *   - "start": 新しいプログラムを開始 { goalType, goalText? }
 *   - "complete": タスクを完了 { taskId }
 *   - "abandon": プログラムを中止
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, deviceId } = body;
    if (!action || !deviceId) {
      return NextResponse.json(
        { error: "action and deviceId required" },
        { status: 400 }
      );
    }

    const supabase = getSupabase();
    const user = await getUserProfile(supabase, deviceId);
    if (!user) {
      return NextResponse.json({ error: "user not found" }, { status: 404 });
    }

    // ========== START: 新しいプログラム開始 ==========
    // 2026-10-02: AI を呼ぶ前に、次をこの順で確かめる（上の「開始の歯止め」の説明）。
    //   1. goalType は GOAL_LABELS のキーだけ。goalText（任意）は文字列で、前後の空白を除いて 100 文字まで（超えたら 400）
    //   2. 有料・トライアル中の方と、2026-09-13 より前に登録した方（以前から無料で使えていた方の利用は止めない・社長未決定のため現状維持）。
    //      それ以外（9/13 以降の新規で未課金）は 402 と案内文
    //   3. 進行中・作成中のプログラムがあれば 409
    //   4. 今月の開始が MAX_STARTS_PER_MONTH 回、または AI の呼び出しが MAX_ATTEMPTS_PER_MONTH 回に達していれば 429
    //   5. 「作成中」の行を先に作ってから、ほかに進行中・作成中の行が無いことを確かめ直す。
    //      同時に何本も送られても、AI を呼ぶのは1本だけにする（ほかに行が見えたら自分の行を消して 409）
    //   6. AI が失敗したら、その行を failed にして残す（今月の AI の呼び出し回数に数える）
    if (action === "start") {
      const { goalType, goalText: rawGoalText } = body as {
        goalType?: unknown;
        goalText?: unknown;
      };
      if (
        typeof goalType !== "string" ||
        !Object.prototype.hasOwnProperty.call(GOAL_LABELS, goalType)
      ) {
        return NextResponse.json(
          { error: "invalid_goal_type" },
          { status: 400, headers: NO_CACHE_HEADERS }
        );
      }
      if (
        rawGoalText !== undefined &&
        rawGoalText !== null &&
        typeof rawGoalText !== "string"
      ) {
        return NextResponse.json(
          { error: "goalText must be a string" },
          { status: 400, headers: NO_CACHE_HEADERS }
        );
      }
      const trimmedGoalText = typeof rawGoalText === "string" ? rawGoalText.trim() : "";
      if (trimmedGoalText.length > MAX_GOAL_TEXT_LENGTH) {
        return NextResponse.json(
          {
            error: "goal_text_too_long",
            message: `ゴールの説明は${MAX_GOAL_TEXT_LENGTH}文字以内で入力してください。`,
          },
          { status: 400, headers: NO_CACHE_HEADERS }
        );
      }
      const goalLabel = GOAL_LABELS[goalType];
      const goalText = trimmedGoalText ? toSingleLine(trimmedGoalText) : goalLabel;

      // 有料・トライアル中（家族プランの家族・審査用アカウントを含む）の方と、
      // 2026-09-13 より前に登録した方（以前から無料で始められていた）が始められる。
      // 旧ユーザーにも有料にするかは社長の判断待ちなので、今は今までどおりにしておく（月の回数の上限は下で掛かる）
      const subState = await getSubscriptionState(supabase, user.id);
      if (!subState.isPaid && !subState.isLegacyUser) {
        return NextResponse.json(
          {
            error: "limit_reached",
            feature: "coaching",
            limit: 0,
            message: buildLimitReachedMessage("coaching", 0),
          },
          { status: 402, headers: NO_CACHE_HEADERS }
        );
      }

      // 進行中・作成中のプログラムがあれば始めない
      const inFlight = await listInFlightPrograms(supabase, user.id);
      if (inFlight.length > 0) {
        const generating = inFlight.some((p) => p.status === "generating");
        return NextResponse.json(
          generating
            ? {
                error: "generating",
                message: "ただいま30日プログラムを作っています。1分ほどおいてから、画面を開き直してください。",
              }
            : {
                error: "already_active",
                message: "進行中のプログラムがあります。新しく始めるときは、先に今のプログラムを中止してください。",
              },
          { status: 409, headers: NO_CACHE_HEADERS }
        );
      }

      // 今月の回数（サーバーの月の区切り。/api/subscription の利用回数と同じ数え方）
      const nowForMonth = new Date();
      const monthStartIso = new Date(
        nowForMonth.getFullYear(),
        nowForMonth.getMonth(),
        1
      ).toISOString();
      const { data: monthRows, error: monthErr } = await supabase
        .from("coaching_programs")
        .select("status")
        .eq("user_id", user.id)
        .gte("created_at", monthStartIso)
        .limit(100);
      if (monthErr) {
        throw new Error(`failed to count coaching programs: ${monthErr.message}`);
      }
      const attemptsThisMonth = (monthRows || []).length;
      const startsThisMonth = (monthRows || []).filter((r) =>
        STARTED_STATUSES.has(r.status)
      ).length;
      if (
        startsThisMonth >= MAX_STARTS_PER_MONTH ||
        attemptsThisMonth >= MAX_ATTEMPTS_PER_MONTH
      ) {
        return NextResponse.json(
          {
            error: "monthly_limit",
            message: `30日プログラムを新しく始められるのは、月に${MAX_STARTS_PER_MONTH}回までです。来月になるとまた始められます。`,
          },
          { status: 429, headers: NO_CACHE_HEADERS }
        );
      }

      // 日付（日本時間）
      const startDate = new Date();
      const jstOffsetMs = 9 * 60 * 60 * 1000;
      const startDateJst = new Date(startDate.getTime() + jstOffsetMs)
        .toISOString()
        .slice(0, 10);
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 29);
      const endDateJst = new Date(endDate.getTime() + jstOffsetMs)
        .toISOString()
        .slice(0, 10);

      // 「作成中」の行を先に作る（AI はこの行を作れて、ほかに行が無かった1本だけが呼ぶ）
      const { data: program, error: programErr } = await supabase
        .from("coaching_programs")
        .insert({
          user_id: user.id,
          status: "generating",
          goal_type: goalType,
          goal_text: goalText,
          start_date: startDateJst,
          end_date: endDateJst,
        })
        .select()
        .single();

      if (programErr || !program) {
        return NextResponse.json(
          {
            error: "program_create_failed",
            detail: programErr?.message,
            message: "30日プログラムを始められませんでした。時間をおいて、もう一度お試しください。",
          },
          { status: 500, headers: NO_CACHE_HEADERS }
        );
      }

      // 自分の行を作ったあとで、ほかに進行中・作成中の行が無いか確かめ直す。
      // ほかの行が見えたら、どちらが先かに関係なく自分は引く（AI を呼ばない）。
      // 同時の2本は、少なくとも片方が必ずもう片方の行を見るので、2本とも AI を呼ぶことは無い。
      let othersInFlight: Array<{ id: string }> = [];
      try {
        othersInFlight = (await listInFlightPrograms(supabase, user.id)).filter(
          (p) => p.id !== program.id
        );
      } catch (e) {
        await supabase.from("coaching_programs").delete().eq("id", program.id);
        throw e;
      }
      if (othersInFlight.length > 0) {
        await supabase.from("coaching_programs").delete().eq("id", program.id);
        return NextResponse.json(
          {
            error: "generating",
            message: "ただいま30日プログラムを作っています。1分ほどおいてから、画面を開き直してください。",
          },
          { status: 409, headers: NO_CACHE_HEADERS }
        );
      }

      // 失敗した行は消さずに failed にする（今月の AI の呼び出し回数に数え、失敗の繰り返しで費用が積み上がらないようにする）
      const markFailed = async () => {
        await supabase
          .from("coaching_programs")
          .update({ status: "failed" })
          .eq("id", program.id)
          .eq("status", "generating");
      };

      // 過去データを取得（プラン生成のヒント用）
      const thirtyDaysAgo = new Date(
        Date.now() - 30 * 24 * 60 * 60 * 1000
      ).toISOString();

      const [symptomRes, postureRes] = await Promise.all([
        supabase
          .from("symptom_selections")
          .select("symptom_id")
          .eq("user_id", user.id)
          .gte("created_at", thirtyDaysAgo)
          .limit(50),
        supabase
          .from("posture_records")
          .select("diagnosis")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(1),
      ]);

      const symptoms: Record<string, number> = {};
      (symptomRes.data || []).forEach((s) => {
        symptoms[s.symptom_id] = (symptoms[s.symptom_id] || 0) + 1;
      });

      const postureIssues: string[] = [];
      const latestPosture = (postureRes.data || [])[0];
      if (latestPosture && Array.isArray(latestPosture.diagnosis)) {
        latestPosture.diagnosis.forEach(
          (d: { level: string; label: string }) => {
            if (d.level !== "good") postureIssues.push(d.label);
          }
        );
      }

      // AIで30日プラン生成
      let plan;
      try {
        plan = await generateCoachingPlan(
          user,
          goalType,
          goalText,
          symptoms,
          postureIssues
        );
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error("Coaching plan generation failed:", msg);
        await markFailed();
        return NextResponse.json(
          {
            error: "plan_generation_failed",
            message: "30日プランを作れませんでした。時間をおいて、もう一度お試しください。",
          },
          { status: 500, headers: NO_CACHE_HEADERS }
        );
      }

      // 30タスクを一括挿入
      const tasksToInsert = plan.tasks.map((t) => {
        const taskDate = new Date(startDate);
        taskDate.setDate(taskDate.getDate() + (t.day_number - 1));
        const scheduledDate = new Date(taskDate.getTime() + jstOffsetMs)
          .toISOString()
          .slice(0, 10);
        return {
          program_id: program.id,
          user_id: user.id,
          day_number: t.day_number,
          scheduled_date: scheduledDate,
          category: t.category,
          title: t.title,
          description: t.description,
          symptom_id: t.symptom_id,
          estimated_minutes: t.estimated_minutes,
        };
      });

      const { error: tasksErr } = await supabase
        .from("coaching_tasks")
        .insert(tasksToInsert);

      if (tasksErr) {
        // タスクを保存できなかったときは、プログラムを failed にする（画面には出ない。回数には数える）
        console.error("Coaching tasks insert failed:", tasksErr.message);
        await markFailed();
        return NextResponse.json(
          {
            error: "tasks_create_failed",
            message: "30日プランを保存できませんでした。時間をおいて、もう一度お試しください。",
          },
          { status: 500, headers: NO_CACHE_HEADERS }
        );
      }

      // 作成中 → 進行中にして、AI の概要と励ましを書き込む
      const { error: activateErr } = await supabase
        .from("coaching_programs")
        .update({
          status: "active",
          ai_summary: plan.summary,
          ai_advice: plan.advice,
        })
        .eq("id", program.id)
        .eq("status", "generating");

      if (activateErr) {
        console.error("Coaching program activate failed:", activateErr.message);
        await markFailed();
        return NextResponse.json(
          {
            error: "program_create_failed",
            message: "30日プランを保存できませんでした。時間をおいて、もう一度お試しください。",
          },
          { status: 500, headers: NO_CACHE_HEADERS }
        );
      }

      return NextResponse.json(
        {
          ok: true,
          program: {
            id: program.id,
            summary: plan.summary,
            advice: plan.advice,
            startDate: startDateJst,
            endDate: endDateJst,
            totalDays: 30,
          },
          tasksCount: tasksToInsert.length,
        },
        { headers: NO_CACHE_HEADERS }
      );
    }

    // ========== COMPLETE: タスク完了 ==========
    if (action === "complete") {
      const { taskId } = body;
      if (!taskId) {
        return NextResponse.json(
          { error: "taskId required" },
          { status: 400, headers: NO_CACHE_HEADERS }
        );
      }

      const { data: task } = await supabase
        .from("coaching_tasks")
        .select("id, completed_at, program_id")
        .eq("id", taskId)
        .eq("user_id", user.id)
        .maybeSingle();

      if (!task) {
        return NextResponse.json(
          { error: "task not found" },
          { status: 404, headers: NO_CACHE_HEADERS }
        );
      }

      if (task.completed_at) {
        return NextResponse.json(
          { ok: true, alreadyCompleted: true },
          { headers: NO_CACHE_HEADERS }
        );
      }

      await supabase
        .from("coaching_tasks")
        .update({ completed_at: new Date().toISOString() })
        .eq("id", taskId);

      // プログラム完了チェック
      const { data: allTasks } = await supabase
        .from("coaching_tasks")
        .select("completed_at")
        .eq("program_id", task.program_id);

      const completedCount = (allTasks || []).filter(
        (t) => t.completed_at
      ).length;
      const totalCount = (allTasks || []).length;

      let programCompleted = false;
      if (completedCount >= totalCount && totalCount > 0) {
        await supabase
          .from("coaching_programs")
          .update({
            status: "completed",
            completed_at: new Date().toISOString(),
          })
          .eq("id", task.program_id);
        programCompleted = true;
      }

      return NextResponse.json(
        {
          ok: true,
          completedCount,
          totalCount,
          programCompleted,
        },
        { headers: NO_CACHE_HEADERS }
      );
    }

    // ========== ABANDON: プログラム中止 ==========
    if (action === "abandon") {
      await supabase
        .from("coaching_programs")
        .update({ status: "abandoned" })
        .eq("user_id", user.id)
        .eq("status", "active");

      return NextResponse.json(
        { ok: true, message: "プログラムを中止しました" },
        { headers: NO_CACHE_HEADERS }
      );
    }

    return NextResponse.json(
      { error: "invalid_action" },
      { status: 400, headers: NO_CACHE_HEADERS }
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("Coaching API error:", e);
    return NextResponse.json(
      { error: "operation failed", detail: msg },
      { status: 500, headers: NO_CACHE_HEADERS }
    );
  }
}
