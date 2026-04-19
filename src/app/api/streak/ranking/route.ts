import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
  );
}

// JSTの日付キーを取得
function toJSTDateKey(isoString: string): string {
  const d = new Date(isoString);
  const jst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
  const y = jst.getUTCFullYear();
  const m = String(jst.getUTCMonth() + 1).padStart(2, "0");
  const day = String(jst.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// 今日のJST日付キー
function todayJSTKey(): string {
  return toJSTDateKey(new Date().toISOString());
}

// N日前のJST日付キー
function jstDateKeyDaysAgo(days: number): string {
  const d = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  return toJSTDateKey(d.toISOString());
}

/**
 * 全ユーザーの現在ストリークを計算して、自分の順位（パーセンタイル）を返す
 * プライバシー保護: ニックネーム等は一切公開しない
 *
 * GET /api/streak/ranking?deviceId=xxx
 * Response: {
 *   myStreak: number,
 *   totalUsers: number,
 *   percentile: number,  // 上位何%か（小さいほど優秀）
 *   rank: number,        // 順位（1位が最高）
 *   activeUsersToday: number,  // 今日記録したユーザー数
 *   averageStreak: number,     // 全ユーザーの平均ストリーク
 *   medianStreak: number,      // 中央値
 *   topStreakDistribution: Array<{ range: string; count: number }>,  // 分布グラフ用
 * }
 */
export async function GET(req: NextRequest) {
  try {
    const deviceId = req.nextUrl.searchParams.get("deviceId");
    if (!deviceId) {
      return NextResponse.json({ error: "deviceId required" }, { status: 400 });
    }

    const supabase = getSupabase();

    // 自分のユーザーIDを取得
    const { data: users } = await supabase
      .from("users")
      .select("id")
      .eq("device_id", deviceId);
    const myUserId = users?.[0]?.id || null;

    // 全ユーザー取得（device_id はあるが name も name_null も問わない）
    const { data: allUsers } = await supabase
      .from("users")
      .select("id, created_at");

    if (!allUsers || allUsers.length === 0) {
      return NextResponse.json({
        myStreak: 0,
        totalUsers: 0,
        percentile: 100,
        rank: 0,
        activeUsersToday: 0,
        averageStreak: 0,
        medianStreak: 0,
        topStreakDistribution: [],
      });
    }

    // 全ユーザーのアクション履歴を取得（過去1年分・一括）
    const oneYearAgo = new Date(
      Date.now() - 365 * 24 * 60 * 60 * 1000
    ).toISOString();

    const [postureAll, mealAll, chatAll] = await Promise.all([
      supabase
        .from("posture_records")
        .select("user_id, created_at")
        .gte("created_at", oneYearAgo),
      supabase
        .from("meal_records")
        .select("user_id, created_at")
        .gte("created_at", oneYearAgo),
      supabase
        .from("chat_logs")
        .select("user_id, created_at, role")
        .eq("role", "user")
        .gte("created_at", oneYearAgo),
    ]);

    // ユーザー別アクティブ日付マップを構築
    const userActiveDates: Map<string, Set<string>> = new Map();
    allUsers.forEach((u) => {
      const dates = new Set<string>();
      // 登録日もアクティブ扱い
      if (u.created_at) dates.add(toJSTDateKey(u.created_at));
      userActiveDates.set(u.id, dates);
    });

    (postureAll.data || []).forEach((r) => {
      const set = userActiveDates.get(r.user_id);
      if (set) set.add(toJSTDateKey(r.created_at));
    });
    (mealAll.data || []).forEach((r) => {
      const set = userActiveDates.get(r.user_id);
      if (set) set.add(toJSTDateKey(r.created_at));
    });
    (chatAll.data || []).forEach((r) => {
      const set = userActiveDates.get(r.user_id);
      if (set) set.add(toJSTDateKey(r.created_at));
    });

    // 各ユーザーの現在ストリークを計算
    const today = todayJSTKey();
    const yesterday = jstDateKeyDaysAgo(1);
    const allStreaks: number[] = [];
    let myStreak = 0;
    let activeUsersToday = 0;

    userActiveDates.forEach((dates, userId) => {
      const activeToday = dates.has(today);
      const activeYesterday = dates.has(yesterday);
      if (activeToday) activeUsersToday++;

      let streak = 0;
      if (activeToday || activeYesterday) {
        const startOffset = activeToday ? 0 : 1;
        for (let i = startOffset; i < 400; i++) {
          if (dates.has(jstDateKeyDaysAgo(i))) {
            streak++;
          } else {
            break;
          }
        }
      }
      allStreaks.push(streak);
      if (userId === myUserId) myStreak = streak;
    });

    // 順位計算
    const sortedDesc = [...allStreaks].sort((a, b) => b - a);
    const myRank = sortedDesc.findIndex((s) => s <= myStreak) + 1 || 1;
    const totalUsers = allStreaks.length;
    // パーセンタイル（上位X%）
    const higherCount = sortedDesc.filter((s) => s > myStreak).length;
    const percentile = Math.round((higherCount / totalUsers) * 100);

    // 平均・中央値
    const averageStreak = Math.round(
      allStreaks.reduce((a, b) => a + b, 0) / Math.max(1, totalUsers)
    );
    const sortedAsc = [...allStreaks].sort((a, b) => a - b);
    const medianStreak =
      totalUsers > 0 ? sortedAsc[Math.floor(totalUsers / 2)] : 0;

    // 分布グラフ（ストリークのレンジ別ユーザー数）
    const ranges = [
      { label: "0日", min: 0, max: 0 },
      { label: "1〜2日", min: 1, max: 2 },
      { label: "3〜6日", min: 3, max: 6 },
      { label: "7〜13日", min: 7, max: 13 },
      { label: "14〜29日", min: 14, max: 29 },
      { label: "30〜99日", min: 30, max: 99 },
      { label: "100日以上", min: 100, max: 99999 },
    ];
    const distribution = ranges.map((r) => ({
      range: r.label,
      count: allStreaks.filter((s) => s >= r.min && s <= r.max).length,
      isMe: myStreak >= r.min && myStreak <= r.max,
    }));

    return NextResponse.json({
      myStreak,
      totalUsers,
      rank: myRank,
      percentile,
      activeUsersToday,
      averageStreak,
      medianStreak,
      topStreakDistribution: distribution,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("Ranking API error:", e);
    return NextResponse.json(
      { error: "failed", detail: msg },
      { status: 500 }
    );
  }
}
