import { NextRequest, NextResponse } from "next/server";
import { validateAdmin, getSupabase } from "../_helpers";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export async function GET(req: NextRequest) {

  const supabase = getSupabase();

  const { data } = await supabase
    .from("symptom_selections")
    .select("symptom_id, created_at")
    .order("created_at", { ascending: true });

  const rows = data || [];

  // Total counts per symptom
  const totals: Record<string, number> = {};
  rows.forEach((r) => {
    totals[r.symptom_id] = (totals[r.symptom_id] || 0) + 1;
  });

  // Daily breakdown
  const dailyMap: Record<string, Record<string, number>> = {};
  rows.forEach((r) => {
    const day = r.created_at.slice(0, 10);
    if (!dailyMap[day]) dailyMap[day] = {};
    dailyMap[day][r.symptom_id] = (dailyMap[day][r.symptom_id] || 0) + 1;
  });

  const allSymptoms = Array.from(new Set(rows.map((r) => r.symptom_id)));
  const daily = Object.entries(dailyMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, counts]) => {
      const entry: Record<string, string | number> = { date };
      allSymptoms.forEach((s) => {
        entry[s] = counts[s] || 0;
      });
      return entry;
    });

  return NextResponse.json({ totals, daily, symptoms: allSymptoms });
}
