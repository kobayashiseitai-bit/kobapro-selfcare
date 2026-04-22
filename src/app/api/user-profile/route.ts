import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "",
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
  );
}

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
