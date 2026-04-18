import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
  );
}

// 目標タイプ別のデフォルト値（男女・年齢差は簡易版）
const DEFAULTS = {
  diet: { calories: 1500, protein: 70, carbs: 180, fat: 40 },
  maintain: { calories: 1800, protein: 60, carbs: 230, fat: 50 },
  muscle: { calories: 2400, protein: 120, carbs: 300, fat: 70 },
};

/**
 * GET /api/goals?deviceId=xxx
 * 現在の栄養目標を取得（なければnull）
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
      .select("id")
      .eq("device_id", deviceId);
    if (!users || users.length === 0) {
      return NextResponse.json({ goal: null });
    }
    const userId = users[0].id;

    const { data: goal } = await supabase
      .from("nutrition_goals")
      .select("goal_type, target_calories, target_protein_g, target_carbs_g, target_fat_g, updated_at")
      .eq("user_id", userId)
      .maybeSingle();

    return NextResponse.json({ goal });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { error: "failed to load goals", detail: msg },
      { status: 500 }
    );
  }
}

/**
 * POST /api/goals
 * { deviceId, goalType: 'diet' | 'maintain' | 'muscle',
 *   targetCalories?, targetProteinG?, targetCarbsG?, targetFatG? }
 * 目標を作成 or 更新
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { deviceId, goalType, targetCalories, targetProteinG, targetCarbsG, targetFatG } = body;

    if (!deviceId) {
      return NextResponse.json({ error: "deviceId required" }, { status: 400 });
    }
    if (!["diet", "maintain", "muscle"].includes(goalType)) {
      return NextResponse.json({ error: "invalid goalType" }, { status: 400 });
    }

    const supabase = getSupabase();
    const { data: users } = await supabase
      .from("users")
      .select("id")
      .eq("device_id", deviceId);
    if (!users || users.length === 0) {
      return NextResponse.json({ error: "user not found" }, { status: 404 });
    }
    const userId = users[0].id;

    const defaults = DEFAULTS[goalType as keyof typeof DEFAULTS];
    const payload = {
      user_id: userId,
      goal_type: goalType,
      target_calories: targetCalories ?? defaults.calories,
      target_protein_g: targetProteinG ?? defaults.protein,
      target_carbs_g: targetCarbsG ?? defaults.carbs,
      target_fat_g: targetFatG ?? defaults.fat,
      updated_at: new Date().toISOString(),
    };

    // upsert
    const { data: existing } = await supabase
      .from("nutrition_goals")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();

    if (existing) {
      await supabase.from("nutrition_goals").update(payload).eq("id", existing.id);
    } else {
      await supabase.from("nutrition_goals").insert(payload);
    }

    return NextResponse.json({ ok: true, goal: payload });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { error: "failed to save goals", detail: msg },
      { status: 500 }
    );
  }
}
