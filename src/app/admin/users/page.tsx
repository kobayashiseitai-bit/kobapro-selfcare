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
  const limit = 20;

  useEffect(() => {
    fetch(`/api/admin/users?page=${page}&limit=${limit}`)
      .then((r) => r.json())
      .then((d) => {
        setUsers(d.users || []);
        setTotal(d.total || 0);
      });
  }, [page]);

  const totalPages = Math.ceil(total / limit);

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">
        ユーザー一覧 <span className="text-gray-500 text-base font-normal">({total}件)</span>
      </h2>
      <div className="bg-gray-900 rounded-2xl border border-gray-800 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800 text-gray-400">
              <th className="text-left px-4 py-3">Device ID</th>
              <th className="text-left px-4 py-3">登録日</th>
              <th className="text-right px-4 py-3">チャット</th>
              <th className="text-right px-4 py-3">姿勢記録</th>
              <th className="text-right px-4 py-3">症状選択</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr
                key={u.id}
                className="border-b border-gray-800/50 hover:bg-gray-800/30"
              >
                <td className="px-4 py-3 font-mono text-xs text-gray-300">
                  {u.device_id.slice(0, 8)}...
                </td>
                <td className="px-4 py-3 text-gray-400">
                  {new Date(u.created_at).toLocaleDateString("ja-JP")}
                </td>
                <td className="px-4 py-3 text-right">{u.chatCount}</td>
                <td className="px-4 py-3 text-right">{u.postureCount}</td>
                <td className="px-4 py-3 text-right">{u.symptomCount}</td>
              </tr>
            ))}
            {users.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                  データがありません
                </td>
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
