import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { checkAndIncrementUsage } from "../../lib/subscription";

export const dynamic = "force-dynamic";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
  );
}

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
      // 姿勢診断の利用制限チェック（無料プランは月3回まで）
      const limitCheck = await checkAndIncrementUsage(
        supabase,
        userId,
        "posture"
      );
      if (!limitCheck.allowed) {
        return NextResponse.json(
          {
            error: "limit_reached",
            feature: "posture",
            usage: limitCheck.usage,
            limit: limitCheck.limit,
            message: `無料プランの姿勢診断は月${limitCheck.limit}回までです。`,
          },
          { status: 402 }
        );
      }
      await supabase.from("posture_records").insert({
        user_id: userId,
        landmarks: payload.landmarks,
        diagnosis: payload.diagnosis,
        image_url: payload.imageUrl,
      });
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
