/**
 * Supabase Storage 関連のヘルパー
 * Private バケット + Signed URL 方式で写真を安全に配信する
 */

import { SupabaseClient } from "@supabase/supabase-js";

export type BucketName = "posture-images" | "meal-images";

// デフォルトの有効期限: 1時間（3600秒）
// 短すぎるとリロード時に再取得が必要、長すぎるとURL漏洩時のリスクが増す
const DEFAULT_EXPIRES_IN = 60 * 60;

/**
 * 保存されている image_url（公開URL or パス）から Signed URL を生成する。
 *
 * サポートする入力形式:
 *   1. 完全なURL（旧Public形式）: https://xxx.supabase.co/storage/v1/object/public/bucket/path.jpg
 *   2. 既にSigned URL: https://xxx.supabase.co/storage/v1/object/sign/bucket/path.jpg?...
 *   3. パスのみ: user123/1234.jpg
 *   4. プレースホルダー（/meal-placeholder.svg 等）: そのまま返す
 *   5. null/undefined/空文字: null を返す
 */
export async function getSignedImageUrl(
  supabase: SupabaseClient,
  imageUrlOrPath: string | null | undefined,
  bucket: BucketName,
  expiresIn: number = DEFAULT_EXPIRES_IN
): Promise<string | null> {
  if (!imageUrlOrPath || typeof imageUrlOrPath !== "string") return null;

  // プレースホルダー画像やローカル画像はそのまま
  if (imageUrlOrPath.startsWith("/") && !imageUrlOrPath.includes("/storage/")) {
    return imageUrlOrPath;
  }

  let path = imageUrlOrPath;

  // 完全なSupabase Storage URLからパスを抽出
  if (imageUrlOrPath.startsWith("http")) {
    // /public/bucket/ または /sign/bucket/ の後ろを抽出
    const regex = new RegExp(
      `/storage/v1/object/(?:public|sign)/${bucket}/(.+?)(?:\\?|$)`
    );
    const match = imageUrlOrPath.match(regex);
    if (match) {
      path = match[1];
    } else {
      // マッチしない場合は外部URL（例: Unsplash等）の可能性 → そのまま返す
      return imageUrlOrPath;
    }
  }

  // Signed URL を生成
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, expiresIn);

  if (error || !data?.signedUrl) {
    console.error(`Signed URL error for ${bucket}/${path}:`, error?.message);
    // フォールバック: 公開URLを返す（バケットがまだPublicな場合）
    return imageUrlOrPath.startsWith("http") ? imageUrlOrPath : null;
  }

  return data.signedUrl;
}

/**
 * 配列内の各オブジェクトの image_url を Signed URL に一括変換
 */
export async function signImageUrls<T extends { image_url?: string | null }>(
  supabase: SupabaseClient,
  items: T[],
  bucket: BucketName,
  expiresIn: number = DEFAULT_EXPIRES_IN
): Promise<T[]> {
  if (!items || items.length === 0) return items;
  const results = await Promise.all(
    items.map(async (item) => ({
      ...item,
      image_url: await getSignedImageUrl(
        supabase,
        item.image_url,
        bucket,
        expiresIn
      ),
    }))
  );
  return results;
}
