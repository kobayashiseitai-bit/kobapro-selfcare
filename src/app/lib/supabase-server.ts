import { createClient, SupabaseClient } from "@supabase/supabase-js";

/**
 * サーバー側（API Route）で使う Supabase クライアント。
 *
 * Next.js は グローバルの fetch を差し替えて GET をキャッシュする。
 * supabase-js の select は GET なので、そのままだと読み取り結果が
 * Data Cache に乗り、**DBを変えても古い値が返り続ける**。
 *
 * 2026-09-21 に本番で再現を確認した:
 *   - 課金状態を一度読むと、その後 DB を active_monthly → expired に
 *     変えても API は active_monthly を返し続けた
 *   - x-vercel-cache は MISS（関数は毎回動いている）＝ CDN ではなく内側のキャッシュ
 *
 * 実害として、RevenueCat Webhook で購入が記録されても、
 * アプリ起動時に一度読まれていると「無料プラン」のままになる。
 * そのため、ここで必ず no-store を指定する。
 */
export function createServerSupabase(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    "";

  return createClient(url, key, {
    auth: { persistSession: false },
    global: {
      fetch: (input: RequestInfo | URL, init?: RequestInit) =>
        fetch(input, { ...init, cache: "no-store" }),
    },
  });
}
