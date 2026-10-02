import { NextRequest, NextResponse } from "next/server";
import { validateAdmin, getSupabase } from "../_helpers";
import {
  isAccountDeletionTicket,
  isFinishedTicketStatus,
} from "../../../lib/support-ticket-markers";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/admin/support?status=pending|in_progress|resolved|all
 * 管理者用: 問い合わせ一覧を取得
 */
export async function GET(req: NextRequest) {
  if (!validateAdmin(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const status = req.nextUrl.searchParams.get("status") || "all";
    const supabase = getSupabase();

    let query = supabase
      .from("support_tickets")
      .select(
        "id, user_id, name, email, category, subject, message, status, reply, device_info, created_at, replied_at"
      )
      .order("created_at", { ascending: false })
      .limit(200);

    if (status !== "all") {
      query = query.eq("status", status);
    }

    const { data, error } = await query;
    if (error) {
      return NextResponse.json(
        { error: "fetch failed", detail: error.message },
        { status: 500 }
      );
    }

    // ステータス別件数も返す
    const { data: allTickets } = await supabase
      .from("support_tickets")
      .select("status");
    const counts = {
      all: allTickets?.length || 0,
      pending: (allTickets || []).filter((t) => t.status === "pending").length,
      in_progress: (allTickets || []).filter((t) => t.status === "in_progress").length,
      resolved: (allTickets || []).filter((t) => t.status === "resolved").length,
    };

    return NextResponse.json({ tickets: data || [], counts });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { error: "failed", detail: msg },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/admin/support
 * Body: { ticketId, status?, reply? }
 * 管理者用: ステータス変更・返信を記録
 *
 * アカウントを削除した方のお問い合わせ（lib/support-ticket-markers.ts の isAccountDeletionTicket。件名の頭に
 * 「【アカウント削除済み・対応後に削除】」があるものと、RevenueCat の「やること」）を「解決済」・「スパム」にしたときは、
 * 状態を変えずに行ごと削除して { ok: true, deleted: true } を返す
 * （/delete-account と privacy の 8. で「対応が終わってから削除します」とお約束しているため。2026-10-02）。
 */
export async function PATCH(req: NextRequest) {
  if (!validateAdmin(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const { ticketId, status, reply } = await req.json();
    if (!ticketId) {
      return NextResponse.json({ error: "ticketId required" }, { status: 400 });
    }

    if (isFinishedTicketStatus(status)) {
      const supabase = getSupabase();
      const { data: ticket, error: findErr } = await supabase
        .from("support_tickets")
        .select("id, user_id, subject, email")
        .eq("id", ticketId)
        .maybeSingle();
      if (findErr) {
        return NextResponse.json(
          { error: "fetch failed", detail: findErr.message },
          { status: 500 }
        );
      }
      if (ticket && isAccountDeletionTicket(ticket)) {
        const { error: delErr, count } = await supabase
          .from("support_tickets")
          .delete({ count: "exact" })
          .eq("id", ticketId);
        if (delErr) {
          return NextResponse.json(
            { error: "delete failed", detail: delErr.message },
            { status: 500 }
          );
        }
        console.log("[admin-support] deleted ticket of a deleted account", JSON.stringify({ ticketId, count }));
        return NextResponse.json({ ok: true, deleted: true });
      }
    }

    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (status) updates.status = status;
    if (reply !== undefined) {
      updates.reply = reply;
      if (reply) updates.replied_at = new Date().toISOString();
    }

    const supabase = getSupabase();
    const { error } = await supabase
      .from("support_tickets")
      .update(updates)
      .eq("id", ticketId);

    if (error) {
      return NextResponse.json(
        { error: "update failed", detail: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { error: "failed", detail: msg },
      { status: 500 }
    );
  }
}
