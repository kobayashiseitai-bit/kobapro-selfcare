"use client";
import { useEffect, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  Legend,
} from "recharts";

const SYMPTOM_LABELS: Record<string, string> = {
  neck: "首こり",
  shoulder_stiff: "肩こり",
  shoulder_pain: "肩の痛み",
  back: "腰痛",
  eye_fatigue: "眼精疲労",
  eye_recovery: "目の回復",
};

const COLORS = ["#60a5fa", "#a78bfa", "#34d399", "#fbbf24", "#f87171", "#fb923c"];

interface SymptomData {
  totals: Record<string, number>;
  daily: Record<string, string | number>[];
  symptoms: string[];
}

export default function SymptomsPage() {
  const [data, setData] = useState<SymptomData | null>(null);

  useEffect(() => {
    fetch("/api/admin/symptoms")
      .then((r) => r.json())
      .then(setData);
  }, []);

  if (!data) {
    return <p className="text-gray-400">読み込み中...</p>;
  }

  const barData = Object.entries(data.totals)
    .map(([id, count]) => ({
      name: SYMPTOM_LABELS[id] || id,
      count,
    }))
    .sort((a, b) => b.count - a.count);

  return (
    <div className="space-y-8">
      <h2 className="text-2xl font-bold">症状統計</h2>

      {/* Bar Chart - Totals */}
      <div className="bg-gray-900 rounded-2xl border border-gray-800 p-6">
        <h3 className="text-lg font-semibold mb-4">症状別 選択数</h3>
        {barData.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={barData} layout="vertical" margin={{ left: 80 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
              <XAxis type="number" tick={{ fill: "#9ca3af" }} />
              <YAxis
                type="category"
                dataKey="name"
                tick={{ fill: "#9ca3af" }}
                width={70}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#111827",
                  border: "1px solid #374151",
                  borderRadius: "8px",
                }}
              />
              <Bar dataKey="count" fill="#60a5fa" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-gray-500 text-center py-8">データがありません</p>
        )}
      </div>

      {/* Line Chart - Daily Trends */}
      <div className="bg-gray-900 rounded-2xl border border-gray-800 p-6">
        <h3 className="text-lg font-semibold mb-4">日別推移</h3>
        {data.daily.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={data.daily}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
              <XAxis
                dataKey="date"
                tick={{ fill: "#9ca3af", fontSize: 12 }}
                tickFormatter={(v: string) => v.slice(5)}
              />
              <YAxis tick={{ fill: "#9ca3af" }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#111827",
                  border: "1px solid #374151",
                  borderRadius: "8px",
                }}
                labelFormatter={(v) => String(v)}
              />
              <Legend
                formatter={(value) => SYMPTOM_LABELS[String(value)] || String(value)}
              />
              {data.symptoms.map((s, i) => (
                <Line
                  key={s}
                  type="monotone"
                  dataKey={s}
                  stroke={COLORS[i % COLORS.length]}
                  strokeWidth={2}
                  dot={false}
                  name={s}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-gray-500 text-center py-8">データがありません</p>
        )}
      </div>
    </div>
  );
}
