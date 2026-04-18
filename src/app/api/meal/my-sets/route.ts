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

async function getUserId(supabase: ReturnType<typeof getSupabase>, deviceId: string) {
  const { data } = await supabase
    .from("users")
    .select("id")
    .eq("device_id", deviceId)
    .maybeSingle();
  return data?.id || null;
}

/**
 * GET /api/meal/my-sets?deviceId=xxx
 * 頻出順にMYセットを返す
 */
export async function GET(req: NextRequest) {
  try {
    const deviceId = req.nextUrl.searchParams.get("deviceId");
    if (!deviceId) {
      return NextResponse.json({ error: "deviceId required" }, { status: 400 });
    }
    const supabase = getSupabase();
    const userId = await getUserId(supabase, deviceId);
    if (!userId) {
      return NextResponse.json({ sets: [] });
    }

    const { data } = await supabase
      .from("my_sets")
      .select("id, name, meal_type, menu_name, calories, protein_g, carbs_g, fat_g, icon, use_count, last_used_at")
      .eq("user_id", userId)
      .order("last_used_at", { ascending: false, nullsFirst: false })
      .order("use_count", { ascending: false })
      .limit(50);

    return NextResponse.json({ sets: data || [] });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { error: "failed to load my-sets", detail: msg },
      { status: 500 }
    );
  }
}

/**
 * POST /api/meal/my-sets
 * MYセットの作成 or 使用（quick record）
 *
 * Body:
 * { action: 'create', deviceId, name, mealType?, menuName, calories, proteinG, carbsG, fatG, icon? }
 * { action: 'use', deviceId, setId, mealType }  -- MYセットから食事を記録
 * { action: 'delete', deviceId, setId }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, deviceId } = body;
    if (!deviceId || !action) {
      return NextResponse.json(
        { error: "deviceId and action required" },
        { status: 400 }
      );
    }

    const supabase = getSupabase();
    const userId = await getUserId(supabase, deviceId);
    if (!userId) {
      return NextResponse.json({ error: "user not found" }, { status: 404 });
    }

    if (action === "create") {
      const { name, mealType, menuName, calories, proteinG, carbsG, fatG, icon } = body;
      if (!name || !menuName) {
        return NextResponse.json(
          { error: "name and menuName required" },
          { status: 400 }
        );
      }

      const { data, error } = await supabase
        .from("my_sets")
        .insert({
          user_id: userId,
          name,
          meal_type: mealType || null,
          menu_name: menuName,
          calories: calories ?? null,
          protein_g: proteinG ?? null,
          carbs_g: carbsG ?? null,
          fat_g: fatG ?? null,
          icon: icon || null,
        })
        .select()
        .single();

      if (error) {
        return NextResponse.json(
          { error: "create failed", detail: error.message },
          { status: 500 }
        );
      }
      return NextResponse.json({ ok: true, set: data });
    }

    if (action === "use") {
      const { setId, mealType } = body;
      if (!setId) {
        return NextResponse.json({ error: "setId required" }, { status: 400 });
      }

      // 1. MYセットを取得
      const { data: set, error: fetchErr } = await supabase
        .from("my_sets")
        .select("*")
        .eq("id", setId)
        .eq("user_id", userId)
        .single();

      if (fetchErr || !set) {
        return NextResponse.json(
          { error: "my-set not found", detail: fetchErr?.message },
          { status: 404 }
        );
      }

      // 2. meal_records に追加（画像なし版＝プレースホルダー）
      const { data: mealRec, error: insErr } = await supabase
        .from("meal_records")
        .insert({
          user_id: userId,
          image_url: "/meal-placeholder.svg",
          meal_type: mealType || set.meal_type || null,
          menu_name: set.menu_name,
          calories: set.calories,
          protein_g: set.protein_g,
          carbs_g: set.carbs_g,
          fat_g: set.fat_g,
          advice: `「${set.name}」から1タップ記録しました。`,
          score: null,
        })
        .select("id, created_at")
        .single();

      if (insErr) {
        return NextResponse.json(
          { error: "record insert failed", detail: insErr.message },
          { status: 500 }
        );
      }

      // 3. my_sets の use_count++ と last_used_at 更新
      await supabase
        .from("my_sets")
        .update({
          use_count: (set.use_count || 0) + 1,
          last_used_at: new Date().toISOString(),
        })
        .eq("id", setId);

      return NextResponse.json({
        ok: true,
        recordId: mealRec?.id,
        createdAt: mealRec?.created_at,
      });
    }

    if (action === "delete") {
      const { setId } = body;
      if (!setId) {
        return NextResponse.json({ error: "setId required" }, { status: 400 });
      }
      await supabase.from("my_sets").delete().eq("id", setId).eq("user_id", userId);
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "invalid action" }, { status: 400 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { error: "my-sets operation failed", detail: msg },
      { status: 500 }
    );
  }
}
