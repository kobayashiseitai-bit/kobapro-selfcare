import { NextRequest, NextResponse } from "next/server";
import { validateAdmin, getSupabase } from "../_helpers";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!validateAdmin(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabase = getSupabase();
  const url = new URL(req.url);
  const userId = url.searchParams.get("userId");
  const page = parseInt(url.searchParams.get("page") || "0");
  const limit = parseInt(url.searchParams.get("limit") || "50");
  const offset = page * limit;

  let query = supabase
    .from("chat_logs")
    .select("id, user_id, role, content, recommended_symptom, created_at", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (userId) {
    query = query.eq("user_id", userId);
  }

  const { data, count } = await query;

  return NextResponse.json({ chats: data || [], total: count || 0 });
}
