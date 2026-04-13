import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "../_helpers";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const { userId, name } = await req.json();
    if (!userId) {
      return NextResponse.json({ error: "userId required" }, { status: 400 });
    }

    const supabase = getSupabase();
    const { error } = await supabase
      .from("users")
      .update({ name: name || "" })
      .eq("id", userId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
