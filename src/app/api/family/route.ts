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

// 招待コード生成（8桁、混同しやすい文字を除外）
function generateInviteCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // I, O, 0, 1 を除外
  let code = "";
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

async function getUserId(
  supabase: ReturnType<typeof getSupabase>,
  deviceId: string
): Promise<string | null> {
  const { data } = await supabase
    .from("users")
    .select("id")
    .eq("device_id", deviceId)
    .maybeSingle();
  return data?.id || null;
}

/**
 * GET /api/family?deviceId=xxx
 * 自分の家族情報を返す（オーナー or メンバー）
 */
export async function GET(req: NextRequest) {
  try {
    const deviceId = req.nextUrl.searchParams.get("deviceId");
    if (!deviceId) {
      return NextResponse.json({ error: "deviceId required" }, { status: 400 });
    }

    const supabase = getSupabase();
    const userId = await getUserId(supabase, deviceId);
    if (!userId) {
      return NextResponse.json(
        { hasFamily: false, reason: "user_not_found" },
        { headers: NO_CACHE_HEADERS }
      );
    }

    // 自分が所属する家族を探す
    const { data: membership } = await supabase
      .from("family_members")
      .select("family_id, role, share_data, joined_at")
      .eq("user_id", userId)
      .maybeSingle();

    if (!membership) {
      return NextResponse.json(
        { hasFamily: false },
        { headers: NO_CACHE_HEADERS }
      );
    }

    // 家族情報取得
    const { data: family } = await supabase
      .from("families")
      .select("id, owner_user_id, name, invite_code, max_members, created_at")
      .eq("id", membership.family_id)
      .single();

    if (!family) {
      return NextResponse.json(
        { hasFamily: false, reason: "family_not_found" },
        { headers: NO_CACHE_HEADERS }
      );
    }

    // メンバー一覧取得
    const { data: members } = await supabase
      .from("family_members")
      .select(
        "id, user_id, role, share_data, joined_at, users:user_id(name, age)"
      )
      .eq("family_id", family.id)
      .order("joined_at", { ascending: true });

    // オーナーのサブスク状態を取得
    const { data: ownerSub } = await supabase
      .from("subscriptions")
      .select("status, plan, current_period_end, trial_ends_at")
      .eq("user_id", family.owner_user_id)
      .maybeSingle();

    return NextResponse.json(
      {
        hasFamily: true,
        family: {
          id: family.id,
          name: family.name,
          inviteCode: family.invite_code,
          maxMembers: family.max_members,
          isOwner: family.owner_user_id === userId,
          ownerUserId: family.owner_user_id,
          createdAt: family.created_at,
        },
        members: (members || []).map((m) => {
          const user = Array.isArray(m.users) ? m.users[0] : m.users;
          return {
            id: m.id,
            userId: m.user_id,
            name: user?.name || "(名前未設定)",
            age: user?.age,
            role: m.role,
            shareData: m.share_data,
            joinedAt: m.joined_at,
            isMe: m.user_id === userId,
          };
        }),
        myMembership: {
          role: membership.role,
          shareData: membership.share_data,
        },
        ownerSubscription: ownerSub,
      },
      { headers: NO_CACHE_HEADERS }
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { error: "failed to load family", detail: msg },
      { status: 500 }
    );
  }
}

