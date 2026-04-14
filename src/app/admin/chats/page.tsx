"use client";
import { useEffect, useState } from "react";

interface Chat {
  id: string;
  user_id: string;
  user_name: string;
  role: string;
  content: string;
  recommended_symptom: string | null;
  created_at: string;
}

interface UserOption {
  id: string;
  device_id: string;
  name: string;
}

const SYMPTOM_LABELS: Record<string, string> = {
  neck: "首こり", shoulder_stiff: "肩こり", shoulder_pain: "肩の痛み",
  back: "腰痛", eye_fatigue: "眼精疲労", eye_recovery: "目の回復",
};

export default function ChatsPage() {
  const [chats, setChats] = useState<Chat[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [userId, setUserId] = useState("");
  const [users, setUsers] = useState<UserOption[]>([]);
  const limit = 50;

  useEffect(() => {
    fetch("/api/admin/users?limit=100", { credentials: "include", cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setUsers(d.users || []));
  }, []);

  useEffect(() => {
    const load = () => {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (userId) params.set("userId", userId);
      fetch(`/api/admin/chats?${params}`, { credentials: "include", cache: "no-store" })
        .then((r) => r.json())
        .then((d) => {
          setChats(d.chats || []);
          setTotal(d.total || 0);
        });
    };
    load();
    const id = setInterval(load, 10000);
    return () => clearInterval(id);
  }, [page, userId]);

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-3xl font-extrabold">チャットログ</h2>
          <p className="text-gray-500 text-sm mt-1">{total}件の会話を記録</p>
        </div>
        <select
          value={userId}
          onChange={(e) => { setUserId(e.target.value); setPage(0); }}
          className="px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-xl text-sm text-white hover:border-gray-600 transition-colors"
        >
          <option value="">👥 全ユーザー</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name || u.device_id.slice(0, 8) + "..."}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-3">
        {chats.map((c) => (
          <div key={c.id} className={`rounded-2xl p-4 border ${
            c.role === "user"
              ? "bg-blue-500/10 border-blue-500/20 ml-8"
              : "bg-gray-800/50 border-gray-700/50 mr-8"
          }`}>
            <div className="flex items-center gap-2 mb-2">
              <span className={`px-2.5 py-1 rounded-lg text-xs font-bold ${
                c.role === "user"
                  ? "bg-blue-500 text-white"
                  : "bg-gradient-to-r from-purple-500 to-pink-500 text-white"
              }`}>
                {c.role === "user" ? "👤 ユーザー" : "🤖 AI"}
              </span>
              {c.role === "user" && c.user_name && (
                <span className="text-sm text-blue-300 font-semibold">{c.user_name}</span>
              )}
              <span className="text-xs text-gray-500 ml-auto">
                {new Date(c.created_at).toLocaleString("ja-JP")}
              </span>
            </div>
            <p className="text-white text-sm whitespace-pre-wrap leading-relaxed">{c.content}</p>
            {c.recommended_symptom && (
              <span className="inline-block mt-2 px-3 py-1 bg-amber-500/15 text-amber-300 rounded-lg text-xs font-semibold">
                ✨ 推奨: {SYMPTOM_LABELS[c.recommended_symptom] || c.recommended_symptom}
              </span>
            )}
          </div>
        ))}
        {chats.length === 0 && (
          <div className="text-center py-16">
            <p className="text-4xl mb-3">💬</p>
            <p className="text-gray-500">チャットデータがありません</p>
          </div>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex justify-center gap-2 mt-6">
          <button onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0}
            className="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-xl text-sm disabled:opacity-30 transition-colors">← 前へ</button>
          <span className="px-4 py-2 text-sm text-gray-400 bg-gray-900 rounded-xl">{page + 1} / {totalPages}</span>
          <button onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}
            className="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-xl text-sm disabled:opacity-30 transition-colors">次へ →</button>
        </div>
      )}
    </div>
  );
}
