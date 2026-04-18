"use client";

import { useCallback, useEffect, useState } from "react";

type Ticket = {
  id: string;
  user_id: string | null;
  name: string;
  email: string;
  category: string;
  subject: string | null;
  message: string;
  status: "pending" | "in_progress" | "resolved" | "spam";
  reply: string | null;
  device_info: string | null;
  created_at: string;
  replied_at: string | null;
};

const CATEGORY_LABELS: Record<string, { label: string; emoji: string; color: string }> = {
  feature: { label: "機能", emoji: "💡", color: "bg-blue-500/20 text-blue-300" },
  bug: { label: "不具合", emoji: "🐛", color: "bg-red-500/20 text-red-300" },
  account: { label: "アカウント", emoji: "💳", color: "bg-amber-500/20 text-amber-300" },
  feedback: { label: "要望", emoji: "📣", color: "bg-purple-500/20 text-purple-300" },
  other: { label: "その他", emoji: "❓", color: "bg-gray-500/20 text-gray-300" },
};

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  pending: { label: "未対応", color: "bg-red-500/20 text-red-300 border-red-500/30" },
  in_progress: { label: "対応中", color: "bg-amber-500/20 text-amber-300 border-amber-500/30" },
  resolved: { label: "解決済", color: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30" },
  spam: { label: "スパム", color: "bg-gray-500/20 text-gray-400 border-gray-500/30" },
};

