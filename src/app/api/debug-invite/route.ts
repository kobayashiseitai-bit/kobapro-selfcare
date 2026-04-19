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

/**
 * GET /api/debug-invite
 * 招待機能の診断エンドポイント（テーブルの存在確認）
 * ※ 後で削除予定
 */
export async function GET(_req: NextRequest) {
  const results: Record<string, { exists: boolean; error?: string; sample?: unknown }> = {};
  const supabase = getSupabase();

  // 1. invite_codes テーブル存在確認
  try {
    const { error } = await supabase
      .from("invite_codes")
      .select("id")
      .limit(1);
    results.invite_codes = {
      exists: !error,
      error: error ? `${error.code}: ${error.message}` : undefined,
    };
  } catch (e) {
    results.invite_codes = {
      exists: false,
      error: e instanceof Error ? e.message : String(e),
    };
  }

  // 2. invite_redemptions テーブル存在確認
  try {
    const { error } = await supabase
      .from("invite_redemptions")
      .select("id")
      .limit(1);
    results.invite_redemptions = {
      exists: !error,
      error: error ? `${error.code}: ${error.message}` : undefined,
    };
  } catch (e) {
    results.invite_redemptions = {
      exists: false,
      error: e instanceof Error ? e.message : String(e),
    };
  }

  // 3. users.bonus_free_months カラム存在確認
  try {
    const { error } = await supabase
      .from("users")
      .select("bonus_free_months")
      .limit(1);
    results.users_bonus_free_months = {
      exists: !error,
      error: error ? `${error.code}: ${error.message}` : undefined,
    };
  } catch (e) {
    results.users_bonus_free_months = {
      exists: false,
      error: e instanceof Error ? e.message : String(e),
    };
  }

  // 4. users.extended_trial_days カラム存在確認
  try {
    const { error } = await supabase
      .from("users")
      .select("extended_trial_days")
      .limit(1);
    results.users_extended_trial_days = {
      exists: !error,
      error: error ? `${error.code}: ${error.message}` : undefined,
    };
  } catch (e) {
    results.users_extended_trial_days = {
      exists: false,
      error: e instanceof Error ? e.message : String(e),
    };
  }

  // 5. 実際にinvite_codesにinsertテスト（ダミー）
  try {
    const { error } = await supabase
      .from("invite_codes")
      .insert({
        user_id: "00000000-0000-0000-0000-000000000000", // 存在しないUUID
        code: "DEBUGXXXX",
      });
    // FK違反で失敗するのが正常（テーブル存在の証明）
    results.insert_test = {
      exists: error?.code === "23503", // foreign_key_violation = テーブル存在OK
      error: error ? `${error.code}: ${error.message}` : "insert succeeded (unexpected)",
    };
  } catch (e) {
    results.insert_test = {
      exists: false,
      error: e instanceof Error ? e.message : String(e),
    };
  }

  return NextResponse.json({
    status: "debug",
    results,
    recommendation: Object.values(results).some((r) => !r.exists)
      ? "一部のテーブル/カラムが見つかりません。Supabase SQL を再実行してください"
      : "すべて正常です",
  });
}
