"use client";
import { useEffect, useState } from "react";

interface DiagnosisItem {
  label: string;
  value: number;
  unit: string;
  level: "good" | "caution" | "bad";
  message: string;
}

interface PostureRecord {
  id: string;
  user_id: string;
  diagnosis: DiagnosisItem[];
  image_url: string | null;
  created_at: string;
}

const levelStyle: Record<string, string> = {
  good: "bg-green-600/20 text-green-400",
  caution: "bg-yellow-600/20 text-yellow-400",
  bad: "bg-red-600/20 text-red-400",
};

export default function PosturePage() {
  const [records, setRecords] = useState<PostureRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [expanded, setExpanded] = useState<string | null>(null);
  const limit = 20;

  useEffect(() => {
    fetch(`/api/admin/posture?page=${page}&limit=${limit}`)
      .then((r) => r.json())
      .then((d) => {
        setRecords(d.records || []);
        setTotal(d.total || 0);
      });
  }, [page]);

  const totalPages = Math.ceil(total / limit);

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">
        姿勢記録 <span className="text-gray-500 text-base font-normal">({total}件)</span>
      </h2>

      <div className="space-y-3">
        {records.map((r) => {
          const diag = Array.isArray(r.diagnosis) ? r.diagnosis : [];
          const isExpanded = expanded === r.id;
          return (
            <div
              key={r.id}
              className="bg-gray-900 rounded-2xl border border-gray-800 overflow-hidden"
            >
              <button
                onClick={() => setExpanded(isExpanded ? null : r.id)}
                className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-gray-800/30"
              >
                <div className="flex items-center gap-4">
                  {r.image_url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={r.image_url} alt="" className="w-10 h-12 object-cover rounded" />
                  )}
                  <span className="text-sm text-gray-400">
                    {new Date(r.created_at).toLocaleString("ja-JP")}
                  </span>
                  <span className="text-xs text-gray-500 font-mono">
                    {r.user_id.slice(0, 8)}
                  </span>
                </div>
                <div className="flex gap-1">
                  {diag.map((d, i) => (
                    <span
                      key={i}
                      className={`px-2 py-0.5 rounded text-xs ${levelStyle[d.level] || "text-gray-400"}`}
                    >
                      {d.label}
                    </span>
                  ))}
                </div>
              </button>
              {isExpanded && (
                <div className="px-4 pb-4 border-t border-gray-800 pt-3">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-gray-500">
                        <th className="text-left py-1">項目</th>
                        <th className="text-right py-1">値</th>
                        <th className="text-left py-1 pl-4">状態</th>
                        <th className="text-left py-1 pl-4">メッセージ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {diag.map((d, i) => (
                        <tr key={i} className="border-t border-gray-800/50">
                          <td className="py-2">{d.label}</td>
                          <td className="py-2 text-right font-mono">
                            {typeof d.value === "number" ? d.value.toFixed(3) : d.value}
                            {d.unit}
                          </td>
                          <td className="py-2 pl-4">
                            <span
                              className={`px-2 py-0.5 rounded text-xs ${levelStyle[d.level] || ""}`}
                            >
                              {d.level}
                            </span>
                          </td>
                          <td className="py-2 pl-4 text-gray-400 text-xs">
                            {d.message}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })}
        {records.length === 0 && (
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
