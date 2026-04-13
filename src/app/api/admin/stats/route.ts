import { NextRequest, NextResponse } from "next/server";
import { validateAdmin, getSupabase } from "../_helpers";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const supabase = getSupabase();

  const [users, chats, posture, symptoms] = await Promise.all([
    supabase.from("users").select("id"),
    supabase.from("chat_logs").select("id"),
    supabase.from("posture_records").select("id"),
    supabase.from("symptom_selections").select("id"),
  ]);

  return NextResponse.json({
    totalUsers: users.data?.length || 0,
    totalChats: chats.data?.length || 0,
    totalPosture: posture.data?.length || 0,
    totalSymptoms: symptoms.data?.length || 0,
  });
}
// force redeploy 1776123988
