import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { calculateRecommendation, type ActivityLevel, type Gender, type GoalType } from "../../lib/nutrition";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
  );
}

/**
 * GET /api/profile?deviceId=xxx
 * プロフィール + 目標 + 最近の体重記録 + AI計算結果 を返す
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
      .select("id, name, age, height_cm, weight_kg, gender, activity_level")
      .eq("device_id", deviceId);
    if (!users || users.length === 0) {
      return NextResponse.json({ profile: null, goal: null, weights: [], recommendation: null });
    }
    const user = users[0];

    const [goalRes, weightsRes] = await Promise.all([
      supabase
        .from("nutrition_goals")
        .select("goal_type, target_calories, target_protein_g, target_carbs_g, target_fat_g, target_weight_kg, target_period_weeks")
        .eq("user_id", user.id)
        .maybeSingle(),
      supabase
        .from("weight_records")
        .select("weight_kg, recorded_at")
        .eq("user_id", user.id)
        .order("recorded_at", { ascending: false })
        .limit(30),
    ]);

    // AI計算（プロフィール完成時のみ）
    let recommendation = null;
    if (user.height_cm && user.weight_kg && user.gender && user.activity_level && user.age) {
      recommendation = calculateRecommendation({
        gender: user.gender as Gender,
        heightCm: user.height_cm,
        weightKg: Number(user.weight_kg),
        age: user.age,
        activityLevel: user.activity_level as ActivityLevel,
        goalType: (goalRes.data?.goal_type as GoalType) || "maintain",
        targetWeightKg: goalRes.data?.target_weight_kg
          ? Number(goalRes.data.target_weight_kg)
          : undefined,
        targetPeriodWeeks: goalRes.data?.target_period_weeks || undefined,
      });
    }

    return NextResponse.json({
      profile: {
        name: user.name,
        age: user.age,
        height_cm: user.height_cm,
        weight_kg: user.weight_kg,
        gender: user.gender,
        activity_level: user.activity_level,
      },
      goal: goalRes.data,
      weights: (weightsRes.data || []).reverse(), // 古い順に並び替え
      recommendation,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { error: "failed to load profile", detail: msg },
      { status: 500 }
    );
  }
}

/**
 * POST /api/profile
 * プロフィール + 目標をまとめて保存
 * 体重が入力されたら weight_records にも自動記録
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      deviceId,
      age,
      heightCm,
      weightKg,
      gender,
      activityLevel,
      // 目標設定
      goalType,
      targetWeightKg,
      targetPeriodWeeks,
      // 体重ログフラグ
      logWeight,
    } = body;

    if (!deviceId) {
      return NextResponse.json({ error: "deviceId required" }, { status: 400 });
    }

    const supabase = getSupabase();
    const { data: users } = await supabase
      .from("users")
      .select("id, weight_kg")
      .eq("device_id", deviceId);
    if (!users || users.length === 0) {
      return NextResponse.json({ error: "user not found" }, { status: 404 });
    }
    const user = users[0];

    // 1. users テーブル更新
    const userUpdates: Record<string, unknown> = {};
    if (age !== undefined) userUpdates.age = age;
    if (heightCm !== undefined) userUpdates.height_cm = heightCm;
    if (weightKg !== undefined) userUpdates.weight_kg = weightKg;
    if (gender !== undefined) userUpdates.gender = gender;
    if (activityLevel !== undefined) userUpdates.activity_level = activityLevel;

    if (Object.keys(userUpdates).length > 0) {
      await supabase.from("users").update(userUpdates).eq("id", user.id);
    }

    // 2. 体重が変わった or logWeight=true の場合、weight_records に記録
    if (weightKg !== undefined && (logWeight || Number(user.weight_kg) !== Number(weightKg))) {
      await supabase.from("weight_records").insert({
        user_id: user.id,
        weight_kg: weightKg,
      });
    }

    // 3. 目標設定を更新（指定があれば）
    if (goalType) {
      // AI計算で推奨値を算出
      let payload: Record<string, unknown> = {
        user_id: user.id,
        goal_type: goalType,
        target_weight_kg: targetWeightKg,
        target_period_weeks: targetPeriodWeeks,
        updated_at: new Date().toISOString(),
      };

      // プロフィール情報があれば科学的計算値を保存
      if (heightCm && weightKg && gender && activityLevel && age) {
        const rec = calculateRecommendation({
          gender: gender as Gender,
          heightCm,
          weightKg,
          age,
          activityLevel: activityLevel as ActivityLevel,
          goalType: goalType as GoalType,
          targetWeightKg,
          targetPeriodWeeks,
        });
        payload = {
          ...payload,
          target_calories: rec.recommendedCalories,
          target_protein_g: rec.recommendedProteinG,
          target_carbs_g: rec.recommendedCarbsG,
          target_fat_g: rec.recommendedFatG,
        };
      }

      const { data: existingGoal } = await supabase
        .from("nutrition_goals")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (existingGoal) {
        await supabase.from("nutrition_goals").update(payload).eq("id", existingGoal.id);
      } else {
        await supabase.from("nutrition_goals").insert(payload);
      }
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { error: "failed to save profile", detail: msg },
      { status: 500 }
    );
  }
}
