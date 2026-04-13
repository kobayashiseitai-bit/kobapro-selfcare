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
  user_name: string;
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
  const [debugMsg, setDebugMsg] = useState("loading...");
  const limit = 20;

  useEffect(() => {
    const load = () =>
      fetch(`/api/admin/posture?page=${page}&limit=${limit}`, { credentials: "include" })
        .then((r) => { setDebugMsg(`status=${r.status}`); return r.json(); })
        .then((d) => {
          setDebugMsg((p) => `${p} records=${(d.records||[]).length} total=${d.total} err=${d.error||"none"}`);
          setRecords(d.records || []);
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
        姿勢記録 <span className="text-gray-500 text-base font-normal">({total}件)</span>
      </h2>
      <p className="text-xs text-yellow-400 mb-4 font-mono bg-gray-900 p-2 rounded">{debugMsg}</p>

      <div className="space-y-3">
        {records.map((r) => {
          const diag = Array.isArray(r.diagnosis) ? r.diagnosis : [];
          const isExpanded = expanded === r.id;
          return (
            <div key={r.id} className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden">
              <button
                onClick={() => setExpanded(isExpanded ? null : r.id)}
                className="w-full px-4 py-3 flex items-center gap-4 text-left hover:bg-gray-800/30"
              >
                {r.image_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={r.image_url} alt="" className="w-10 h-12 object-cover rounded" />
                )}
                <div className="flex-1">
                  <p className="text-sm text-white">{new Date(r.created_at).toLocaleString("ja-JP")}</p>
                  <p className="text-xs text-blue-300 font-semibold">{r.user_name || r.user_id?.slice(0, 8)}</p>
                </div>
                <div className="flex gap-1 flex-wrap">
                  {diag.map((d, i) => (
                    <span key={i} className={`px-2 py-0.5 rounded text-xs ${levelStyle[d.level] || "text-gray-400"}`}>
                      {d.label}
                    </span>
                  ))}
                </div>
              </button>
              {isExpanded && (
                <div className="px-4 pb-4 border-t border-gray-800 pt-3">
                  {r.image_url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={r.image_url} alt="" className="w-48 rounded-lg mb-3" />
                  )}
                  <div className="space-y-2">
                    {diag.map((d, i) => (
                      <div key={i} className="flex items-center gap-3">
                        <span className={`px-2 py-0.5 rounded text-xs w-20 text-center ${levelStyle[d.level] || ""}`}>{d.level}</span>
                        <span className="text-white text-sm font-semibold w-28">{d.label}</span>
                        <span className="text-gray-400 text-sm">{d.message}</span>
                      </div>
                    ))}
                  </div>
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
