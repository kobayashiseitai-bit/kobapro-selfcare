import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "../_helpers";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export async function GET(req: NextRequest) {
  try {
    const supabase = getSupabase();
    const url = new URL(req.url);
    const userId = url.searchParams.get("userId");
    const page = parseInt(url.searchParams.get("page") || "0");
    const limit = parseInt(url.searchParams.get("limit") || "50");
    const offset = page * limit;

    let query = supabase
      .from("chat_logs")
      .select("id, user_id, role, content, recommended_symptom, created_at")
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (userId) {
      query = query.eq("user_id", userId);
    }

    const { data, error } = await query;

    // 総数
    let totalQuery = supabase.from("chat_logs").select("id");
    if (userId) totalQuery = totalQuery.eq("user_id", userId);
    const { data: allData } = await totalQuery;

    // ユーザー名マッピング
    const { data: usersData } = await supabase.from("users").select("id, name");
    const nameMap: Record<string, string> = {};
    (usersData || []).forEach((u: { id: string; name: string }) => {
      nameMap[u.id] = u.name || "";
    });

    const chats = (data || []).map((c) => ({
      ...c,
      user_name: nameMap[c.user_id] || "",
    }));

    return NextResponse.json({
      chats,
      total: allData?.length || 0,
    });
  } catch (e) {
    return NextResponse.json({ chats: [], total: 0, error: String(e) });
  }
}
