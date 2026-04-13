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
    const { deviceId } = await req.json();
    if (!deviceId) {
      return NextResponse.json({ registered: false });
    }

    const supabase = getSupabase();
    const { data } = await supabase
      .from("users")
      .select("id, name, prefecture, age")
      .eq("device_id", deviceId)
      .single();

    if (!data || !data.name) {
      return NextResponse.json({ registered: false });
    }

    return NextResponse.json({
      registered: true,
      user: data,
    });
  } catch {
    return NextResponse.json({ registered: false });
  }
}