/**
 * POST /api/family
 * Body: { action, deviceId, ... }
 *
 * action:
 *   - "create": 新しい家族を作成（招待コード自動生成）
 *   - "join": 招待コードで既存家族に参加 { code }
 *   - "leave": 家族から脱退
 *   - "remove": メンバーを削除（オーナーのみ）{ memberId }
 *   - "update_share": データ共有設定変更 { shareData: true/false }
 *   - "regenerate_code": 招待コード再生成（オーナーのみ）
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, deviceId } = body;
    if (!action || !deviceId) {
      return NextResponse.json(
        { error: "action and deviceId required" },
        { status: 400 }
      );
    }

    const supabase = getSupabase();
    const userId = await getUserId(supabase, deviceId);
    if (!userId) {
      return NextResponse.json({ error: "user not found" }, { status: 404 });
    }

    // ========== CREATE: 家族を作成 ==========
    if (action === "create") {
      // 既に家族に所属していないかチェック
      const { data: existing } = await supabase
        .from("family_members")
        .select("id")
        .eq("user_id", userId)
        .maybeSingle();
      if (existing) {
        return NextResponse.json(
          { error: "already_in_family", message: "既に家族に所属しています" },
          { status: 409, headers: NO_CACHE_HEADERS }
        );
      }

      // 招待コード生成（衝突したら再生成）
      let inviteCode = "";
      for (let attempt = 0; attempt < 5; attempt++) {
        const candidate = generateInviteCode();
        const { data: existingCode } = await supabase
          .from("families")
          .select("id")
          .eq("invite_code", candidate)
          .maybeSingle();
        if (!existingCode) {
          inviteCode = candidate;
          break;
        }
      }
      if (!inviteCode) {
        return NextResponse.json(
          { error: "code_generation_failed" },
          { status: 500 }
        );
      }

      // 家族グループ作成
      const { data: family, error: familyErr } = await supabase
        .from("families")
        .insert({
          owner_user_id: userId,
          name: body.name || null,
          invite_code: inviteCode,
        })
        .select()
        .single();

      if (familyErr || !family) {
        return NextResponse.json(
          { error: "family_create_failed", detail: familyErr?.message },
          { status: 500 }
        );
      }

      // オーナーをメンバーとして登録
      await supabase.from("family_members").insert({
        family_id: family.id,
        user_id: userId,
        role: "owner",
        share_data: true,
      });

      return NextResponse.json(
        {
          ok: true,
          family: {
            id: family.id,
            name: family.name,
            inviteCode: family.invite_code,
            maxMembers: family.max_members,
          },
        },
        { headers: NO_CACHE_HEADERS }
      );
    }

    // ========== JOIN: 招待コードで参加 ==========
    if (action === "join") {
      const { code } = body;
      if (!code || typeof code !== "string") {
        return NextResponse.json(
          { error: "code required" },
          { status: 400, headers: NO_CACHE_HEADERS }
        );
      }

      // 既に家族に所属していないかチェック
      const { data: existing } = await supabase
        .from("family_members")
        .select("id")
        .eq("user_id", userId)
        .maybeSingle();
      if (existing) {
        return NextResponse.json(
          { error: "already_in_family", message: "既に家族に所属しています。先に脱退してください。" },
          { status: 409, headers: NO_CACHE_HEADERS }
        );
      }

      // 招待コードで家族を検索
      const { data: family } = await supabase
        .from("families")
        .select("id, max_members, name")
        .eq("invite_code", code.toUpperCase())
        .maybeSingle();

      if (!family) {
        return NextResponse.json(
          { error: "invalid_code", message: "招待コードが見つかりません" },
          { status: 404, headers: NO_CACHE_HEADERS }
        );
      }

      // メンバー数チェック
      const { data: currentMembers } = await supabase
        .from("family_members")
        .select("id")
        .eq("family_id", family.id);

      if ((currentMembers || []).length >= family.max_members) {
        return NextResponse.json(
          {
            error: "family_full",
            message: `家族メンバーは最大${family.max_members}人までです`,
          },
          { status: 409, headers: NO_CACHE_HEADERS }
        );
      }

      // 参加
      const { error: joinErr } = await supabase.from("family_members").insert({
        family_id: family.id,
        user_id: userId,
        role: "member",
        share_data: true,
      });

      if (joinErr) {
        return NextResponse.json(
          { error: "join_failed", detail: joinErr.message },
          { status: 500, headers: NO_CACHE_HEADERS }
        );
      }

      return NextResponse.json(
        {
          ok: true,
          message: `「${family.name || "家族グループ"}」に参加しました！プレミアム機能が使えます 🎉`,
          familyId: family.id,
        },
        { headers: NO_CACHE_HEADERS }
      );
    }

    // ========== LEAVE: 家族から脱退 ==========
    if (action === "leave") {
      const { data: membership } = await supabase
        .from("family_members")
        .select("id, family_id, role")
        .eq("user_id", userId)
        .maybeSingle();

      if (!membership) {
        return NextResponse.json(
          { error: "not_in_family" },
          { status: 404, headers: NO_CACHE_HEADERS }
        );
      }

      // オーナーが脱退する場合: 家族グループ全体を削除
      if (membership.role === "owner") {
        await supabase.from("families").delete().eq("id", membership.family_id);
        return NextResponse.json(
          {
            ok: true,
            message: "家族グループを解散しました",
            disbanded: true,
          },
          { headers: NO_CACHE_HEADERS }
        );
      }

      // メンバーが脱退する場合
      await supabase.from("family_members").delete().eq("id", membership.id);
      return NextResponse.json(
        { ok: true, message: "家族から脱退しました" },
        { headers: NO_CACHE_HEADERS }
      );
    }

    // ========== REMOVE: メンバー削除（オーナーのみ） ==========
    if (action === "remove") {
      const { memberId } = body;
      if (!memberId) {
        return NextResponse.json(
          { error: "memberId required" },
          { status: 400, headers: NO_CACHE_HEADERS }
        );
      }

      // 自分がオーナーであることを確認
      const { data: ownerMembership } = await supabase
        .from("family_members")
        .select("family_id, role")
        .eq("user_id", userId)
        .eq("role", "owner")
        .maybeSingle();

      if (!ownerMembership) {
        return NextResponse.json(
          { error: "not_owner", message: "オーナーのみ削除できます" },
          { status: 403, headers: NO_CACHE_HEADERS }
        );
      }

      // 削除対象が同じ家族に所属しているか確認
      const { data: targetMember } = await supabase
        .from("family_members")
        .select("id, role, user_id")
        .eq("id", memberId)
        .eq("family_id", ownerMembership.family_id)
        .maybeSingle();

      if (!targetMember) {
        return NextResponse.json(
          { error: "member_not_found" },
          { status: 404, headers: NO_CACHE_HEADERS }
        );
      }

      if (targetMember.role === "owner") {
        return NextResponse.json(
          { error: "cannot_remove_owner", message: "オーナーは削除できません" },
          { status: 400, headers: NO_CACHE_HEADERS }
        );
      }

      await supabase.from("family_members").delete().eq("id", memberId);

      return NextResponse.json(
        { ok: true, message: "メンバーを削除しました" },
        { headers: NO_CACHE_HEADERS }
      );
    }

    // ========== UPDATE_SHARE: データ共有設定変更 ==========
    if (action === "update_share") {
      const { shareData } = body;
      if (typeof shareData !== "boolean") {
        return NextResponse.json(
          { error: "shareData (boolean) required" },
          { status: 400, headers: NO_CACHE_HEADERS }
        );
      }

      const { data: membership } = await supabase
        .from("family_members")
        .select("id")
        .eq("user_id", userId)
        .maybeSingle();

      if (!membership) {
        return NextResponse.json(
          { error: "not_in_family" },
          { status: 404, headers: NO_CACHE_HEADERS }
        );
      }

      await supabase
        .from("family_members")
        .update({ share_data: shareData })
        .eq("id", membership.id);

      return NextResponse.json(
        { ok: true, shareData },
        { headers: NO_CACHE_HEADERS }
      );
    }

    // ========== REGENERATE_CODE: 招待コード再生成（オーナーのみ） ==========
    if (action === "regenerate_code") {
      const { data: ownerMembership } = await supabase
        .from("family_members")
        .select("family_id, role")
        .eq("user_id", userId)
        .eq("role", "owner")
        .maybeSingle();

      if (!ownerMembership) {
        return NextResponse.json(
          { error: "not_owner" },
          { status: 403, headers: NO_CACHE_HEADERS }
        );
      }

      let newCode = "";
      for (let attempt = 0; attempt < 5; attempt++) {
        const candidate = generateInviteCode();
        const { data: existingCode } = await supabase
          .from("families")
          .select("id")
          .eq("invite_code", candidate)
          .maybeSingle();
        if (!existingCode) {
          newCode = candidate;
          break;
        }
      }

      if (!newCode) {
        return NextResponse.json(
          { error: "code_generation_failed" },
          { status: 500 }
        );
      }

      await supabase
        .from("families")
        .update({ invite_code: newCode })
        .eq("id", ownerMembership.family_id);

      return NextResponse.json(
        { ok: true, inviteCode: newCode },
        { headers: NO_CACHE_HEADERS }
      );
    }

    return NextResponse.json(
      { error: "invalid_action" },
      { status: 400, headers: NO_CACHE_HEADERS }
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("Family API error:", e);
    return NextResponse.json(
      { error: "operation failed", detail: msg },
      { status: 500, headers: NO_CACHE_HEADERS }
    );
  }
}
