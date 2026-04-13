"use client";
import { useEffect, useState } from "react";

interface User {
  id: string;
  device_id: string;
  name: string;
  prefecture: string;
  age: number | null;
  pain_areas: string;
  concerns: string;
  created_at: string;
  chatCount: number;
  postureCount: number;
  symptomCount: number;
}

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const limit = 20;

  const loadUsers = () =>
    fetch(`/api/admin/users?page=${page}&limit=${limit}`, { credentials: "include" })
      .then((r) => r.json())
      .then((d) => {
        setUsers(d.users || []);
        setTotal(d.total || 0);
      });

  useEffect(() => {
    loadUsers();
    const id = setInterval(loadUsers, 30000);
    return () => clearInterval(id);
  }, [page]);

  const saveName = async (userId: string) => {
    await fetch("/api/admin/users-update", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, name: editName }),
      credentials: "include",
    });
    setEditingId(null);
    loadUsers();
  };

  const totalPages = Math.ceil(total / limit);

  return (
    <div>
      <h2 className="text-2xl font-bold mb-4">
        ユーザー一覧 <span className="text-gray-500 text-base font-normal">({total}件)</span>
      </h2>
      <p className="text-xs text-gray-500 mb-4">名前をクリックして編集できます</p>

      <div className="space-y-2">
        {users.map((u) => (
          <div key={u.id} className="bg-gray-900 border border-gray-800 rounded-lg p-4 flex items-center justify-between">
            <div className="flex-1">
              {editingId === u.id ? (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="px-3 py-1 bg-gray-800 border border-gray-600 rounded text-white text-sm w-40"
                    placeholder="名前を入力"
                    autoFocus
                    onKeyDown={(e) => e.key === "Enter" && saveName(u.id)}
                  />
                  <button onClick={() => saveName(u.id)} className="px-3 py-1 bg-blue-600 rounded text-xs text-white">保存</button>
                  <button onClick={() => setEditingId(null)} className="px-3 py-1 bg-gray-700 rounded text-xs text-white">取消</button>
                </div>
              ) : (
                <button
                  onClick={() => { setEditingId(u.id); setEditName(u.name || ""); }}
                  className="text-left hover:bg-gray-800 rounded px-2 py-1 -ml-2"
                >
                  <p className="text-white font-semibold">
                    {u.name || <span className="text-gray-500 italic">名前未設定</span>}
                  </p>
                  <p className="text-gray-500 text-xs font-mono">{u.device_id.slice(0, 12)}...</p>
                </button>
              )}
              <div className="flex items-center gap-3 mt-1 ml-2 flex-wrap">
                {u.prefecture && <span className="text-xs text-gray-400">{u.prefecture}</span>}
                {u.age && <span className="text-xs text-gray-400">{u.age}歳</span>}
                <span className="text-xs text-gray-500">{new Date(u.created_at).toLocaleDateString("ja-JP")} 登録</span>
              </div>
              {u.pain_areas && (
                <div className="flex gap-1 mt-1 ml-2 flex-wrap">
                  {u.pain_areas.split(",").map((p) => (
                    <span key={p} className="px-2 py-0.5 bg-red-600/20 text-red-300 rounded text-xs">{p}</span>
                  ))}
                </div>
              )}
              {u.concerns && (
                <p className="text-xs text-gray-400 mt-1 ml-2">💬 {u.concerns}</p>
              )}
            </div>
            <div className="flex gap-4 text-sm">
              <div className="text-center">
                <p className="text-blue-400 font-bold">{u.chatCount}</p>
                <p className="text-gray-500 text-xs">チャット</p>
              </div>
              <div className="text-center">
                <p className="text-emerald-400 font-bold">{u.postureCount}</p>
                <p className="text-gray-500 text-xs">姿勢</p>
              </div>
              <div className="text-center">
                <p className="text-orange-400 font-bold">{u.symptomCount}</p>
                <p className="text-gray-500 text-xs">症状</p>
              </div>
            </div>
          </div>
        ))}
        {users.length === 0 && (
          <p className="text-gray-500 text-center py-8">データがありません</p>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex justify-center gap-2 mt-4">
          <button onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0}
            className="px-3 py-1 bg-gray-800 rounded-lg text-sm disabled:opacity-30">前へ</button>
          <span className="px-3 py-1 text-sm text-gray-400">{page + 1} / {totalPages}</span>
          <button onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}
            className="px-3 py-1 bg-gray-800 rounded-lg text-sm disabled:opacity-30">次へ</button>
        </div>
      )}
    </div>
  );
}
