import { NextRequest, NextResponse } from "next/server";
import { validateAdmin, getSupabase } from "../_helpers";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export async function GET(req: NextRequest) {
  // 管理者ログイン（/api/admin/auth が付ける admin_session）が無ければ何も返さない。
  // 2026-10-02 まで認証が無く、だれでも全利用者の名前・健康情報・チャット本文を読めた
  if (!validateAdmin(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

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
