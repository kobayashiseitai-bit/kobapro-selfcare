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
      .select("id, name, bonus_free_months")
      .eq("device_id", deviceId);

    if (!users || users.length === 0) {
      return NextResponse.json({ error: "user not found" }, { status: 404 });
    }
    const user = users[0];

    // 既存の招待コードをチェック
    let { data: existing } = await supabase
      .from("invite_codes")
      .select("code, use_count, created_at")
      .eq("user_id", user.id)
      .maybeSingle();

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
      }
    }

    if (!existing) {
      return NextResponse.json(
        { error: "コード発行に失敗" },
        { status: 500 }
      );
    }

    // 招待履歴を取得
    const { data: redemptions } = await supabase
      .from("invite_redemptions")
      .select("invitee_user_id, redeemed_at")
      .eq("inviter_user_id", user.id)
      .order("redeemed_at", { ascending: false });

    return NextResponse.json({
      code: existing.code,
      useCount: existing.use_count || 0,
      totalInvited: (redemptions || []).length,
      bonusFreeMonths: user.bonus_free_months || 0,
      createdAt: existing.created_at,
      shareUrl: `https://posture-app-steel.vercel.app?invite=${existing.code}`,
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

    // 招待履歴を記録
    await supabase.from("invite_redemptions").insert({
      inviter_user_id: inviteCode.user_id,
      invitee_user_id: inviteeUserId,
      invite_code: normalizedCode,
      reward_granted: true,
    });

    // 招待した人の特典: +1ヶ月無料（手動で更新）
    try {
      const { data: inviter } = await supabase
        .from("users")
        .select("bonus_free_months")
        .eq("id", inviteCode.user_id)
        .maybeSingle();
      await supabase
        .from("users")
        .update({
          bonus_free_months: (inviter?.bonus_free_months || 0) + 1,
        })
        .eq("id", inviteCode.user_id);
    } catch (err) {
      console.warn("[invite] bonus update failed:", err);
    }

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

    // 招待された人の特典: トライアル延長 (7日→14日)
    await supabase
      .from("users")
      .update({ extended_trial_days: 14 })
      .eq("id", inviteeUserId);

    return NextResponse.json({
      ok: true,
      message: "招待コードを適用しました！トライアルが14日間に延長されます 🎁",
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { error: "招待コード適用失敗", detail: msg },
      { status: 500 }
    );
  }
}
