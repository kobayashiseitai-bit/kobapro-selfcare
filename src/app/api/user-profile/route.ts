import { NextRequest, NextResponse } from "next/server";

import { createServerSupabase } from "../../lib/supabase-server";

export const dynamic = "force-dynamic";

// 読み取りがキャッシュされて古い値が返るのを防ぐため、
// no-store を指定した共通クライアントを使う（supabase-server.ts に経緯あり）
const getSupabase = createServerSupabase;

export async function POST(req: NextRequest) {
  try {
    const { deviceId } = await req.json();
    if (!deviceId) {
      return NextResponse.json({ registered: false });
    }

    const supabase = getSupabase();
    const { data } = await supabase
      .from("users")
      .select("id, name, prefecture, age, height_cm, weight_kg, gender, activity_level")
      .eq("device_id", deviceId)
      .single();

    if (!data || !data.name) {
      return NextResponse.json({ registered: false });
    }

    const profileComplete = !!(
      data.height_cm && data.weight_kg && data.gender && data.activity_level && data.age
    );

    return NextResponse.json({
      registered: true,
      user: data,
      profileComplete,
    });
  } catch {
    return NextResponse.json({ registered: false });
  }
}
