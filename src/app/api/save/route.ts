import { NextRequest, NextResponse } from "next/server";
import { buildLimitReachedMessage, checkAndIncrementUsage, decrementUsage } from "../../lib/subscription";

import { createServerSupabase } from "../../lib/supabase-server";

export const dynamic = "force-dynamic";

// 読み取りがキャッシュされて古い値が返るのを防ぐため、
// no-store を指定した共通クライアントを使う（supabase-server.ts に経緯あり）
const getSupabase = createServerSupabase;

export async function POST(req: NextRequest) {
  try {
    const supabase = getSupabase();
    const body = await req.json();
    const { type, deviceId, ...payload } = body;

    if (!deviceId) {
      return NextResponse.json({ error: "deviceId required" }, { status: 400 });
    }

    // ユーザーを検索
    const { data: existingUsers } = await supabase
      .from("users")
      .select("id")
      .eq("device_id", deviceId);

    let userId: string;

    if (existingUsers && existingUsers.length > 0) {
      userId = existingUsers[0].id;
    } else {
      // 新規作成
      const { data: newUsers, error: insertErr } = await supabase
        .from("users")
        .insert({ device_id: deviceId })
        .select("id");

      if (insertErr || !newUsers || newUsers.length === 0) {
        return NextResponse.json({ error: "user creation failed", detail: insertErr?.message }, { status: 500 });
      }
      userId = newUsers[0].id;
    }

    // データ保存
    if (type === "chat") {
      await supabase.from("chat_logs").insert({
        user_id: userId,
        role: payload.role,
        content: payload.content,
        recommended_symptom: payload.recommendedSymptom || null,
      });
    } else if (type === "posture") {
      // 同じ記録の送り直しは、数えずに ok を返す（何度送っても1回分）。
      // 画面は「保存できませんでした」からのやり直しのとき、前にアップロードできた写真のURLを
      // そのまま送ってくる（写真のURLは1回のアップロードごとに別のもの）。同じ人・同じ写真URLの
      // 記録が既にあれば、前回の保存は届いていて、返事だけが届かなかった（アプリが裏に回った・電波が切れた）。
      // ここで数え直すと、新規の方（月1回）はやり直しが必ず断られ、記録も無いまま案内カードが出てしまう。
      const postureImageUrl = typeof payload.imageUrl === "string" ? payload.imageUrl : "";
      if (postureImageUrl) {
        const { data: alreadySaved } = await supabase
          .from("posture_records")
          .select("id")
          .eq("user_id", userId)
          .eq("image_url", postureImageUrl)
          .limit(1);
        if (alreadySaved && alreadySaved.length > 0) {
          return NextResponse.json({ ok: true, userId, alreadySaved: true });
        }
      }

      // 姿勢チェックの利用制限チェック（未課金は 新規=月1回・2026-09-13より前の登録者=月3回まで）
      // 画面（CheckScreen）はこの応答を待ってから「保存しました」を出し、402 なら案内カードに切り替える
      const limitCheck = await checkAndIncrementUsage(
        supabase,
        userId,
        "posture"
      );
      if (!limitCheck.allowed) {
        const limit = typeof limitCheck.limit === "number" ? limitCheck.limit : 0;
        return NextResponse.json(
          {
            error: "limit_reached",
            feature: "posture",
            usage: limitCheck.usage,
            limit: limitCheck.limit,
            // 画面の案内カードと同じ文（上限0回と、今月分の使い切りで文が分かれる）
            message: buildLimitReachedMessage("posture", limit),
          },
          { status: 402 }
        );
      }
      const { error: postureInsertErr } = await supabase.from("posture_records").insert({
        user_id: userId,
        landmarks: payload.landmarks,
        diagnosis: payload.diagnosis,
        image_url: payload.imageUrl,
      });
      // 記録が入らなかったのに ok を返すと、画面が「保存しました」とお祝いを出してしまうため失敗を返す
      if (postureInsertErr) {
        // 先に数えた1回を戻す（記録が無いのに今月の無料分だけが減り、やり直しが断られないように）
        try {
          await decrementUsage(supabase, userId, "posture");
        } catch (rollbackErr) {
          console.error("[save] posture usage rollback failed:", rollbackErr);
        }
        return NextResponse.json(
          { error: "save failed", detail: postureInsertErr.message },
          { status: 500 }
        );
      }
    } else if (type === "symptom") {
      await supabase.from("symptom_selections").insert({
        user_id: userId,
        symptom_id: payload.symptomId,
      });
    }

    return NextResponse.json({ ok: true, userId });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: "save failed", detail: msg }, { status: 500 });
  }
}
