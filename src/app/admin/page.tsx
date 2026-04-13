"use client";
import { useEffect, useState } from "react";

interface Stats {
  totalUsers: number;
  totalChats: number;
  totalPosture: number;
  totalSymptoms: number;
}

const cards = [
  { key: "totalUsers", label: "ユーザー数", color: "from-blue-500 to-blue-700" },
  { key: "totalChats", label: "チャット数", color: "from-purple-500 to-purple-700" },
  { key: "totalPosture", label: "姿勢記録数", color: "from-emerald-500 to-emerald-700" },
  { key: "totalSymptoms", label: "症状選択数", color: "from-orange-500 to-orange-700" },
] as const;

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    const load = () =>
      fetch("/api/admin/stats", { credentials: "include" })
        .then((r) => r.json())
        .then(setStats);
    load();
    const id = setInterval(load, 30000);
    return () => clearInterval(id);
  }, []);

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">ダッシュボード</h2>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((c) => (
          <div
            key={c.key}
            className="bg-gray-900 rounded-2xl p-6 border border-gray-800"
          >
            <p className="text-gray-400 text-sm mb-2">{c.label}</p>
            <p
              className={`text-3xl font-bold bg-gradient-to-b ${c.color} bg-clip-text text-transparent`}
            >
              {stats ? stats[c.key].toLocaleString() : "..."}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
