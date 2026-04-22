import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const revalidate = 0;
export const fetchCache = "force-no-store";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "",
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
  );
}

/**
 * POST /api/chat/upload-photo
 * Body: { deviceId, imageData (base64 data URL) }
 * チャット中にユーザーが撮影した姿勢写真をアップロードして公開URLを返す。
 * posture-images バケットに保存するが posture_records へは記録しない
 *  → チャット内の一時的な共有写真扱い（履歴は chat_logs 側に残る）
 */
export async function POST(req: NextRequest) {
  try {
    const { deviceId, imageData } = await req.json();
    if (!deviceId || !imageData) {
      return NextResponse.json(
        { error: "deviceId and imageData required" },
        { status: 400 }
      );
    }

    const supabase = getSupabase();
    const { data: users } = await supabase
      .from("users")
      .select("id")
      .eq("device_id", deviceId);
    if (!users || users.length === 0) {
      return NextResponse.json({ error: "user not found" }, { status: 404 });
    }
    const userId = users[0].id;

    // base64 → Buffer
    const base64 = imageData.replace(/^data:image\/\w+;base64,/, "");
    const buffer = Buffer.from(base64, "base64");
    const timestamp = Date.now();
    const filePath = `${userId}/chat-${timestamp}.jpg`;

    const { error: uploadError } = await supabase.storage
      .from("posture-images")
      .upload(filePath, buffer, {
        contentType: "image/jpeg",
        upsert: false,
      });

    if (uploadError) {
      return NextResponse.json(
        { error: "upload failed", detail: uploadError.message },
        { status: 500 }
      );
    }

    const { data: urlData } = supabase.storage
      .from("posture-images")
      .getPublicUrl(filePath);

    return NextResponse.json({
      ok: true,
      imageUrl: urlData.publicUrl,
      uploadedAt: new Date().toISOString(),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("Chat photo upload error:", e);
    return NextResponse.json(
      { error: "upload failed", detail: msg },
      { status: 500 }
    );
  }
}
