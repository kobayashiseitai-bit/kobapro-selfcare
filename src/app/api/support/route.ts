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

// 有効なカテゴリ一覧
const VALID_CATEGORIES = ["feature", "bug", "account", "feedback", "other"];

/**
 * POST /api/support
 * Body: { name, email, category, subject?, message, deviceId? }
 * 新規サポート問い合わせを受け付ける
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, email, category, subject, message, deviceId } = body;

    // バリデーション
    if (!name || typeof name !== "string" || !name.trim()) {
      return NextResponse.json(
        { error: "お名前は必須です" },
        { status: 400 }
      );
    }
    if (!email || typeof email !== "string" || !email.trim()) {
      return NextResponse.json(
        { error: "メールアドレスは必須です" },
        { status: 400 }
      );
    }
    // 簡易メールバリデーション
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      return NextResponse.json(
        { error: "正しいメールアドレスを入力してください" },
        { status: 400 }
      );
    }
    if (!category || !VALID_CATEGORIES.includes(category)) {
      return NextResponse.json(
        { error: "カテゴリを正しく選択してください" },
        { status: 400 }
      );
    }
    if (!message || typeof message !== "string" || message.trim().length < 5) {
      return NextResponse.json(
        { error: "お問い合わせ内容は5文字以上入力してください" },
        { status: 400 }
      );
    }
    if (message.length > 4000) {
      return NextResponse.json(
        { error: "お問い合わせ内容は4000文字以下にしてください" },
        { status: 400 }
      );
    }

    const supabase = getSupabase();

    // デバイスIDからユーザーIDを取得（任意・紐付け用）
    let userId: string | null = null;
    if (deviceId && typeof deviceId === "string") {
      const { data: users } = await supabase
        .from("users")
        .select("id")
        .eq("device_id", deviceId);
      if (users && users.length > 0) {
        userId = users[0].id;
      }
    }

    // User-Agentなどデバイス情報を取得（デバッグ用）
    const userAgent = req.headers.get("user-agent") || "";
    const deviceInfo = userAgent.slice(0, 500); // 長さ制限

    const { data, error } = await supabase
      .from("support_tickets")
      .insert({
        user_id: userId,
        name: name.trim().slice(0, 100),
        email: email.trim().toLowerCase().slice(0, 255),
        category,
        subject: subject ? String(subject).trim().slice(0, 200) : null,
        message: message.trim().slice(0, 4000),
        status: "pending",
        device_id: deviceId ? String(deviceId).slice(0, 100) : null,
        device_info: deviceInfo,
      })
      .select("id")
      .single();

    if (error) {
      console.error("Support ticket insert error:", error);
      return NextResponse.json(
        { error: "送信に失敗しました。しばらくしてから再度お試しください。", detail: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      ticketId: data?.id,
      message: "お問い合わせを受け付けました。通常3営業日以内にご返信いたします。",
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("Support API error:", e);
    return NextResponse.json(
      { error: "送信に失敗しました", detail: msg },
      { status: 500 }
    );
  }
}

/**
 * GET /api/support?deviceId=xxx
 * 自分が送った問い合わせ一覧を返す（返信状況の確認用）
 */
export async function GET(req: NextRequest) {
  try {
    const deviceId = req.nextUrl.searchParams.get("deviceId");
    if (!deviceId) {
      return NextResponse.json({ tickets: [] });
    }

    const supabase = getSupabase();
    const { data: users } = await supabase
      .from("users")
      .select("id")
      .eq("device_id", deviceId);

    if (!users || users.length === 0) {
      return NextResponse.json({ tickets: [] });
    }

    const { data } = await supabase
      .from("support_tickets")
      .select("id, category, subject, message, status, reply, created_at, replied_at")
      .eq("user_id", users[0].id)
      .order("created_at", { ascending: false })
      .limit(20);

    return NextResponse.json({ tickets: data || [] });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { error: "failed", detail: msg, tickets: [] },
      { status: 500 }
    );
  }
}
