import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "",
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
  );
}

/**
 * GET /api/account?deviceId=xxx&action=export
 * 自身の全データをJSON形式でエクスポート（GDPR/APPI対応）
 */
export async function GET(req: NextRequest) {
  try {
    const deviceId = req.nextUrl.searchParams.get("deviceId");
    const action = req.nextUrl.searchParams.get("action");

    if (!deviceId) {
      return NextResponse.json({ error: "deviceId required" }, { status: 400 });
    }

    if (action !== "export") {
      return NextResponse.json({ error: "invalid action" }, { status: 400 });
    }

    const supabase = getSupabase();
    const { data: users } = await supabase
      .from("users")
      .select("*")
      .eq("device_id", deviceId);

    if (!users || users.length === 0) {
      return NextResponse.json({ error: "user not found" }, { status: 404 });
    }
    const userId = users[0].id;

    // 全関連データを並行取得
    const [posture, chats, meals, weights, goals, symptoms, subscription, usage] =
      await Promise.all([
        supabase.from("posture_records").select("*").eq("user_id", userId),
        supabase.from("chat_logs").select("*").eq("user_id", userId),
        supabase.from("meal_records").select("*").eq("user_id", userId),
        supabase.from("weight_records").select("*").eq("user_id", userId),
        supabase.from("nutrition_goals").select("*").eq("user_id", userId),
        supabase.from("symptom_selections").select("*").eq("user_id", userId),
        supabase.from("subscriptions").select("*").eq("user_id", userId),
        supabase.from("usage_counters").select("*").eq("user_id", userId),
      ]);

    const exportData = {
      exported_at: new Date().toISOString(),
      export_version: "1.0",
      user_profile: users[0],
      posture_records: posture.data || [],
      chat_logs: chats.data || [],
      meal_records: meals.data || [],
      weight_records: weights.data || [],
      nutrition_goals: goals.data || [],
      symptom_selections: symptoms.data || [],
      subscription: subscription.data || [],
      usage_counters: usage.data || [],
    };

    const filename = `zero-pain-data-export-${new Date()
      .toISOString()
      .slice(0, 10)}.json`;

    return new NextResponse(JSON.stringify(exportData, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { error: "export failed", detail: msg },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/account
 * Body: { deviceId, confirmText: 'DELETE' }
 * アカウントと関連する全データを完全削除
 */
export async function DELETE(req: NextRequest) {
  try {
    const { deviceId, confirmText } = await req.json();

    if (!deviceId) {
      return NextResponse.json({ error: "deviceId required" }, { status: 400 });
    }

    // 誤削除防止: 「DELETE」と入力してもらう
    if (confirmText !== "DELETE") {
      return NextResponse.json(
        { error: "confirmText must be 'DELETE'" },
        { status: 400 }
      );
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

    // 1. Storageから画像を削除
    //    （user_idフォルダ配下にある画像）
    try {
      const { data: postureFiles } = await supabase.storage
        .from("posture-images")
        .list(userId);
      if (postureFiles && postureFiles.length > 0) {
        const paths = postureFiles.map((f) => `${userId}/${f.name}`);
        await supabase.storage.from("posture-images").remove(paths);
      }

      const { data: mealFiles } = await supabase.storage
        .from("meal-images")
        .list(userId);
      if (mealFiles && mealFiles.length > 0) {
        const paths = mealFiles.map((f) => `${userId}/${f.name}`);
        await supabase.storage.from("meal-images").remove(paths);
      }
    } catch (storageErr) {
      console.error("Storage delete warning:", storageErr);
      // Storage削除失敗はスルー（ユーザーデータ削除は継続）
    }

    // 2. 関連テーブルを削除（ON DELETE CASCADEで自動削除されるが明示的に）
    await Promise.all([
      supabase.from("posture_records").delete().eq("user_id", userId),
      supabase.from("chat_logs").delete().eq("user_id", userId),
      supabase.from("meal_records").delete().eq("user_id", userId),
      supabase.from("weight_records").delete().eq("user_id", userId),
      supabase.from("nutrition_goals").delete().eq("user_id", userId),
      supabase.from("symptom_selections").delete().eq("user_id", userId),
      supabase.from("subscriptions").delete().eq("user_id", userId),
      supabase.from("usage_counters").delete().eq("user_id", userId),
    ]);

    // 3. ユーザー本体を削除
    await supabase.from("users").delete().eq("id", userId);

    return NextResponse.json({
      ok: true,
      message: "アカウントと全データを削除しました",
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { error: "account deletion failed", detail: msg },
      { status: 500 }
    );
  }
}
