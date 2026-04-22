import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";

// Resend メール通知: 2026-04-18 環境変数適用版
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "",
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
  );
}

// 有効なカテゴリ一覧
const VALID_CATEGORIES = ["feature", "bug", "account", "feedback", "other"];

const CATEGORY_META: Record<string, { label: string; emoji: string }> = {
  feature: { label: "機能について", emoji: "💡" },
  bug: { label: "不具合・バグ報告", emoji: "🐛" },
  account: { label: "アカウント・課金", emoji: "💳" },
  feedback: { label: "要望・提案", emoji: "📣" },
  other: { label: "その他", emoji: "❓" },
};

/**
 * Resendを使ってメール送信（失敗してもthrowしない）
 */
async function sendEmails(payload: {
  ticketId: string;
  name: string;
  email: string;
  category: string;
  subject: string | null;
  message: string;
}) {
  const apiKey = process.env.RESEND_API_KEY;
  const adminEmail = process.env.SUPPORT_NOTIFICATION_EMAIL;
  if (!apiKey) {
    console.warn("[support] RESEND_API_KEY not set, skipping email");
    return { notified: false, replied: false };
  }

  const resend = new Resend(apiKey);
  const cat = CATEGORY_META[payload.category] || CATEGORY_META.other;
  const now = new Date().toLocaleString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
  const adminUrl = "https://posture-app-steel.vercel.app/admin/support";

  // 1. 管理者宛の通知メール
  let notified = false;
  if (adminEmail) {
    try {
      const adminHtml = `
<!DOCTYPE html>
<html>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Hiragino Sans', 'Noto Sans JP', sans-serif; background:#f3f4f6; padding:20px; color:#111;">
  <div style="max-width:600px; margin:0 auto; background:white; border-radius:16px; overflow:hidden; box-shadow:0 4px 12px rgba(0,0,0,0.08);">
    <div style="background:linear-gradient(135deg,#10b981,#059669); padding:24px 28px;">
      <h1 style="margin:0; color:white; font-size:20px;">📮 新しいお問い合わせ</h1>
      <p style="margin:4px 0 0; color:#d1fae5; font-size:13px;">ZERO-PAIN サポート</p>
    </div>
    <div style="padding:24px 28px;">
      <table style="width:100%; font-size:14px; line-height:1.7;">
        <tr><td style="color:#6b7280; padding:4px 0; width:110px;">カテゴリ</td>
          <td style="padding:4px 0;"><strong>${cat.emoji} ${cat.label}</strong></td></tr>
        <tr><td style="color:#6b7280; padding:4px 0;">お名前</td>
          <td style="padding:4px 0;">${escapeHtml(payload.name)}</td></tr>
        <tr><td style="color:#6b7280; padding:4px 0;">メールアドレス</td>
          <td style="padding:4px 0;"><a href="mailto:${escapeHtml(payload.email)}?subject=Re: ${escapeHtml(
            payload.subject || "お問い合わせ"
          )}" style="color:#10b981;">${escapeHtml(payload.email)}</a></td></tr>
        ${payload.subject ? `<tr><td style="color:#6b7280; padding:4px 0;">件名</td><td style="padding:4px 0;"><strong>${escapeHtml(payload.subject)}</strong></td></tr>` : ""}
        <tr><td style="color:#6b7280; padding:4px 0;">受信日時</td>
          <td style="padding:4px 0;">${now}</td></tr>
      </table>
      <hr style="margin:20px 0; border:none; border-top:1px solid #e5e7eb;" />
      <p style="color:#6b7280; font-size:13px; margin:0 0 8px;">お問い合わせ内容</p>
      <div style="background:#f9fafb; border-left:3px solid #10b981; padding:12px 16px; border-radius:4px; white-space:pre-wrap; font-size:14px; line-height:1.7;">${escapeHtml(payload.message)}</div>
      <div style="margin-top:24px; text-align:center;">
        <a href="${adminUrl}" style="display:inline-block; background:#10b981; color:white; padding:12px 28px; border-radius:10px; text-decoration:none; font-weight:bold; font-size:14px;">📱 管理画面で開く</a>
      </div>
    </div>
    <div style="padding:16px 28px; background:#f9fafb; border-top:1px solid #e5e7eb; color:#9ca3af; font-size:11px; text-align:center;">
      ticketId: ${payload.ticketId}<br/>
      ZERO-PAIN by TopBank, Inc.
    </div>
  </div>
</body>
</html>`;

      await resend.emails.send({
        from: "ZERO-PAIN Support <onboarding@resend.dev>",
        to: adminEmail,
        replyTo: payload.email,
        subject: `${cat.emoji} [ZERO-PAIN] 新しいお問い合わせ: ${cat.label}`,
        html: adminHtml,
      });
      notified = true;
    } catch (err) {
      console.error("[support] admin email failed:", err);
    }
  }

  // 2. ユーザーへの自動返信メール
  let replied = false;
  try {
    const userHtml = `
<!DOCTYPE html>
<html>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Hiragino Sans', 'Noto Sans JP', sans-serif; background:#f3f4f6; padding:20px; color:#111;">
  <div style="max-width:560px; margin:0 auto; background:white; border-radius:16px; overflow:hidden; box-shadow:0 4px 12px rgba(0,0,0,0.08);">
    <div style="background:linear-gradient(135deg,#10b981,#059669); padding:28px 24px; text-align:center;">
      <h1 style="margin:0; color:white; font-size:22px;">✉️ お問い合わせを受け付けました</h1>
    </div>
    <div style="padding:24px 28px; font-size:14px; line-height:1.8; color:#1f2937;">
      <p>${escapeHtml(payload.name)} 様</p>
      <p>このたびは ZERO-PAIN にお問い合わせいただきありがとうございます。<br/>
      下記の内容で受け付けました。<strong>通常 3 営業日以内</strong> にご返信いたします。</p>

      <div style="background:#f9fafb; border-radius:10px; padding:16px 18px; margin:16px 0;">
        <p style="margin:0 0 6px; color:#6b7280; font-size:12px;">カテゴリ</p>
        <p style="margin:0 0 12px; font-weight:bold;">${cat.emoji} ${cat.label}</p>
        ${payload.subject ? `<p style="margin:0 0 6px; color:#6b7280; font-size:12px;">件名</p><p style="margin:0 0 12px; font-weight:bold;">${escapeHtml(payload.subject)}</p>` : ""}
        <p style="margin:0 0 6px; color:#6b7280; font-size:12px;">お問い合わせ内容</p>
        <p style="margin:0; white-space:pre-wrap; font-size:13px; line-height:1.7;">${escapeHtml(payload.message)}</p>
      </div>

      <p style="color:#6b7280; font-size:13px;">
        このメールは自動送信されています。本メールには返信しないでください。<br/>
        追加のご質問は、アプリ内のサポート画面から再度お問い合わせください。
      </p>
    </div>
    <div style="padding:16px 28px; background:#f9fafb; border-top:1px solid #e5e7eb; color:#9ca3af; font-size:11px; text-align:center;">
      ZERO-PAIN by TopBank, Inc.（有限会社トップバンク）<br/>
      <a href="https://posture-app-steel.vercel.app/privacy" style="color:#10b981;">プライバシーポリシー</a> ・
      <a href="https://posture-app-steel.vercel.app/terms" style="color:#10b981;">利用規約</a>
    </div>
  </div>
</body>
</html>`;

    await resend.emails.send({
      from: "ZERO-PAIN Support <onboarding@resend.dev>",
      to: payload.email,
      replyTo: adminEmail || "noreply@resend.dev",
      subject: "【ZERO-PAIN】お問い合わせを受け付けました",
      html: userHtml,
    });
    replied = true;
  } catch (err) {
    console.error("[support] auto-reply email failed:", err);
  }

  return { notified, replied };
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

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

    // メール送信（非同期・失敗してもレスポンスには影響しない）
    const emailResult = await sendEmails({
      ticketId: data?.id || "",
      name: name.trim(),
      email: email.trim(),
      category,
      subject: subject ? String(subject).trim() : null,
      message: message.trim(),
    });

    return NextResponse.json({
      ok: true,
      ticketId: data?.id,
      emailSent: emailResult,
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
