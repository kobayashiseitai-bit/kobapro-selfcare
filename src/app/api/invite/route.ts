import { NextRequest, NextResponse } from "next/server";

import { createServerSupabase } from "../../lib/supabase-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// 読み取りがキャッシュされて古い値が返るのを防ぐため、
// no-store を指定した共通クライアントを使う（supabase-server.ts に経緯あり）
const getSupabase = createServerSupabase;

// 招待コードを生成（英数字8桁・読みやすい文字のみ）
function generateInviteCode(seed?: string): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // 0,O,1,I を除外
  let code = "";
  if (seed) {
    // ユーザー名の英字部分をプレフィックスに使う
    const prefix = seed
      .toUpperCase()
      .replace(/[^A-Z]/g, "")
      .slice(0, 4);
    if (prefix.length >= 2) code = prefix;
  }
  while (code.length < 8) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code.slice(0, 8);
}

/**
 * GET /api/invite?deviceId=xxx
 * 自分の招待コード情報を取得（なければ作成）
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
      .select("id, name")
      .eq("device_id", deviceId);

    if (!users || users.length === 0) {
      return NextResponse.json({ error: "user not found" }, { status: 404 });
    }
    const user = users[0];

    // 既存の招待コードをチェック
    const { data: firstCheck, error: selectError } = await supabase
      .from("invite_codes")
      .select("code, use_count, created_at")
      .eq("user_id", user.id)
      .maybeSingle();

    if (selectError && selectError.code === "42P01") {
      // PostgreSQL: relation does not exist
      return NextResponse.json(
        {
          error: "SQLテーブル未作成",
          detail: "invite_codes テーブルが存在しません。Supabase SQL Editor でマイグレーションを実行してください。",
        },
        { status: 500 }
      );
    }

    let existing = firstCheck;
    let lastInsertError: string | null = null;

    // なければ新規作成（最大5回試行してユニーク保証）
    if (!existing) {
      for (let attempt = 0; attempt < 5; attempt++) {
        const newCode = generateInviteCode(user.name);
        const { data: inserted, error } = await supabase
          .from("invite_codes")
          .insert({
            user_id: user.id,
            code: newCode,
          })
          .select("code, use_count, created_at")
          .single();
        if (!error && inserted) {
          existing = inserted;
          break;
        }
        if (error) {
          lastInsertError = `${error.code}: ${error.message}`;
          // テーブル未作成系のエラーならすぐ抜ける
          if (error.code === "42P01" || error.code === "42703") break;
        }
      }
    }

    if (!existing) {
      return NextResponse.json(
        {
          error: "招待コードの発行に失敗しました",
          detail:
            lastInsertError ||
            "invite_codes テーブルのセットアップを確認してください",
        },
        { status: 500 }
      );
    }

    // 招待履歴を取得
    const { data: redemptions } = await supabase
      .from("invite_redemptions")
      .select("invitee_user_id, redeemed_at")
      .eq("inviter_user_id", user.id)
      .order("redeemed_at", { ascending: false });

    // 2026-10-01: bonusFreeMonths（獲得無料月数）と shareUrl（Web版のURL）は返さない。
    // 無料月は実際には付与されておらず、画面にも出さなくなった。紹介文のURLは画面側でストアのページを使う
    return NextResponse.json({
      code: existing.code,
      useCount: existing.use_count || 0,
      totalInvited: (redemptions || []).length,
      createdAt: existing.created_at,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { error: "failed", detail: msg },
      { status: 500 }
    );
  }
}

/**
 * POST /api/invite
 * Body: { deviceId, code }
 * 招待コードを使用（新規ユーザー登録時）
 */
export async function POST(req: NextRequest) {
  try {
    const { deviceId, code } = await req.json();
    if (!deviceId || !code) {
      return NextResponse.json(
        { error: "deviceId and code required" },
        { status: 400 }
      );
    }

    const normalizedCode = String(code).toUpperCase().trim();
    const supabase = getSupabase();

    // 招待コードの有効性チェック
    const { data: inviteCode } = await supabase
      .from("invite_codes")
      .select("user_id, code")
      .eq("code", normalizedCode)
      .maybeSingle();

    if (!inviteCode) {
      // 家族プランのコード（家族コード）も同じ8文字なので、登録画面の招待コード欄に入れられることがある。
      // その場合は、入れる場所を案内する（家族への参加は登録のあとに家族プランの画面で行う）
      const { data: familyHit } = await supabase
        .from("families")
        .select("id")
        .eq("invite_code", normalizedCode)
        .limit(1);
      if (familyHit && familyHit.length > 0) {
        return NextResponse.json(
          {
            error:
              "これは家族プランの「家族コード」です。登録のあとに、メニュー →「家族プラン」→「家族コードで参加する」から入力してください。",
          },
          { status: 400 }
        );
      }
      return NextResponse.json(
        { error: "この招待コードは無効です" },
        { status: 400 }
      );
    }

    // 招待された人（自分）のユーザー取得
    const { data: users } = await supabase
      .from("users")
      .select("id")
      .eq("device_id", deviceId);
    if (!users || users.length === 0) {
      return NextResponse.json({ error: "user not found" }, { status: 404 });
    }
    const inviteeUserId = users[0].id;

    // 自分自身を招待するのは禁止
    if (inviteCode.user_id === inviteeUserId) {
      return NextResponse.json(
        { error: "自分自身の招待コードは使用できません" },
        { status: 400 }
      );
    }

    // 既に招待されているか確認（1ユーザー1回のみ）
    const { data: existingRedemption } = await supabase
      .from("invite_redemptions")
      .select("id")
      .eq("invitee_user_id", inviteeUserId)
      .maybeSingle();

    if (existingRedemption) {
      return NextResponse.json(
        { error: "招待コードは既に使用済みです" },
        { status: 400 }
      );
    }

    // 招待履歴を記録（紹介した人数の表示に使う）
    // 2026-10-01: 特典は付与しないので reward_granted は false（列の既定値と同じ）
    await supabase.from("invite_redemptions").insert({
      inviter_user_id: inviteCode.user_id,
      invitee_user_id: inviteeUserId,
      invite_code: normalizedCode,
      reward_granted: false,
    });

    // 2026-10-01: 招待した人の「+1ヶ月無料」（users.bonus_free_months を+1）の書き込みをやめた。
    // この数字は課金の判定（lib/subscription.ts・RevenueCat）のどこからも読まれておらず、無料月は実際には付与されていなかった。
    // 特典を再開するときは、App Store のオファーコード / Google Play のプロモーションコードなど、ストアで実際に渡せる形で作り直すこと。
    // 列は既存の記録を残すため消していない

    // invite_codes の use_count を +1
    const { data: currentCode } = await supabase
      .from("invite_codes")
      .select("use_count")
      .eq("user_id", inviteCode.user_id)
      .maybeSingle();
    await supabase
      .from("invite_codes")
      .update({
        use_count: (currentCode?.use_count || 0) + 1,
      })
      .eq("user_id", inviteCode.user_id);

    // 2026-10-01: 招待された人の「無料体験を7日→14日に延長」（users.extended_trial_days=14）の書き込みをやめた。
    // 無料体験はストアのお試しオファー（7日固定）で、アプリからは延ばせない。この数字もどこからも読まれていなかった。
    // 列は既存の記録を残すため消していない

    return NextResponse.json({
      ok: true,
      message: "招待コードを登録しました。",
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { error: "招待コード適用失敗", detail: msg },
      { status: 500 }
    );
  }
}
