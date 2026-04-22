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
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
  );
}

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
  const symptomLines = Object.entries(symptoms)
    .map(([id, count]) => `${SYMPTOM_LABELS[id] || id}(${count}回)`)
    .join("、");

  const prompt = `あなたは「ガイコツ先生」、ZERO-PAINセルフケアアプリ専属のAIカイロプラクターです。
ユーザーが新しく30日コーチングプログラムを開始しようとしています。
ユーザーの背景データを元に、実行可能で効果のある30日プランを生成してください。

【ユーザー情報】
- お名前: ${user.name || "ユーザー"}さん
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
    model: "claude-sonnet-4-5",
    max_tokens: 8000,
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
    if (action === "start") {
      const { goalType, goalText } = body;
      if (!goalType) {
        return NextResponse.json(
          { error: "goalType required" },
          { status: 400, headers: NO_CACHE_HEADERS }
        );
      }

      // 既にアクティブなプログラムがあるかチェック
      const { data: existing } = await supabase
        .from("coaching_programs")
        .select("id")
        .eq("user_id", user.id)
        .eq("status", "active")
        .maybeSingle();

      if (existing) {
        return NextResponse.json(
          {
            error: "already_active",
            message: "既に進行中のプログラムがあります。先に完了or中止してください。",
          },
          { status: 409, headers: NO_CACHE_HEADERS }
        );
      }

      // 過去データを取得（プラン生成のヒント用）
      const sevenDaysAgo = new Date(
        Date.now() - 30 * 24 * 60 * 60 * 1000
      ).toISOString();

      const [symptomRes, postureRes] = await Promise.all([
        supabase
          .from("symptom_selections")
          .select("symptom_id")
          .eq("user_id", user.id)
          .gte("created_at", sevenDaysAgo)
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
          goalText || GOAL_LABELS[goalType] || "",
          symptoms,
          postureIssues
        );
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return NextResponse.json(
          {
            error: "plan_generation_failed",
            detail: msg,
            message: "AIプラン生成に失敗しました。もう一度お試しください。",
          },
          { status: 500, headers: NO_CACHE_HEADERS }
        );
      }

      // プログラムレコード作成
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

      const { data: program, error: programErr } = await supabase
        .from("coaching_programs")
        .insert({
          user_id: user.id,
          status: "active",
          goal_type: goalType,
          goal_text: goalText || GOAL_LABELS[goalType] || "",
          start_date: startDateJst,
          end_date: endDateJst,
          ai_summary: plan.summary,
          ai_advice: plan.advice,
        })
        .select()
        .single();

      if (programErr || !program) {
        return NextResponse.json(
          {
            error: "program_create_failed",
            detail: programErr?.message,
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
        // タスク挿入失敗時はプログラムも削除
        await supabase.from("coaching_programs").delete().eq("id", program.id);
        return NextResponse.json(
          {
            error: "tasks_create_failed",
            detail: tasksErr.message,
          },
          { status: 500, headers: NO_CACHE_HEADERS }
        );
      }

      return NextResponse.json(
        {
          ok: true,
          program: {
            id: program.id,
            summary: program.ai_summary,
            advice: program.ai_advice,
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
