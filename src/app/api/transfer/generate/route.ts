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

// 紛らわしい文字 (0/O, 1/I/L) を除外した8文字コード
const ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
function generateCode(): string {
  const arr = new Uint32Array(8);
  crypto.getRandomValues(arr);
  return Array.from(arr, (n) => ALPHABET[n % ALPHABET.length]).join("");
}

export async function POST(req: NextRequest) {
  try {
    const { deviceId } = await req.json();
    if (!deviceId || typeof deviceId !== "string") {
      return Response.json({ error: "deviceId が必要です" }, { status: 400 });
    }

    const supabase = getSupabase();

    // ユーザー存在確認
    const { data: users, error: userErr } = await supabase
      .from("users")
      .select("id")
      .eq("device_id", deviceId)
      .limit(1);
    if (userErr) throw userErr;
    if (!users || users.length === 0) {
      return Response.json({ error: "アカウントが見つかりません" }, { status: 404 });
    }
    const userId = users[0].id;

    // 古いコードを削除（同一ユーザーの未使用コード）
    await supabase
      .from("transfer_codes")
      .delete()
      .eq("user_id", userId)
      .is("used_at", null);

    // 新規コード生成（衝突したら最大3回リトライ）
    let code = "";
    for (let i = 0; i < 3; i++) {
      const candidate = generateCode();
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
      const { error } = await supabase.from("transfer_codes").insert({
        code: candidate,
        user_id: userId,
        device_id: deviceId,
        expires_at: expiresAt,
      });
      if (!error) {
        code = candidate;
        break;
      }
      // 衝突は再生成
    }
    if (!code) {
      return Response.json({ error: "コード発行に失敗しました" }, { status: 500 });
    }

    // 表示用に4-4で区切り (例: K7M2-X9P4)
    const display = `${code.slice(0, 4)}-${code.slice(4, 8)}`;
    return Response.json({
      code,
      displayCode: display,
      expiresInMinutes: 60,
    });
  } catch (e) {
    console.error("[transfer/generate] error:", e);
    return Response.json({ error: "サーバーエラーが発生しました" }, { status: 500 });
  }
}
