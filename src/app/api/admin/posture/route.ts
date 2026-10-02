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
  const url = new URL(req.url);
  const page = parseInt(url.searchParams.get("page") || "0");
  const limit = parseInt(url.searchParams.get("limit") || "20");
  const offset = page * limit;

  const { data } = await supabase
    .from("posture_records")
    .select("id, user_id, diagnosis, image_url, created_at")
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  const { data: allData } = await supabase.from("posture_records").select("id");

  // ユーザー名マッピング
  const { data: usersData } = await supabase.from("users").select("id, name");
  const nameMap: Record<string, string> = {};
  (usersData || []).forEach((u: { id: string; name: string }) => {
    nameMap[u.id] = u.name || "";
  });

  const records = (data || []).map((r) => ({
    ...r,
    user_name: nameMap[r.user_id] || "",
  }));

  return NextResponse.json({ records, total: allData?.length || 0 });
}
