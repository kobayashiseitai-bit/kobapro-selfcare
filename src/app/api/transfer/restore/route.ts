import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "",
    process.env.SUPABASE_SERVICE_ROLE_KEY || ""
  );
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const rawCode: string = (body.code || "").toString();
    const code = rawCode.replace(/[-\s]/g, "").toUpperCase();

    if (!/^[A-Z0-9]{8}$/.test(code)) {
      return Response.json(
        { error: "正しい形式のコードを入力してください (8文字)" },
        { status: 400 }
      );
    }

    const supabase = getSupabase();

    // コード検索
    const { data: rows, error } = await supabase
      .from("transfer_codes")
      .select("code, user_id, device_id, expires_at, used_at")
      .eq("code", code)
      .limit(1);
    if (error) throw error;
    if (!rows || rows.length === 0) {
      return Response.json({ error: "コードが見つかりません" }, { status: 404 });
    }

    const row = rows[0];
    if (row.used_at) {
      return Response.json({ error: "このコードは使用済みです" }, { status: 400 });
    }
    if (new Date(row.expires_at).getTime() < Date.now()) {
      return Response.json({ error: "コードの有効期限が切れています" }, { status: 400 });
    }

    // 使用済みマーク
    await supabase
      .from("transfer_codes")
      .update({ used_at: new Date().toISOString() })
      .eq("code", code);

    // 引き継ぐ deviceId を返す
    return Response.json({
      success: true,
      deviceId: row.device_id,
    });
  } catch (e) {
    console.error("[transfer/restore] error:", e);
    return Response.json({ error: "サーバーエラーが発生しました" }, { status: 500 });
  }
}
