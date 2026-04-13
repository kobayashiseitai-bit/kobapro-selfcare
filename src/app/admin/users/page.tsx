"use client";
import { useEffect, useState } from "react";

interface User {
  id: string;
  device_id: string;
  created_at: string;
  chatCount: number;
  postureCount: number;
  symptomCount: number;
}

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [debugMsg, setDebugMsg] = useState("loading...");
  const limit = 20;

  useEffect(() => {
    const load = () =>
      fetch(`/api/admin/users?page=${page}&limit=${limit}`, { credentials: "include" })
        .then((r) => { setDebugMsg(`status=${r.status}`); return r.json(); })
        .then((d) => {
          setDebugMsg((p) => `${p} users=${(d.users||[]).length} total=${d.total} err=${d.error||"none"}`);
          setUsers(d.users || []);
          setTotal(d.total || 0);
        })
        .catch((e) => setDebugMsg(`error: ${e}`));
    load();
    const id = setInterval(load, 30000);
    return () => clearInterval(id);
  }, [page]);

  const totalPages = Math.ceil(total / limit);

  return (
    <div>
      <h2 className="text-2xl font-bold mb-4">
        ユーザー一覧 <span className="text-gray-500 text-base font-normal">({total}件)</span>
      </h2>
      <p className="text-xs text-yellow-400 mb-4 font-mono bg-gray-900 p-2 rounded">{debugMsg}</p>

      <div className="space-y-2">
        {users.map((u) => (
          <div key={u.id} className="bg-gray-900 border border-gray-800 rounded-lg p-4 flex items-center justify-between">
            <div>
              <p className="text-white font-mono text-sm">{u.device_id.slice(0, 12)}...</p>
              <p className="text-gray-400 text-xs mt-1">{new Date(u.created_at).toLocaleDateString("ja-JP")} 登録</p>
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
