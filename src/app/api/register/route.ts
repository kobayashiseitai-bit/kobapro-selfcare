import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
  );
}

export async function POST(req: NextRequest) {
  try {
    const { deviceId, name, prefecture, age, painAreas, concerns } = await req.json();

    if (!deviceId || !name) {
      return NextResponse.json({ error: "deviceId and name required" }, { status: 400 });
    }

    const supabase = getSupabase();

    // 既存ユーザーを検索
    const { data: existing } = await supabase
      .from("users")
      .select("id")
      .eq("device_id", deviceId);

    if (existing && existing.length > 0) {
      // 既存ユーザーを更新
      await supabase
        .from("users")
        .update({ name, prefecture: prefecture || "", age: age || null, pain_areas: painAreas || "", concerns: concerns || "" })
        .eq("id", existing[0].id);

      return NextResponse.json({ ok: true, userId: existing[0].id });
    } else {
      // 新規作成
      const { data: newUser, error } = await supabase
        .from("users")
        .insert({ device_id: deviceId, name, prefecture: prefecture || "", age: age || null, pain_areas: painAreas || "", concerns: concerns || "" })
        .select("id")
        .single();

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ ok: true, userId: newUser?.id });
    }
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
