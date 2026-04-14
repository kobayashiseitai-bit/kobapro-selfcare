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
  { key: "users" as const, label: "ユーザー数", icon: "👤", gradient: "from-violet-500 to-purple-600", shadow: "shadow-violet-500/20" },
  { key: "chats" as const, label: "チャット数", icon: "💬", gradient: "from-pink-500 to-rose-600", shadow: "shadow-pink-500/20" },
  { key: "posture" as const, label: "姿勢記録数", icon: "🧍", gradient: "from-emerald-500 to-green-600", shadow: "shadow-emerald-500/20" },
  { key: "symptoms" as const, label: "症状選択数", icon: "📋", gradient: "from-amber-500 to-orange-600", shadow: "shadow-amber-500/20" },
];

export default function AdminDashboard() {
  const [health, setHealth] = useState<HealthData | null>(null);
  const [lastUpdate, setLastUpdate] = useState<string>("");
  const [fetchError, setFetchError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [pulse, setPulse] = useState(false);

  const fetchHealth = useCallback(async () => {
    setPulse(true);
    setTimeout(() => setPulse(false), 500);
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
      if (retryCount < 3) {
        setRetryCount((c) => c + 1);
        setTimeout(fetchHealth, 3000);
      }
    }
  }, [retryCount]);

  useEffect(() => {
    fetchHealth();
    const id = setInterval(fetchHealth, 10000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="max-w-5xl">
      {/* ヘッダー */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-3xl font-extrabold">ダッシュボード</h2>
          <p className="text-gray-500 text-sm mt-1">リアルタイムデータ概要</p>
        </div>
        <button
          onClick={fetchHealth}
          className={`px-5 py-2.5 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-400 hover:to-cyan-400 rounded-xl text-sm font-bold transition-all shadow-lg shadow-blue-500/20 ${pulse ? "scale-95" : ""}`}
        >
          🔄 今すぐ更新
        </button>
      </div>

      {/* ステータスバー */}
      <div className={`rounded-2xl border p-4 mb-8 flex items-center justify-between ${
        health?.status === "ok"
          ? "bg-emerald-500/10 border-emerald-500/20"
          : fetchError
          ? "bg-red-500/10 border-red-500/20"
          : "bg-yellow-500/10 border-yellow-500/20"
      }`}>
        <div className="flex items-center gap-4">
          <div className={`w-3 h-3 rounded-full ${
            health?.status === "ok" ? "bg-emerald-400" : fetchError ? "bg-red-400 animate-pulse" : "bg-yellow-400 animate-pulse"
          }`} />
          <div>
            <p className={`text-sm font-bold ${
              health?.status === "ok" ? "text-emerald-400" : fetchError ? "text-red-400" : "text-yellow-400"
            }`}>
              {health?.status === "ok" ? "システム正常稼働中" : fetchError ? "接続エラー（自動リトライ中）" : "確認中..."}
            </p>
            <p className="text-xs text-gray-500 mt-0.5">
              最終更新: {lastUpdate || "---"}
              {health?.responseTime ? ` · 応答 ${health.responseTime}ms` : ""}
              {" · 10秒ごとに自動更新"}
            </p>
          </div>
        </div>
        {health?.errors && health.errors.length > 0 && (
          <p className="text-xs text-red-300 bg-red-500/10 px-3 py-1 rounded-lg">{health.errors.join(", ")}</p>
        )}
      </div>

      {/* 統計カード */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
        {cards.map((c) => (
          <div
            key={c.key}
            className={`bg-gradient-to-br ${c.gradient} rounded-2xl p-6 shadow-xl ${c.shadow} relative overflow-hidden`}
          >
            <div className="absolute top-3 right-3 text-4xl opacity-20">{c.icon}</div>
            <p className="text-white/80 text-xs font-semibold uppercase tracking-wider mb-3">{c.label}</p>
            <p className="text-4xl font-extrabold text-white">
              {health ? health.counts[c.key].toLocaleString() : "..."}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
