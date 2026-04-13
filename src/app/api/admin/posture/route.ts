import { NextRequest, NextResponse } from "next/server";
import { validateAdmin, getSupabase } from "../_helpers";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!validateAdmin(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabase = getSupabase();
  const url = new URL(req.url);
  const page = parseInt(url.searchParams.get("page") || "0");
  const limit = parseInt(url.searchParams.get("limit") || "20");
  const offset = page * limit;

  const { data, count } = await supabase
    .from("posture_records")
    .select("id, user_id, diagnosis, image_url, created_at", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  return NextResponse.json({ records: data || [], total: count || 0 });
}
