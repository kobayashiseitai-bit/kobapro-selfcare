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

/**
 * GET /api/meal/today?deviceId=xxx&date=YYYY-MM-DD
 * 指定日（未指定は今日）の食事記録を区分別に集計＋目標比較
 */
export async function GET(req: NextRequest) {
  try {
    const deviceId = req.nextUrl.searchParams.get("deviceId");
    const dateParam = req.nextUrl.searchParams.get("date");
    // クライアントから直接 UTC の ISO 文字列を受け取る（タイムゾーン問題を解消）
    const startParam = req.nextUrl.searchParams.get("start");
    const endParam = req.nextUrl.searchParams.get("end");
    if (!deviceId) {
      return NextResponse.json({ error: "deviceId required" }, { status: 400 });
    }

    // 日付範囲の決定ロジック
    let start: Date;
    let end: Date;

    if (startParam && endParam) {
      // 新方式: クライアントがUTC ISO文字列で範囲を送信（最優先）
      start = new Date(startParam);
      end = new Date(endParam);
    } else {
      // 旧方式フォールバック: date=YYYY-MM-DD をJSTとして解釈
      const dateStr = dateParam || new Date().toISOString().slice(0, 10);
      // JSTの指定日0:00〜翌0:00 をUTCで表現
      start = new Date(`${dateStr}T00:00:00+09:00`);
      end = new Date(start);
      end.setUTCDate(end.getUTCDate() + 1);
    }

    const supabase = getSupabase();
    const { data: users } = await supabase
      .from("users")
      .select("id")
      .eq("device_id", deviceId);
    if (!users || users.length === 0) {
      return NextResponse.json(
        {
          date: start.toISOString(),
          byMealType: {},
          total: { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 },
          goal: null,
        },
        {
          headers: {
            "Cache-Control": "no-store, no-cache, must-revalidate, private",
            Pragma: "no-cache",
            Expires: "0",
          },
        }
      );
    }
    const userId = users[0].id;

    const [mealRes, goalRes] = await Promise.all([
      supabase
        .from("meal_records")
        .select(
          "id, image_url, menu_name, meal_type, calories, protein_g, carbs_g, fat_g, score, advice, created_at"
        )
        .eq("user_id", userId)
        .gte("created_at", start.toISOString())
        .lt("created_at", end.toISOString())
        .order("created_at", { ascending: true }),
      supabase
        .from("nutrition_goals")
        .select("target_calories, target_protein_g, target_carbs_g, target_fat_g")
        .eq("user_id", userId)
        .maybeSingle(),
    ]);

    const meals = mealRes.data || [];
    interface MealRecord {
      id: string;
      image_url: string;
      menu_name: string | null;
      meal_type: string | null;
      calories: number | null;
      protein_g: number | null;
      carbs_g: number | null;
      fat_g: number | null;
      score: number | null;
      advice: string | null;
      created_at: string;
    }

    // 食事区分別にグループ化（朝食/昼食/夕食/間食/その他）
    const byMealType: Record<
      string,
      {
        meals: MealRecord[];
        totals: { calories: number; protein_g: number; carbs_g: number; fat_g: number };
      }
    > = {
      朝食: { meals: [], totals: { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 } },
      昼食: { meals: [], totals: { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 } },
      夕食: { meals: [], totals: { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 } },
      間食: { meals: [], totals: { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 } },
    };

    const total = { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 };

    meals.forEach((m) => {
      const type = m.meal_type && byMealType[m.meal_type] ? m.meal_type : "間食";
      byMealType[type].meals.push(m);
      byMealType[type].totals.calories += m.calories || 0;
      byMealType[type].totals.protein_g += Number(m.protein_g) || 0;
      byMealType[type].totals.carbs_g += Number(m.carbs_g) || 0;
      byMealType[type].totals.fat_g += Number(m.fat_g) || 0;
      total.calories += m.calories || 0;
      total.protein_g += Number(m.protein_g) || 0;
      total.carbs_g += Number(m.carbs_g) || 0;
      total.fat_g += Number(m.fat_g) || 0;
    });

    return NextResponse.json(
      {
        date: start.toISOString(),
        byMealType,
        total: {
          calories: total.calories,
          protein_g: Number(total.protein_g.toFixed(1)),
          carbs_g: Number(total.carbs_g.toFixed(1)),
          fat_g: Number(total.fat_g.toFixed(1)),
        },
        goal: goalRes.data,
      },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, private",
          Pragma: "no-cache",
          Expires: "0",
        },
      }
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { error: "failed to load today", detail: msg },
      { status: 500 }
    );
  }
}
