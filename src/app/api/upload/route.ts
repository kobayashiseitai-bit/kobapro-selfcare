import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { getSignedImageUrl } from "../../lib/supabase-storage";

export const dynamic = "force-dynamic";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "",
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
  );
}

export async function POST(req: NextRequest) {
  try {
    const { imageData, deviceId } = await req.json();

    if (!imageData || !deviceId) {
      return NextResponse.json({ error: "imageData and deviceId required" }, { status: 400 });
    }

    const supabase = getSupabase();

    // ユーザーID取得
    const { data: users } = await supabase
      .from("users")
      .select("id")
      .eq("device_id", deviceId);

    const userId = users && users.length > 0 ? users[0].id : "anonymous";

    // base64をバイナリに変換
    const base64 = imageData.replace(/^data:image\/\w+;base64,/, "");
    const buffer = Buffer.from(base64, "base64");

    // ファイルパスを生成
    const timestamp = Date.now();
    const filePath = `${userId}/${timestamp}.jpg`;

    // Supabase Storageにアップロード
    const { error: uploadError } = await supabase.storage
      .from("posture-images")
      .upload(filePath, buffer, {
        contentType: "image/jpeg",
        upsert: false,
      });

    if (uploadError) {
      return NextResponse.json({ error: "upload failed", detail: uploadError.message }, { status: 500 });
    }

    // 公開URLを取得（DB保存用・既存互換）
    const { data: urlData } = supabase.storage
      .from("posture-images")
      .getPublicUrl(filePath);

    // クライアント表示用は Signed URL に変換（Privateバケット対応）
    const signedUrl = await getSignedImageUrl(
      supabase,
      filePath,
      "posture-images"
    );

    return NextResponse.json({
      url: urlData.publicUrl,  // DBに保存される公開URL（Privateでも同じ形式）
      signedUrl,               // クライアントが表示用に使うSigned URL
      path: filePath,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: "upload failed", detail: msg }, { status: 500 });
  }
}