export default function AdminSupportPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "pending" | "in_progress" | "resolved">("pending");
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [replyDraft, setReplyDraft] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/support?status=${filter}`);
      const data = await res.json();
      setTickets(data.tickets || []);
      setCounts(data.counts || {});
    } catch {
      setTickets([]);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    load();
  }, [load]);

  const openTicket = (t: Ticket) => {
    setSelectedTicket(t);
    setReplyDraft(t.reply || "");
  };

  const closeTicket = () => {
    setSelectedTicket(null);
    setReplyDraft("");
  };

  const updateStatus = async (newStatus: Ticket["status"]) => {
    if (!selectedTicket) return;
    setSaving(true);
    try {
      await fetch("/api/admin/support", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ticketId: selectedTicket.id,
          status: newStatus,
          reply: replyDraft !== selectedTicket.reply ? replyDraft : undefined,
        }),
      });
      setSelectedTicket({ ...selectedTicket, status: newStatus, reply: replyDraft });
      await load();
    } finally {
      setSaving(false);
    }
  };

  const saveReply = async () => {
    if (!selectedTicket) return;
    setSaving(true);
    try {
      await fetch("/api/admin/support", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ticketId: selectedTicket.id,
          reply: replyDraft,
        }),
      });
      await load();
      alert("✅ 返信メモを保存しました");
    } finally {
      setSaving(false);
    }
  };

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleString("ja-JP", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });

  return (
    <div className="p-8 space-y-6 text-white">
      <div>
        <h1 className="text-3xl font-extrabold">📮 サポート問い合わせ</h1>
        <p className="text-sm text-gray-500 mt-1">
          ユーザーからのお問い合わせを管理
        </p>
      </div>

      {/* フィルタータブ */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2">
        {(["pending", "in_progress", "resolved", "all"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-full text-sm font-bold whitespace-nowrap transition ${
              filter === f
                ? "bg-gradient-to-r from-red-500 to-pink-500 text-white"
                : "bg-gray-800 text-gray-400 border border-gray-700"
            }`}
          >
            {f === "pending" && "🔴 未対応"}
            {f === "in_progress" && "🟡 対応中"}
            {f === "resolved" && "🟢 解決済"}
            {f === "all" && "📋 すべて"}
            <span className="ml-2 opacity-80">
              ({counts[f] ?? 0})
            </span>
          </button>
        ))}
      </div>

      {/* チケット一覧 */}
      {loading ? (
        <div className="text-center text-gray-500 py-20">読み込み中...</div>
      ) : tickets.length === 0 ? (
        <div className="text-center text-gray-500 py-20">
          該当するお問い合わせはありません
        </div>
      ) : (
        <div className="space-y-2">
          {tickets.map((t) => {
            const cat = CATEGORY_LABELS[t.category] || CATEGORY_LABELS.other;
            const stat = STATUS_LABELS[t.status] || STATUS_LABELS.pending;
            return (
              <button
                key={t.id}
                onClick={() => openTicket(t)}
                className="w-full bg-gray-900 border border-gray-800 hover:bg-gray-800 rounded-xl p-4 text-left transition"
              >
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <span className={`text-[11px] px-2 py-0.5 rounded-full border ${stat.color}`}>
                    {stat.label}
                  </span>
                  <span className={`text-[11px] px-2 py-0.5 rounded-full ${cat.color}`}>
                    {cat.emoji} {cat.label}
                  </span>
                  <span className="text-[11px] text-gray-500 ml-auto">
                    {formatDate(t.created_at)}
                  </span>
                </div>
                <p className="text-sm font-bold text-white mb-0.5">
                  {t.subject || "(件名なし)"}
                </p>
                <p className="text-xs text-gray-400 mb-1.5">
                  {t.name} &lt;{t.email}&gt;
                </p>
                <p className="text-xs text-gray-300 line-clamp-2">
                  {t.message}
                </p>
              </button>
            );
          })}
        </div>
      )}

      {/* 詳細モーダル */}
      {selectedTicket && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={closeTicket}
        >
          <div
            className="w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-gray-900 border border-gray-700 rounded-2xl p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <span
                    className={`text-[11px] px-2 py-0.5 rounded-full border ${
                      STATUS_LABELS[selectedTicket.status]?.color
                    }`}
                  >
                    {STATUS_LABELS[selectedTicket.status]?.label}
                  </span>
                  <span
                    className={`text-[11px] px-2 py-0.5 rounded-full ${
                      CATEGORY_LABELS[selectedTicket.category]?.color
                    }`}
                  >
                    {CATEGORY_LABELS[selectedTicket.category]?.emoji}{" "}
                    {CATEGORY_LABELS[selectedTicket.category]?.label}
                  </span>
                </div>
                <h2 className="text-xl font-extrabold text-white">
                  {selectedTicket.subject || "(件名なし)"}
                </h2>
                <p className="text-sm text-gray-400 mt-1">
                  <span className="font-bold">{selectedTicket.name}</span> &lt;
                  <a
                    href={`mailto:${selectedTicket.email}?subject=Re: ${
                      selectedTicket.subject || "お問い合わせ"
                    }`}
                    className="text-emerald-400 underline"
                  >
                    {selectedTicket.email}
                  </a>
                  &gt;
                </p>
                <p className="text-[11px] text-gray-500 mt-0.5">
                  受信: {formatDate(selectedTicket.created_at)}
                </p>
              </div>
              <button
                onClick={closeTicket}
                className="text-2xl text-gray-500 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="bg-gray-800 rounded-lg p-4">
              <p className="text-[11px] text-gray-500 mb-2 font-bold">お問い合わせ内容</p>
              <p className="text-sm text-gray-100 whitespace-pre-wrap leading-relaxed">
                {selectedTicket.message}
              </p>
            </div>

            {selectedTicket.device_info && (
              <div className="bg-gray-800/50 rounded-lg p-3">
                <p className="text-[11px] text-gray-500 mb-1 font-bold">環境情報</p>
                <p className="text-[11px] text-gray-400 break-all">
                  {selectedTicket.device_info}
                </p>
              </div>
            )}

            <div>
              <label className="block text-[11px] text-gray-400 mb-1.5 font-bold">
                返信メモ（管理用）
              </label>
              <textarea
                value={replyDraft}
                onChange={(e) => setReplyDraft(e.target.value)}
                placeholder="返信内容やメモを記録（ユーザーには表示されません）"
                rows={5}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500 resize-none"
              />
              <p className="text-[11px] text-gray-500 mt-1">
                返信は上の メールアドレスをクリックして直接送信してください
              </p>
            </div>

            <div className="flex gap-2 flex-wrap pt-2">
              <button
                onClick={saveReply}
                disabled={saving}
                className="flex-1 px-4 py-2.5 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm font-bold disabled:opacity-50"
              >
                💾 メモを保存
              </button>
              <button
                onClick={() => updateStatus("in_progress")}
                disabled={saving || selectedTicket.status === "in_progress"}
                className="px-4 py-2.5 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 rounded-lg text-sm font-bold"
              >
                🟡 対応中にする
              </button>
              <button
                onClick={() => updateStatus("resolved")}
                disabled={saving || selectedTicket.status === "resolved"}
                className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 rounded-lg text-sm font-bold"
              >
                🟢 解決済にする
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
