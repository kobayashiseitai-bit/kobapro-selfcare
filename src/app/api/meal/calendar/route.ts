import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { signImageUrls } from "../../../lib/supabase-storage";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "",
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
  );
}

/**
 * GET /api/meal/calendar?deviceId=xxx&year=2026&month=4
 * 指定月の食事記録を日別に集計して返す
 */
export async function GET(req: NextRequest) {
  try {
    const deviceId = req.nextUrl.searchParams.get("deviceId");
    const yearParam = req.nextUrl.searchParams.get("year");
    const monthParam = req.nextUrl.searchParams.get("month");

    if (!deviceId) {
      return NextResponse.json({ error: "deviceId required" }, { status: 400 });
    }

    const now = new Date();
    const year = yearParam ? parseInt(yearParam) : now.getFullYear();
    const month = monthParam ? parseInt(monthParam) : now.getMonth() + 1;

    const supabase = getSupabase();
    const { data: users } = await supabase
      .from("users")
      .select("id")
      .eq("device_id", deviceId);
    if (!users || users.length === 0) {
      return NextResponse.json({ year, month, days: {}, stats: null, goal: null });
    }
    const userId = users[0].id;

    // 月の開始と終了（JSTベース）
    const mm = String(month).padStart(2, "0");
    const nextMonthDate = new Date(Date.UTC(year, month, 1)); // UTC翌月1日
    const ny = nextMonthDate.getUTCFullYear();
    const nm = String(nextMonthDate.getUTCMonth() + 1).padStart(2, "0");
    const start = new Date(`${year}-${mm}-01T00:00:00+09:00`).toISOString();
    const end = new Date(`${ny}-${nm}-01T00:00:00+09:00`).toISOString();

    // 食事データ取得
    const [mealRes, goalRes] = await Promise.all([
      supabase
        .from("meal_records")
        .select(
          "id, image_url, menu_name, meal_type, calories, protein_g, carbs_g, fat_g, advice, score, created_at"
        )
        .eq("user_id", userId)
        .gte("created_at", start)
        .lt("created_at", end)
        .order("created_at", { ascending: true }),
      supabase
        .from("nutrition_goals")
        .select("goal_type, target_calories, target_protein_g, target_carbs_g, target_fat_g")
        .eq("user_id", userId)
        .maybeSingle(),
    ]);

    // Signed URL に変換
    const meals = await signImageUrls(
      supabase,
      mealRes.data || [],
      "meal-images"
    );

    // 日別集計
    interface DayData {
      meals: Array<{
        id: string;
        image_url: string;
        menu_name: string | null;
        meal_type: string | null;
        calories: number | null;
        protein_g: number | null;
        carbs_g: number | null;
        fat_g: number | null;
        advice: string | null;
        score: number | null;
        created_at: string;
      }>;
      totalCalories: number;
      totalProtein: number;
      totalCarbs: number;
      totalFat: number;
      avgScore: number;
    }

    const days: Record<string, DayData> = {};

    meals.forEach((m) => {
      // JSTの日付を取得（UTC+9 を加算してから UTC日付を読む）
      const d = new Date(new Date(m.created_at).getTime() + 9 * 60 * 60 * 1000);
      const dayKey = String(d.getUTCDate());
      if (!days[dayKey]) {
        days[dayKey] = {
          meals: [],
          totalCalories: 0,
          totalProtein: 0,
          totalCarbs: 0,
          totalFat: 0,
          avgScore: 0,
        };
      }
      days[dayKey].meals.push(m);
      days[dayKey].totalCalories += m.calories || 0;
      days[dayKey].totalProtein += Number(m.protein_g) || 0;
      days[dayKey].totalCarbs += Number(m.carbs_g) || 0;
      days[dayKey].totalFat += Number(m.fat_g) || 0;
    });

    // 平均スコア計算
    Object.keys(days).forEach((k) => {
      const scores = days[k].meals
        .map((m) => m.score)
        .filter((s): s is number => typeof s === "number");
      days[k].avgScore =
        scores.length > 0
          ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
          : 0;
    });

    // 月全体統計
    const recordedDays = Object.keys(days).length;
    const monthTotalCal = Object.values(days).reduce((s, d) => s + d.totalCalories, 0);
    const monthTotalProtein = Object.values(days).reduce((s, d) => s + d.totalProtein, 0);
    const stats = {
      recordedDays,
      totalMeals: meals.length,
      avgCalPerDay: recordedDays > 0 ? Math.round(monthTotalCal / recordedDays) : 0,
      avgProteinPerDay: recordedDays > 0 ? Number((monthTotalProtein / recordedDays).toFixed(1)) : 0,
    };

    return NextResponse.json({ year, month, days, stats, goal: goalRes.data });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { error: "failed to load calendar", detail: msg },
      { status: 500 }
    );
  }
}
