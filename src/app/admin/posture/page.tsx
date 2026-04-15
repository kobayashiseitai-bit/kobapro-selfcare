"use client";
import { useEffect, useState } from "react";

interface DiagnosisItem {
  label: string;
  value: number;
  unit: string;
  level: "good" | "caution" | "bad";
  message: string;
  advice: string;
}

interface PostureRecord {
  id: string;
  user_id: string;
  user_name: string;
  diagnosis: DiagnosisItem[];
  image_url: string | null;
  created_at: string;
}

const levelConfig: Record<string, { bg: string; text: string; icon: string }> = {
  good: { bg: "bg-emerald-500/15", text: "text-emerald-400", icon: "✅" },
  caution: { bg: "bg-amber-500/15", text: "text-amber-400", icon: "⚠️" },
  bad: { bg: "bg-red-500/15", text: "text-red-400", icon: "🔴" },
};

export default function PosturePage() {
  const [records, setRecords] = useState<PostureRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [expanded, setExpanded] = useState<string | null>(null);
  const limit = 20;

  useEffect(() => {
    const load = () =>
      fetch(`/api/admin/posture?page=${page}&limit=${limit}`, { credentials: "include", cache: "no-store" })
        .then((r) => r.json())
        .then((d) => {
          setRecords(d.records || []);
          setTotal(d.total || 0);
        });
    load();
  }, [page]);

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="max-w-5xl">
      <div className="mb-8">
        <h2 className="text-3xl font-extrabold">姿勢記録</h2>
        <p className="text-gray-500 text-sm mt-1">{total}件の姿勢チェックデータ · クリックで詳細表示</p>
      </div>

      <div className="space-y-3">
        {records.map((r) => {
          const diag = Array.isArray(r.diagnosis) ? r.diagnosis : [];
          const isExpanded = expanded === r.id;
          const goodCount = diag.filter((d) => d.level === "good").length;
          const totalItems = diag.length;
          return (
            <div key={r.id} className="bg-gray-900/80 border border-gray-800 rounded-2xl overflow-hidden hover:border-gray-700 transition-colors">
              <button
                onClick={() => setExpanded(isExpanded ? null : r.id)}
                className="w-full px-5 py-4 flex items-center gap-4 text-left"
              >
                {r.image_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={r.image_url} alt="" className="w-12 h-14 object-cover rounded-xl border border-gray-700" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-white font-bold">{r.user_name || r.user_id?.slice(0, 8)}</p>
                  <p className="text-xs text-gray-500">{new Date(r.created_at).toLocaleString("ja-JP")}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`px-3 py-1 rounded-xl text-xs font-bold ${
                    goodCount === totalItems
                      ? "bg-emerald-500/15 text-emerald-400"
                      : goodCount >= totalItems / 2
                      ? "bg-amber-500/15 text-amber-400"
                      : "bg-red-500/15 text-red-400"
                  }`}>
                    {goodCount}/{totalItems} 良好
                  </span>
                  <span className="text-gray-600 text-lg">{isExpanded ? "▲" : "▼"}</span>
                </div>
              </button>

              {isExpanded && (
                <div className="px-5 pb-5 border-t border-gray-800 pt-4">
                  {r.image_url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={r.image_url} alt="" className="w-52 rounded-xl border border-gray-700 mb-4" />
                  )}
                  <div className="space-y-2">
                    {diag.map((d, i) => {
                      const cfg = levelConfig[d.level] || levelConfig.good;
                      return (
                        <div key={i} className={`${cfg.bg} rounded-xl px-4 py-3 flex items-center gap-4`}>
                          <span className="text-lg">{cfg.icon}</span>
                          <div className="flex-1">
                            <p className={`font-bold text-sm ${cfg.text}`}>{d.label}</p>
                            <p className="text-gray-400 text-xs mt-0.5">{d.message}</p>
                          </div>
                          <span className={`font-mono text-sm ${cfg.text}`}>
                            {typeof d.value === "number" ? d.value.toFixed(1) : d.value}{d.unit}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })}
        {records.length === 0 && (
          <div className="text-center py-16">
            <p className="text-4xl mb-3">🧍</p>
            <p className="text-gray-500">姿勢記録がありません</p>
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
