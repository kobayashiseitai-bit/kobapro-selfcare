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

// JSTの日付文字列 (YYYY-MM-DD) を取得
function toJSTDateKey(isoString: string): string {
  const d = new Date(isoString);
  // UTC+9時間で JST 時刻に変換
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

// JSTで N日前の日付キー
function jstDateKeyDaysAgo(days: number): string {
  const d = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  return toJSTDateKey(d.toISOString());
}

export interface StreakBadge {
  days: number;
  emoji: string;
  title: string;
  unlocked: boolean;
}

const BADGES: Omit<StreakBadge, "unlocked">[] = [
  { days: 3, emoji: "🌱", title: "はじめの一歩" },
  { days: 7, emoji: "🔥", title: "1週間マスター" },
  { days: 14, emoji: "⭐", title: "2週間継続" },
  { days: 30, emoji: "💎", title: "1ヶ月の達人" },
  { days: 50, emoji: "🏆", title: "継続の勇者" },
  { days: 100, emoji: "👑", title: "3桁達成者" },
  { days: 200, emoji: "🌟", title: "継続の鉄人" },
  { days: 365, emoji: "🎊", title: "1年の伝説" },
];

export async function GET(req: NextRequest) {
  try {
    const deviceId = req.nextUrl.searchParams.get("deviceId");
    if (!deviceId) {
      return NextResponse.json({
        currentStreak: 0,
        longestStreak: 0,
        totalActiveDays: 0,
        activeToday: false,
        lastActiveDate: null,
        nextBadge: BADGES[0],
        unlockedBadges: [],
        dateMap: {},
      });
    }

    const supabase = getSupabase();
    const { data: users } = await supabase
      .from("users")
      .select("id, created_at")
      .eq("device_id", deviceId);

    if (!users || users.length === 0) {
      return NextResponse.json({
        currentStreak: 0,
        longestStreak: 0,
        totalActiveDays: 0,
        activeToday: false,
        lastActiveDate: null,
        nextBadge: BADGES[0],
        unlockedBadges: [],
        dateMap: {},
      });
    }
    const userId = users[0].id;
    const userCreatedAt = users[0].created_at;

    // 直近1年分のアクション履歴を取得
    const oneYearAgo = new Date(
      Date.now() - 365 * 24 * 60 * 60 * 1000
    ).toISOString();

    const [postureRes, mealRes, chatRes] = await Promise.all([
      supabase
        .from("posture_records")
        .select("created_at")
        .eq("user_id", userId)
        .gte("created_at", oneYearAgo),
      supabase
        .from("meal_records")
        .select("created_at")
        .eq("user_id", userId)
        .gte("created_at", oneYearAgo),
      supabase
        .from("chat_logs")
        .select("created_at, role")
        .eq("user_id", userId)
        .eq("role", "user")
        .gte("created_at", oneYearAgo),
    ]);

    // 全アクションのJST日付をSet化
    const activeDates = new Set<string>();
    (postureRes.data || []).forEach((r) => {
      activeDates.add(toJSTDateKey(r.created_at));
    });
    (mealRes.data || []).forEach((r) => {
      activeDates.add(toJSTDateKey(r.created_at));
    });
    (chatRes.data || []).forEach((r) => {
      activeDates.add(toJSTDateKey(r.created_at));
    });
    // 登録日もアクティブ扱い（初日）
    if (userCreatedAt) {
      activeDates.add(toJSTDateKey(userCreatedAt));
    }

    const today = todayJSTKey();
    const yesterday = jstDateKeyDaysAgo(1);
    const activeToday = activeDates.has(today);
    const activeYesterday = activeDates.has(yesterday);

    // 現在のストリーク計算
    // 今日アクティブ → 今日から遡る
    // 今日非アクティブでも昨日アクティブ → 昨日から遡る（猶予）
    let currentStreak = 0;
    let lastActiveDate: string | null = null;
    if (activeToday || activeYesterday) {
      const startOffset = activeToday ? 0 : 1;
      for (let i = startOffset; i < 400; i++) {
        const key = jstDateKeyDaysAgo(i);
        if (activeDates.has(key)) {
          if (!lastActiveDate) lastActiveDate = key;
          currentStreak++;
        } else {
          break;
        }
      }
    }

    // 最長ストリーク計算
    const sortedDates = Array.from(activeDates).sort();
    let longestStreak = 0;
    let tempStreak = 0;
    for (let i = 0; i < sortedDates.length; i++) {
      if (i === 0) {
        tempStreak = 1;
      } else {
        const prev = new Date(sortedDates[i - 1]);
        const curr = new Date(sortedDates[i]);
        const diffDays = Math.round(
          (curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24)
        );
        tempStreak = diffDays === 1 ? tempStreak + 1 : 1;
      }
      if (tempStreak > longestStreak) longestStreak = tempStreak;
    }

    // バッジ計算
    const maxStreak = Math.max(currentStreak, longestStreak);
    const badges: StreakBadge[] = BADGES.map((b) => ({
      ...b,
      unlocked: maxStreak >= b.days,
    }));
    const unlockedBadges = badges.filter((b) => b.unlocked);
    const nextBadge =
      badges.find((b) => !b.unlocked) || badges[badges.length - 1];

    // 直近30日分のアクティブ状況マップ（UIでミニカレンダー表示用）
    const dateMap: Record<string, boolean> = {};
    for (let i = 0; i < 30; i++) {
      const key = jstDateKeyDaysAgo(i);
      dateMap[key] = activeDates.has(key);
    }

    return NextResponse.json({
      currentStreak,
      longestStreak,
      totalActiveDays: activeDates.size,
      activeToday,
      lastActiveDate,
      nextBadge,
      unlockedBadges,
      badges,
      dateMap,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { error: "failed", detail: msg, currentStreak: 0, longestStreak: 0 },
      { status: 500 }
    );
  }
}
