import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
  );
}

/**
 * GET /api/chat/history?deviceId=xxx
 * 過去のチャット履歴を取得してチャット画面復元用に返却
 *
 * ルール:
 * - 直近30分以内の会話は「その場で再開」する想定で返す
 * - 30分以上経っていれば「前回の要約」扱いでchat_logsから取得
 * - 最大直近30件まで返す
 */
export async function GET(req: NextRequest) {
  try {
    const deviceId = req.nextUrl.searchParams.get("deviceId");
    if (!deviceId) {
      return NextResponse.json({ messages: [], hasHistory: false });
    }

    const supabase = getSupabase();
    const { data: users } = await supabase
      .from("users")
      .select("id")
      .eq("device_id", deviceId);

    if (!users || users.length === 0) {
      return NextResponse.json({ messages: [], hasHistory: false });
    }
    const userId = users[0].id;

    // 直近30件のチャットログ（過去30日以内）
    const thirtyDaysAgo = new Date(
      Date.now() - 30 * 24 * 60 * 60 * 1000
    ).toISOString();

    const { data: logs } = await supabase
      .from("chat_logs")
      .select("role, content, created_at")
      .eq("user_id", userId)
      .gte("created_at", thirtyDaysAgo)
      .order("created_at", { ascending: false })
      .limit(30);

    const list = (logs || []).reverse(); // 古い順に並び替え

    if (list.length === 0) {
      return NextResponse.json({ messages: [], hasHistory: false });
    }

    // 最後のメッセージの経過時間を計算
    const lastMsg = list[list.length - 1];
    const lastAt = new Date(lastMsg.created_at).getTime();
    const minutesSinceLast = Math.floor((Date.now() - lastAt) / 60000);
    const hoursSinceLast = Math.floor(minutesSinceLast / 60);
    const daysSinceLast = Math.floor(hoursSinceLast / 24);

    // 30分以内=直接続きから / 30分〜1日=同日の続き / それ以上=前回の記憶扱い
    let resumeMode: "continue" | "same_day" | "previous";
    if (minutesSinceLast <= 30) resumeMode = "continue";
    else if (hoursSinceLast <= 24) resumeMode = "same_day";
    else resumeMode = "previous";

    return NextResponse.json({
      messages: list.map((m) => ({
        role: m.role,
        content: m.content,
        created_at: m.created_at,
      })),
      hasHistory: true,
      lastMessageAt: lastMsg.created_at,
      minutesSinceLast,
      hoursSinceLast,
      daysSinceLast,
      resumeMode,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { error: "failed to load chat history", detail: msg, messages: [], hasHistory: false },
      { status: 500 }
    );
  }
}
