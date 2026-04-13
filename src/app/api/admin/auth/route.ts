import { NextRequest, NextResponse } from "next/server";
import { validateAdmin, getAdminToken } from "../_helpers";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const ok = validateAdmin(req);
  return NextResponse.json({ authenticated: ok });
}

export async function POST(req: NextRequest) {
  try {
    const { password } = await req.json();
    if (!password || password !== process.env.ADMIN_PASSWORD) {
      return NextResponse.json({ error: "invalid password" }, { status: 401 });
    }

    const token = getAdminToken();
    const res = NextResponse.json({ ok: true });
    res.cookies.set("admin_session", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7, // 7 days
    });
    return res;
  } catch {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }
}
