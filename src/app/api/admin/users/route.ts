import { NextRequest, NextResponse } from "next/server";
import { validateAdmin, getSupabase } from "../_helpers";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {

  const supabase = getSupabase();
  const url = new URL(req.url);
  const page = parseInt(url.searchParams.get("page") || "0");
  const limit = parseInt(url.searchParams.get("limit") || "20");
  const offset = page * limit;

  const { data: users, count } = await supabase
    .from("users")
    .select("id, device_id, name, prefecture, age, pain_areas, concerns, created_at", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (!users) {
    return NextResponse.json({ users: [], total: 0 });
  }

  const userIds = users.map((u) => u.id);

  const [chatCounts, postureCounts, symptomCounts] = await Promise.all([
    supabase.from("chat_logs").select("user_id").in("user_id", userIds),
    supabase.from("posture_records").select("user_id").in("user_id", userIds),
    supabase.from("symptom_selections").select("user_id").in("user_id", userIds),
  ]);

  const countBy = (data: { user_id: string }[] | null) => {
    const map: Record<string, number> = {};
    (data || []).forEach((r) => {
      map[r.user_id] = (map[r.user_id] || 0) + 1;
    });
    return map;
  };

  const chatMap = countBy(chatCounts.data);
  const postureMap = countBy(postureCounts.data);
  const symptomMap = countBy(symptomCounts.data);

  const enriched = users.map((u) => ({
    ...u,
    chatCount: chatMap[u.id] || 0,
    postureCount: postureMap[u.id] || 0,
    symptomCount: symptomMap[u.id] || 0,
  }));

  return NextResponse.json({ users: enriched, total: count || 0 });
}
