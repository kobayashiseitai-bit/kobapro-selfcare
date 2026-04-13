import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "../_helpers";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export async function GET(req: NextRequest) {
  const supabase = getSupabase();

  const [users, chats, posture, symptoms] = await Promise.all([
    supabase.from("users").select("id"),
    supabase.from("chat_logs").select("id"),
    supabase.from("posture_records").select("id"),
    supabase.from("symptom_selections").select("id"),
  ]);

  const res = NextResponse.json({
    totalUsers: users.data?.length || 0,
    totalChats: chats.data?.length || 0,
    totalPosture: posture.data?.length || 0,
    totalSymptoms: symptoms.data?.length || 0,
  });
  res.headers.set("Cache-Control", "no-store, no-cache, must-revalidate");
  return res;
}
