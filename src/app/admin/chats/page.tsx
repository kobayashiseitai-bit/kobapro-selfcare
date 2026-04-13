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
  const limit = 50;

  useEffect(() => {
    fetch("/api/admin/users?limit=100")
      .then((r) => r.json())
      .then((d) => setUsers(d.users || []));
  }, []);

  useEffect(() => {
    const load = () => {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (userId) params.set("userId", userId);
      fetch(`/api/admin/chats?${params}`)
        .then((r) => r.json())
        .then((d) => {
          setChats(d.chats || []);
          setTotal(d.total || 0);
        });
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

      <div className="space-y-2 max-w-2xl">
        {chats.map((c) => (
          <div
            key={c.id}
            className={`flex ${c.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[85%] px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                c.role === "user"
                  ? "bg-blue-600 rounded-br-md"
                  : "bg-gray-800 rounded-bl-md"
              }`}
            >
              <div className="text-xs text-gray-400 mb-1">
                {new Date(c.created_at).toLocaleString("ja-JP")}
                {c.role === "user" && (
                  <span className="ml-2 text-gray-500 font-mono">
                    {c.user_id.slice(0, 6)}
                  </span>
                )}
              </div>
              <p className="whitespace-pre-wrap">{c.content}</p>
              {c.recommended_symptom && (
                <span className="inline-block mt-2 px-2 py-0.5 bg-purple-600/30 text-purple-300 rounded text-xs">
                  推奨: {SYMPTOM_LABELS[c.recommended_symptom] || c.recommended_symptom}
                </span>
              )}
            </div>
          </div>
        ))}
        {chats.length === 0 && (
          <p className="text-gray-500 text-center py-8">データがありません</p>
        )}
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
