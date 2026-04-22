import { createHash } from "crypto";
import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";

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

export function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "",
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
  );
}
