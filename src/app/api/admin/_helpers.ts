import { createHash } from "crypto";
import { NextRequest } from "next/server";
import { createServerSupabase } from "../../lib/supabase-server";

const COOKIE_NAME = "admin_session";

function getExpectedToken(): string {
  const pw = process.env.ADMIN_PASSWORD || "";
  return createHash("sha256").update(pw).digest("hex");
}

export function validateAdmin(req: NextRequest): boolean {
  const cookie = req.cookies.get(COOKIE_NAME);
  if (!cookie) return false;
  return cookie.value === getExpectedToken();
}

export function getAdminToken(): string {
  return getExpectedToken();
}

// 読み取りがキャッシュされて古い値が返るのを防ぐため、
// no-store を指定した共通クライアントを使う（supabase-server.ts に経緯あり）
export const getSupabase = createServerSupabase;
