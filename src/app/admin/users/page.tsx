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

const PAIN_LABELS: Record<string, string> = {
  neck: "首", shoulder: "肩", back: "腰", head: "頭",
  knee: "膝", eye: "目", arm: "腕手", leg: "脚足",
};

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const limit = 20;

  const loadUsers = () =>
    fetch(`/api/admin/users?page=${page}&limit=${limit}`, { credentials: "include", cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        setUsers(d.users || []);
        setTotal(d.total || 0);
      });

  useEffect(() => {
    loadUsers();
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
    <div className="max-w-5xl">
      <div className="mb-8">
        <h2 className="text-3xl font-extrabold">ユーザー一覧</h2>
        <p className="text-gray-500 text-sm mt-1">{total}人のユーザーが登録済み · 名前をクリックして編集</p>
      </div>

      <div className="space-y-3">
        {users.map((u) => (
          <div key={u.id} className="bg-gray-900/80 backdrop-blur border border-gray-800 rounded-2xl p-5 hover:border-gray-700 transition-colors">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                {editingId === u.id ? (
                  <div className="flex items-center gap-2 mb-2">
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="px-3 py-1.5 bg-gray-800 border border-blue-500 rounded-lg text-white text-sm w-44"
                      placeholder="名前を入力"
                      autoFocus
                      onKeyDown={(e) => e.key === "Enter" && saveName(u.id)}
                    />
                    <button onClick={() => saveName(u.id)} className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 rounded-lg text-xs text-white font-bold">保存</button>
                    <button onClick={() => setEditingId(null)} className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded-lg text-xs text-white">取消</button>
                  </div>
                ) : (
                  <button
                    onClick={() => { setEditingId(u.id); setEditName(u.name || ""); }}
                    className="text-left hover:bg-gray-800/50 rounded-lg px-2 py-1 -ml-2 transition-colors"
                  >
                    <p className="text-white font-bold text-lg">
                      {u.name || <span className="text-gray-500 italic text-sm">名前未設定（クリックで編集）</span>}
                    </p>
                  </button>
                )}

                <div className="flex items-center gap-3 mt-1 flex-wrap text-xs">
                  {u.prefecture && (
                    <span className="px-2 py-0.5 bg-blue-500/15 text-blue-300 rounded-lg">📍 {u.prefecture}</span>
                  )}
                  {u.age && (
                    <span className="px-2 py-0.5 bg-purple-500/15 text-purple-300 rounded-lg">🎂 {u.age}歳</span>
                  )}
                  <span className="text-gray-600">{new Date(u.created_at).toLocaleDateString("ja-JP")} 登録</span>
                </div>

                {u.pain_areas && (
                  <div className="flex gap-1.5 mt-2 flex-wrap">
                    {u.pain_areas.split(",").map((p) => (
                      <span key={p} className="px-2.5 py-1 bg-red-500/15 text-red-300 rounded-lg text-xs font-semibold">
                        🔴 {PAIN_LABELS[p] || p}
                      </span>
                    ))}
                  </div>
                )}

                {u.concerns && (
                  <p className="text-sm text-gray-400 mt-2 bg-gray-800/50 rounded-lg px-3 py-2">💬 {u.concerns}</p>
                )}
              </div>

              <div className="flex gap-5 ml-4">
                <div className="text-center">
                  <p className="text-2xl font-extrabold text-pink-400">{u.chatCount}</p>
                  <p className="text-gray-500 text-xs">チャット</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-extrabold text-emerald-400">{u.postureCount}</p>
                  <p className="text-gray-500 text-xs">姿勢</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-extrabold text-amber-400">{u.symptomCount}</p>
                  <p className="text-gray-500 text-xs">症状</p>
                </div>
              </div>
            </div>
          </div>
        ))}
        {users.length === 0 && (
          <div className="text-center py-16">
            <p className="text-4xl mb-3">👤</p>
            <p className="text-gray-500">ユーザーがまだいません</p>
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
