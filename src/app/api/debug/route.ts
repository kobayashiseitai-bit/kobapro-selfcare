import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "NOT SET";
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "NOT SET";
  return NextResponse.json({
    supabaseUrl: url.substring(0, 20) + "...",
    supabaseKey: key.substring(0, 20) + "...",
    hasUrl: url !== "NOT SET",
    hasKey: key !== "NOT SET",
  });
}
