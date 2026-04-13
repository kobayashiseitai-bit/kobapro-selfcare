"use client";
import { useEffect, useState } from "react";

interface Chat {
  id: string;
  user_id: string;
  role: string;
  content: string;
  recommended_symptom: string | null;
  created_at: string;
}

interface UserOption {
  id: string;
  device_id: string;
}

const SYMPTOM_LABELS: Record<string, string> = {
  neck: "首こり",
  shoulder_stiff: "肩こり",
  shoulder_pain: "肩の痛み",
  back: "腰痛",
  eye_fatigue: "眼精疲労",
  eye_recovery: "目の回復",
};

export default function ChatsPage() {
  const [chats, setChats] = useState<Chat[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [userId, setUserId] = useState("");
  const [users, setUsers] = useState<UserOption[]>([]);
  const [debugMsg, setDebugMsg] = useState("");
  const limit = 50;

  useEffect(() => {
    fetch("/api/admin/users?limit=100", { credentials: "include" })
      .then((r) => r.json())
      .then((d) => setUsers(d.users || []));
  }, []);

  useEffect(() => {
    const load = () => {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (userId) params.set("userId", userId);
      fetch(`/api/admin/chats?${params}`, { credentials: "include" })
        .then((r) => {
          setDebugMsg(`status=${r.status}`);
          return r.json();
        })
        .then((d) => {
          setDebugMsg((prev) => `${prev} total=${d.total} chats=${(d.chats||[]).length} err=${d.error||"none"}`);
          setChats(d.chats || []);
          setTotal(d.total || 0);
        })
        .catch((e) => setDebugMsg(`fetch error: ${e}`));
    };
    load();
    const id = setInterval(load, 30000);
    return () => clearInterval(id);
  }, [page, userId]);

  const totalPages = Math.ceil(total / limit);

  return (
    <div>
      <div className="flex items-center gap-4 mb-6">
        <h2 className="text-2xl font-bold">
          チャットログ <span className="text-gray-500 text-base font-normal">({total}件)</span>
        </h2>
        <select
          value={userId}
          onChange={(e) => {
            setUserId(e.target.value);
            setPage(0);
          }}
          className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white"
        >
          <option value="">全ユーザー</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.device_id.slice(0, 8)}...
            </option>
          ))}
        </select>
      </div>

      <div className="bg-gray-900 rounded-2xl border border-gray-800 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800 text-gray-400">
              <th className="text-left px-4 py-3 w-40">日時</th>
              <th className="text-left px-4 py-3 w-20">役割</th>
              <th className="text-left px-4 py-3">内容</th>
              <th className="text-left px-4 py-3 w-24">推奨</th>
            </tr>
          </thead>
          <tbody>
            {chats.map((c) => (
              <tr key={c.id} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">
                  {new Date(c.created_at).toLocaleString("ja-JP")}
                </td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded text-xs ${
                    c.role === "user" ? "bg-blue-600/30 text-blue-300" : "bg-gray-700 text-gray-300"
                  }`}>
                    {c.role === "user" ? "ユーザー" : "AI"}
                  </span>
                </td>
                <td className="px-4 py-3 text-white whitespace-pre-wrap">{c.content}</td>
                <td className="px-4 py-3">
                  {c.recommended_symptom && (
                    <span className="px-2 py-0.5 bg-purple-600/30 text-purple-300 rounded text-xs">
                      {SYMPTOM_LABELS[c.recommended_symptom] || c.recommended_symptom}
                    </span>
                  )}
                </td>
              </tr>
            ))}
            {chats.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-gray-500">データがありません</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex justify-center gap-2 mt-4">
          <button
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
            className="px-3 py-1 bg-gray-800 rounded-lg text-sm disabled:opacity-30"
          >
            前へ
          </button>
          <span className="px-3 py-1 text-sm text-gray-400">
            {page + 1} / {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={page >= totalPages - 1}
            className="px-3 py-1 bg-gray-800 rounded-lg text-sm disabled:opacity-30"
          >
            次へ
          </button>
        </div>
      )}
    </div>
  );
}
