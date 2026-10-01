import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "../../lib/supabase-server";
import {
  FREE_LIMITS,
  getSubscriptionState,
} from "../../lib/subscription";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// 読み取りがキャッシュされると課金状態が古いまま返るため、
// no-store を指定した共通クライアントを使う（supabase-server.ts に経緯あり）
const getSupabase = createServerSupabase;

/**
 * GET /api/subscription?deviceId=xxx
 * 現在のサブスク状態と利用回数を返却
 */
export async function GET(req: NextRequest) {
  try {
    const deviceId = req.nextUrl.searchParams.get("deviceId");
    if (!deviceId) {
      return NextResponse.json(
        { error: "deviceId required" },
        { status: 400 }
      );
    }

    const supabase = getSupabase();
    // users の検索は自前で行い、失敗（Supabase の一時的なエラー・WAF での遮断など）は 500 で返す。
    // 以前は getUserIdByDeviceId が error を見ずに null を返し、失敗が「未登録の新規」の
    // 200 {isPaid:false, limits.chat:0} に化けていた。画面はこの応答で「使えない人」を判定して
    // 入力欄を案内カードに置き換えるため、有料・トライアル中・旧ユーザーまで締め出されていた。
    // 画面側（checkPlanLimitReached）は !res.ok なら判定しない（カードを出さない）ので、500 にすれば締め出さない。
    // また .maybeSingle() は同じ deviceId の行が2つあると null になるため、/api/chat と同じく先頭の1件を使う。
    const { data: users, error: userError } = await supabase
      .from("users")
      .select("id")
      .eq("device_id", deviceId)
      .limit(1);
    if (userError) {
      return NextResponse.json(
        { error: "failed to load subscription" },
        { status: 500 }
      );
    }
    const userId: string | null = users && users.length > 0 ? users[0].id : null;
    if (!userId) {
      // 行が0件のときだけ「未登録の新規」として返す
      return NextResponse.json({
        status: "free",
        isPaid: false,
        isTrial: false,
        isFamily: false,
        usage: { posture: 0, chat: 0, meal: 0 },
        // 未登録(=これから登録する新規)は新規の無料枠（姿勢チェック月1回・チャット/食事0回）。
        // 0 のままだと、姿勢チェックの保存前の確認で「使い切った」と誤って断ってしまう
        limits: {
          posture: FREE_LIMITS.posture,
          chat: FREE_LIMITS.chat,
          meal: FREE_LIMITS.meal,
        },
      });
    }

    const state = await getSubscriptionState(supabase, userId);
    return NextResponse.json(state);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { error: "failed to load subscription", detail: msg },
      { status: 500 }
    );
  }
}

/*
 * POST は置いていない。
 *
 * かつて subscribe / start_trial / cancel を受けていたが、
 * deviceId さえ判れば誰でも叩けるうえ、実態と合っていなかった。
 *   - subscribe / start_trial … ストアの購入を確認せずに有料化できてしまった（2026-09-20 削除）
 *   - cancel … このDBだけ「解約済み」にしても、ストアの請求は止まらない（2026-09-21 削除）
 *
 * 課金状態を動かすのは RevenueCat Webhook（/api/revenuecat/webhook・
 * 共有シークレットで認証）だけ。解約は App Store / Google Play の管理画面で行う。
 *
 * Capacitor の server.url で全端末がこの本番Webを読み込むため、
 * 古いアプリがここを叩くことはない。
 */
