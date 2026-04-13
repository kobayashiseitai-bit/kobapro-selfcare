"use client";
import { useEffect, useState, useCallback } from "react";

interface HealthData {
  status: "ok" | "error";
  responseTime: number;
  timestamp: string;
  counts: {
    users: number;
    chats: number;
    posture: number;
    symptoms: number;
  };
  errors: string[];
}

const cards = [
  { key: "users" as const, label: "ユーザー数", color: "from-blue-500 to-blue-700" },
  { key: "chats" as const, label: "チャット数", color: "from-purple-500 to-purple-700" },
  { key: "posture" as const, label: "姿勢記録数", color: "from-emerald-500 to-emerald-700" },
  { key: "symptoms" as const, label: "症状選択数", color: "from-orange-500 to-orange-700" },
];

export default function AdminDashboard() {
  const [health, setHealth] = useState<HealthData | null>(null);
  const [lastUpdate, setLastUpdate] = useState<string>("");
  const [fetchError, setFetchError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  const fetchHealth = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/health?t=${Date.now()}`, {
        credentials: "include",
        cache: "no-store",
      });
      const data = await res.json();
      setHealth(data);
      setLastUpdate(new Date().toLocaleTimeString("ja-JP"));
      setFetchError(false);
      setRetryCount(0);
    } catch {
      setFetchError(true);
      // 自動リトライ（最大3回、3秒間隔）
      if (retryCount < 3) {
        setRetryCount((c) => c + 1);
        setTimeout(fetchHealth, 3000);
      }
    }
  }, [retryCount]);

  useEffect(() => {
    fetchHealth();
    const id = setInterval(fetchHealth, 10000); // 10秒間隔
    return () => clearInterval(id);
  }, []);

  const statusColor = health?.status === "ok" ? "text-green-400" : "text-red-400";
  const statusBg = health?.status === "ok" ? "bg-green-600/20 border-green-600/30" : "bg-red-600/20 border-red-600/30";

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">ダッシュボード</h2>
        <button
          onClick={fetchHealth}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-semibold transition-colors"
        >
          🔄 今すぐ更新
        </button>
      </div>

      {/* ステータスバー */}
      <div className={`rounded-xl border p-3 mb-6 flex items-center justify-between ${statusBg}`}>
        <div className="flex items-center gap-3">
          <span className={`text-lg ${health?.status === "ok" ? "" : "animate-pulse"}`}>
            {health?.status === "ok" ? "🟢" : fetchError ? "🔴" : "🟡"}
          </span>
          <div>
            <p className={`text-sm font-semibold ${statusColor}`}>
              {health?.status === "ok" ? "システム正常" : fetchError ? "接続エラー（自動リトライ中）" : "確認中..."}
            </p>
            <p className="text-xs text-gray-400">
              最終更新: {lastUpdate || "---"}
              {health?.responseTime ? ` (${health.responseTime}ms)` : ""}
              {" · 10秒ごとに自動更新"}
            </p>
          </div>
        </div>
        {health?.errors && health.errors.length > 0 && (
          <p className="text-xs text-red-300">{health.errors.join(", ")}</p>
        )}
      </div>

      {/* 統計カード */}
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
              {health ? health.counts[c.key].toLocaleString() : "..."}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
