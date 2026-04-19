import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/debug/meal?deviceId=xxx
 * 食事記録のデバッグ用エンドポイント。ダッシュボードに反映されない問題の原因を特定するため。
 * 本番環境でも動作する。問題解決後に削除予定。
 */
export async function GET(req: NextRequest) {
  try {
    const deviceId = req.nextUrl.searchParams.get("deviceId");
    if (!deviceId) {
      return NextResponse.json({ error: "deviceId required" }, { status: 400 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || "",
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
    );

    // 1. ユーザー取得
    const { data: users } = await supabase
      .from("users")
      .select("id, device_id, created_at, name")
      .eq("device_id", deviceId);

    if (!users || users.length === 0) {
      return NextResponse.json({
        error: "ユーザーが見つかりません",
        deviceId,
        hint: "この端末IDでは登録されていません。別のiPhoneや別アカウントで使っていませんか？",
      });
    }

    const user = users[0];

    // 2. 直近10件の食事記録
    const { data: meals, error: mealErr } = await supabase
      .from("meal_records")
      .select(
        "id, meal_type, menu_name, calories, protein_g, carbs_g, fat_g, created_at, image_url"
      )
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(10);

    if (mealErr) {
      return NextResponse.json({
        error: "meal_records クエリ失敗",
        detail: mealErr.message,
      });
    }

    // 3. 「今日」の範囲計算（JST基準）
    const now = new Date();
    const jstOffsetMs = 9 * 60 * 60 * 1000;
    const nowJst = new Date(now.getTime() + jstOffsetMs);
    const todayJstDateStr = nowJst.toISOString().slice(0, 10); // YYYY-MM-DD JST
    const todayStart = new Date(`${todayJstDateStr}T00:00:00+09:00`);
    const todayEnd = new Date(todayStart);
    todayEnd.setUTCDate(todayEnd.getUTCDate() + 1);

    // 4. 今日の食事記録だけを抽出
    const todayMeals = (meals || []).filter((m) => {
      const ca = new Date(m.created_at);
      return ca >= todayStart && ca < todayEnd;
    });

    // 5. 食事区分別に集計
    const validTypes = ["朝食", "昼食", "夕食", "間食"];
    const byType: Record<string, { count: number; calories: number; items: string[] }> = {
      朝食: { count: 0, calories: 0, items: [] },
      昼食: { count: 0, calories: 0, items: [] },
      夕食: { count: 0, calories: 0, items: [] },
      間食: { count: 0, calories: 0, items: [] },
      "(meal_type なし)": { count: 0, calories: 0, items: [] },
    };

    todayMeals.forEach((m) => {
      const key = m.meal_type && validTypes.includes(m.meal_type) ? m.meal_type : "(meal_type なし)";
      byType[key].count += 1;
      byType[key].calories += m.calories || 0;
      byType[key].items.push(`${m.menu_name || "?"} (${m.calories || 0}kcal)`);
    });

    // 6. 全期間での meal_type 分布
    const { data: allMeals } = await supabase
      .from("meal_records")
      .select("meal_type")
      .eq("user_id", user.id);

    const mealTypeDistribution: Record<string, number> = {};
    (allMeals || []).forEach((m) => {
      const k = m.meal_type || "(null)";
      mealTypeDistribution[k] = (mealTypeDistribution[k] || 0) + 1;
    });

    return NextResponse.json({
      ok: true,
      debug: {
        user: {
          id: user.id,
          device_id: user.device_id,
          name: user.name,
          created_at: user.created_at,
        },
        server_time: {
          now_utc: now.toISOString(),
          now_jst_string: nowJst.toISOString().slice(0, 19) + " (JST)",
          today_jst_date: todayJstDateStr,
          today_range_utc: {
            start: todayStart.toISOString(),
            end: todayEnd.toISOString(),
          },
        },
        recent_10_meals: (meals || []).map((m) => ({
          created_at_utc: m.created_at,
          created_at_jst: new Date(new Date(m.created_at).getTime() + jstOffsetMs)
            .toISOString()
            .slice(0, 19),
          meal_type: m.meal_type || "(null)",
          menu_name: m.menu_name,
          calories: m.calories,
          has_image: !!m.image_url,
        })),
        today_summary: {
          total_meals_today: todayMeals.length,
          by_meal_type: byType,
        },
        all_time_meal_type_distribution: mealTypeDistribution,
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { error: "debug endpoint failed", detail: msg },
      { status: 500 }
    );
  }
}
