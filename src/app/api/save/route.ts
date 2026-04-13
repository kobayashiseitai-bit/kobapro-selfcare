import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

// Supabase client - initialized per request
function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
  );
}

async function getOrCreateUser(deviceId: string): Promise<string> {
  const supabase = getSupabase();
  const { data } = await supabase
    .from("users")
    .select("id")
    .eq("device_id", deviceId)
    .single();

  if (data) return data.id;

  const { data: newUser } = await supabase
    .from("users")
    .insert({ device_id: deviceId })
    .select("id")
    .single();

  return newUser?.id || "";
}

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const supabase = getSupabase();
    const body = await req.json();
    const { type, deviceId, ...payload } = body;

    if (!deviceId) {
      return NextResponse.json({ error: "deviceId required" }, { status: 400 });
    }

    const userId = await getOrCreateUser(deviceId);
    if (!userId) {
      return NextResponse.json({ error: "user creation failed" }, { status: 500 });
    }

    if (type === "chat") {
      await supabase.from("chat_logs").insert({
        user_id: userId,
        role: payload.role,
        content: payload.content,
        recommended_symptom: payload.recommendedSymptom || null,
      });
    } else if (type === "posture") {
      await supabase.from("posture_records").insert({
        user_id: userId,
        landmarks: payload.landmarks,
        diagnosis: payload.diagnosis,
        image_url: payload.imageUrl,
      });
    } else if (type === "symptom") {
      await supabase.from("symptom_selections").insert({
        user_id: userId,
        symptom_id: payload.symptomId,
      });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("Save API error:", e);
    return NextResponse.json({ error: "save failed" }, { status: 500 });
  }
}
