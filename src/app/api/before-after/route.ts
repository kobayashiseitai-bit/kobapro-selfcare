import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const revalidate = 0;
export const fetchCache = "force-no-store";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
  );
}

const NO_CACHE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, private",
  Pragma: "no-cache",
  Expires: "0",
};

interface DiagnosisItem {
  level: string;
  label: string;
  message?: string;
}

interface PostureRecord {
  id: string;
  image_url: string | null;
  diagnosis: DiagnosisItem[] | null;
  score: number | null;
  created_at: string;
}

function calcScoreFromDiagnosis(diagnosis: DiagnosisItem[] | null): number {
  if (!Array.isArray(diagnosis) || diagnosis.length === 0) return 0;
  const total = diagnosis.length;
  const good = diagnosis.filter((d) => d.level === "good").length;
  return Math.round((good / total) * 100);
}

function issueCount(diagnosis: DiagnosisItem[] | null): number {
  if (!Array.isArray(diagnosis)) return 0;
  return diagnosis.filter((d) => d.level !== "good").length;
}

/**
 * GET /api/before-after?deviceId=xxx
 * 初回写真と最新写真の比較データを返す
 */
export async function GET(req: NextRequest) {
  try {
    const deviceId = req.nextUrl.searchParams.get("deviceId");
    if (!deviceId) {
      return NextResponse.json({ error: "deviceId required" }, { status: 400 });
    }

    const supabase = getSupabase();
    const { data: users } = await supabase
      .from("users")
      .select("id, name, created_at")
      .eq("device_id", deviceId);

    if (!users || users.length === 0) {
      return NextResponse.json(
        { hasData: false, reason: "user_not_found" },
        { headers: NO_CACHE_HEADERS }
      );
    }

    const user = users[0];

    // 画像があるレコードだけ取得（初回と最新）
    const { data: records } = await supabase
      .from("posture_records")
      .select("id, image_url, diagnosis, score, created_at")
      .eq("user_id", user.id)
      .not("image_url", "is", null)
      .order("created_at", { ascending: true });

    const validRecords: PostureRecord[] = (records || []).filter(
      (r): r is PostureRecord =>
        typeof r.image_url === "string" && r.image_url.startsWith("http")
    );

    if (validRecords.length === 0) {
      return NextResponse.json(
        { hasData: false, reason: "no_records", userName: user.name },
        { headers: NO_CACHE_HEADERS }
      );
    }

    if (validRecords.length === 1) {
      const only = validRecords[0];
      return NextResponse.json(
        {
          hasData: false,
          reason: "only_one_record",
          userName: user.name,
          firstRecord: {
            id: only.id,
            imageUrl: only.image_url,
            createdAt: only.created_at,
            score: only.score ?? calcScoreFromDiagnosis(only.diagnosis),
            issueCount: issueCount(only.diagnosis),
          },
        },
        { headers: NO_CACHE_HEADERS }
      );
    }

    const first = validRecords[0];
    const latest = validRecords[validRecords.length - 1];

    // 差分計算（日数）
    const daysBetween = Math.floor(
      (new Date(latest.created_at).getTime() - new Date(first.created_at).getTime()) /
        (1000 * 60 * 60 * 24)
    );

    const firstScore = first.score ?? calcScoreFromDiagnosis(first.diagnosis);
    const latestScore = latest.score ?? calcScoreFromDiagnosis(latest.diagnosis);
    const scoreDelta = latestScore - firstScore;

    const firstIssues = issueCount(first.diagnosis);
    const latestIssues = issueCount(latest.diagnosis);
    const issueDelta = firstIssues - latestIssues; // 減った方がポジティブ

    // タイムラインポイント（初回/30日/90日/最新など均等に）
    const timelinePoints = validRecords
      .filter((_, i) => {
        // 全部少ない時は全件、多い時は均等にサンプリング（最大6件）
        if (validRecords.length <= 6) return true;
        const step = Math.floor(validRecords.length / 5);
        return i === 0 || i === validRecords.length - 1 || i % step === 0;
      })
      .slice(0, 8);

    return NextResponse.json(
      {
        hasData: true,
        userName: user.name,
        first: {
          id: first.id,
          imageUrl: first.image_url,
          createdAt: first.created_at,
          score: firstScore,
          issueCount: firstIssues,
          diagnosis: first.diagnosis,
        },
        latest: {
          id: latest.id,
          imageUrl: latest.image_url,
          createdAt: latest.created_at,
          score: latestScore,
          issueCount: latestIssues,
          diagnosis: latest.diagnosis,
        },
        summary: {
          daysBetween,
          totalRecords: validRecords.length,
          scoreDelta,
          issueDelta,
        },
        timeline: timelinePoints.map((r) => ({
          id: r.id,
          imageUrl: r.image_url,
          createdAt: r.created_at,
          score: r.score ?? calcScoreFromDiagnosis(r.diagnosis),
          issueCount: issueCount(r.diagnosis),
        })),
      },
      { headers: NO_CACHE_HEADERS }
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { error: "failed to load before-after", detail: msg },
      { status: 500 }
    );
  }
}
