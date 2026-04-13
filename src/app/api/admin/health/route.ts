import { NextResponse } from "next/server";
import { getSupabase } from "../_helpers";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export async function GET() {
  const start = Date.now();
  try {
    const supabase = getSupabase();

    const [users, chats, posture, symptoms] = await Promise.all([
      supabase.from("users").select("id"),
      supabase.from("chat_logs").select("id"),
      supabase.from("posture_records").select("id"),
      supabase.from("symptom_selections").select("id"),
    ]);

    const elapsed = Date.now() - start;
    const errors = [users.error, chats.error, posture.error, symptoms.error].filter(Boolean);

    const res = NextResponse.json({
      status: errors.length === 0 ? "ok" : "error",
      responseTime: elapsed,
      timestamp: new Date().toISOString(),
      counts: {
        users: users.data?.length || 0,
        chats: chats.data?.length || 0,
        posture: posture.data?.length || 0,
        symptoms: symptoms.data?.length || 0,
      },
      errors: errors.map((e) => e?.message),
    });
    res.headers.set("Cache-Control", "no-store, no-cache, must-revalidate");
    return res;
  } catch (e) {
    const res = NextResponse.json({
      status: "error",
      responseTime: Date.now() - start,
      timestamp: new Date().toISOString(),
      counts: { users: 0, chats: 0, posture: 0, symptoms: 0 },
      errors: [String(e)],
    });
    res.headers.set("Cache-Control", "no-store, no-cache, must-revalidate");
    return res;
  }
}
