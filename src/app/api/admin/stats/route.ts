import { NextRequest, NextResponse } from "next/server";
import { validateAdmin, getSupabase } from "../_helpers";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!validateAdmin(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabase = getSupabase();

  const [users, chats, posture, symptoms] = await Promise.all([
    supabase.from("users").select("id", { count: "exact", head: true }),
    supabase.from("chat_logs").select("id", { count: "exact", head: true }),
    supabase.from("posture_records").select("id", { count: "exact", head: true }),
    supabase.from("symptom_selections").select("id", { count: "exact", head: true }),
  ]);

  return NextResponse.json({
    totalUsers: users.count || 0,
    totalChats: chats.count || 0,
    totalPosture: posture.count || 0,
    totalSymptoms: symptoms.count || 0,
  });
}
