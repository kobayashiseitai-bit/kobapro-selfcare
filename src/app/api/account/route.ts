import { randomUUID } from "crypto";

import type { SupabaseClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

import { createServerSupabase } from "../../lib/supabase-server";
import {
  REVENUECAT_TODO_EMAIL,
  REVENUECAT_TODO_SUBJECT,
  SUPPORT_TICKET_FINISHED_STATUSES,
  markAccountDeletedSubject,
} from "../../lib/support-ticket-markers";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
// DELETE は写真を100枚ずつ読んで消すので、写真が多い方だと時間がかかる（chat/route.ts と同じ上限）
export const maxDuration = 60;

// 読み取りがキャッシュされて古い値が返るのを防ぐため、
// no-store を指定した共通クライアントを使う（supabase-server.ts に経緯あり）
const getSupabase = createServerSupabase;

/**
 * GET /api/account?deviceId=xxx&action=export
 * 自身の全データをJSON形式でエクスポート（GDPR/APPI対応）
 */
export async function GET(req: NextRequest) {
  try {
    const deviceId = req.nextUrl.searchParams.get("deviceId");
    const action = req.nextUrl.searchParams.get("action");

    if (!deviceId) {
      return NextResponse.json({ error: "deviceId required" }, { status: 400 });
    }

    if (action !== "export") {
      return NextResponse.json({ error: "invalid action" }, { status: 400 });
    }

    const supabase = getSupabase();
    const { data: users } = await supabase
      .from("users")
      .select("*")
      .eq("device_id", deviceId);

    if (!users || users.length === 0) {
      return NextResponse.json({ error: "user not found" }, { status: 404 });
    }
    const userId = users[0].id;

    // 全関連データを並行取得
    const [posture, chats, meals, weights, goals, symptoms, subscription, usage] =
      await Promise.all([
        supabase.from("posture_records").select("*").eq("user_id", userId),
        supabase.from("chat_logs").select("*").eq("user_id", userId),
        supabase.from("meal_records").select("*").eq("user_id", userId),
        supabase.from("weight_records").select("*").eq("user_id", userId),
        supabase.from("nutrition_goals").select("*").eq("user_id", userId),
        supabase.from("symptom_selections").select("*").eq("user_id", userId),
        supabase.from("subscriptions").select("*").eq("user_id", userId),
        supabase.from("usage_counters").select("*").eq("user_id", userId),
      ]);

    const exportData = {
      exported_at: new Date().toISOString(),
      export_version: "1.0",
      user_profile: users[0],
      posture_records: posture.data || [],
      chat_logs: chats.data || [],
      meal_records: meals.data || [],
      weight_records: weights.data || [],
      nutrition_goals: goals.data || [],
      symptom_selections: symptoms.data || [],
      subscription: subscription.data || [],
      usage_counters: usage.data || [],
    };

    const filename = `zero-pain-data-export-${new Date()
      .toISOString()
      .slice(0, 10)}.json`;

    return new NextResponse(JSON.stringify(exportData, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { error: "export failed", detail: msg },
      { status: 500 }
    );
  }
}

/** 写真を置いているバケット。どちらも {userId}/ の直下に置く（upload・chat/upload-photo・meal・meal/append の各 route） */
const PHOTO_BUCKETS = ["posture-images", "meal-images"] as const;
/**
 * Storage の list() で1回に読む件数。list() は何も指定しないと100件までしか返さないので、
 * 空のページが返るまで offset を進めて全部読む（サーバー側の上限で少なく返っても取りこぼさない）。
 */
const STORAGE_LIST_PAGE_SIZE = 100;
/** remove() 1回で消すファイルの数 */
const STORAGE_REMOVE_BATCH_SIZE = 100;
/** 念のための上限（1フォルダ 100件 × 1,000ページ = 10万枚）。超えたら消し残しとして記録する */
const STORAGE_LIST_MAX_PAGES = 1000;
/** フォルダの中のフォルダをたどる深さの上限（今のアップロードは {userId}/ の直下だけで、フォルダは作らない） */
const STORAGE_MAX_FOLDER_DEPTH = 2;
/** user_id で消す記録の表（ON DELETE CASCADE で消える表もあるが、明示的に消す） */
const USER_TABLES = [
  "posture_records",
  "chat_logs",
  "meal_records",
  "weight_records",
  "nutrition_goals",
  "symptom_selections",
  "subscriptions",
  "usage_counters",
] as const;
/**
 * 新規・未課金の人へ AI を呼んだ回数の台帳（checkin/route.ts の FREE_AI_LEDGER_EVENT と同じ名前）。
 * アプリ全体のその日の回数を event と created_at だけで数えているので、今日の分を消すと上限が効かなくなる
 * （消して登録し直すのをくり返せば AI を何度でも呼べる）。今日の分は device_id だけを置きかえて残す。
 */
const FREE_AI_LEDGER_EVENT = "checkin_ai_free";
/** support/route.ts は device_id を100文字で切って保存している */
const SUPPORT_TICKET_DEVICE_ID_MAX = 100;

/**
 * user_id で消す表のうち、users の ON DELETE CASCADE（supabase/migrations）でも消えるもの。
 * 本番の外部キーが移行ファイルと同じかを確かめていないので、CASCADE に任せずに明示的に消す（2026-10-02）。
 * どれもほかの表から参照されない（子の側）ので、先に消してよい。
 */
const CASCADE_CHILD_TABLES = [
  "daily_checkins",
  "coaching_tasks", // coaching_programs の子（program_id）。親より先に消す
  "invite_codes",
  "transfer_codes",
] as const;
/*
 * 問い合わせ（support_tickets）のうち、アカウントの削除で消すのは対応が終わったもの（SUPPORT_TICKET_FINISHED_STATUSES）だけ。
 * 対応が終わっていないもの（未対応 pending・対応中 in_progress）は消さずに残し、件名の頭に目印
 * （lib/support-ticket-markers.ts の ACCOUNT_DELETED_TICKET_PREFIX）を付けて user_id を外す（markKeptSupportTickets）。
 * 管理画面でその行を「解決済」にすると、api/admin/support の PATCH が消す
 * （返金・課金の相談などが途中で消えないように。/delete-account と privacy の 8. に「対応が終わってから削除します」と書いている）。
 */
/**
 * RevenueCat の顧客を消すためのサーバー用のシークレットキー（sk_ で始まるもの。RevenueCat の管理画面の
 * Project settings → API keys で作る）。アプリに入っている公開キーでは消せない。
 * 未設定・消せなかったときは、運営が後から消せるように「やること」を support_tickets に残す（ensureRevenueCatTodo）。
 */
const REVENUECAT_SECRET_API_KEY = process.env.REVENUECAT_SECRET_API_KEY || "";
// RevenueCat を消せなかったときに support_tickets に残す「やること」の件名（REVENUECAT_TODO_SUBJECT）は
// lib/support-ticket-markers.ts にある（管理画面 /admin/support に未対応として出て、「解決済」にすると消える）

/** 消せなかったもの。step は画面へ返す短い名前、detail はログにだけ出す */
type DeleteFailure = { step: string; detail: string };

function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

/** 今日（日本時間）の0時。checkin/route.ts と同じ数え方 */
function startOfTodayJst(): string {
  const jstOffsetMs = 9 * 60 * 60 * 1000;
  const todayJst = new Date(Date.now() + jstOffsetMs).toISOString().slice(0, 10);
  return `${todayJst}T00:00:00+09:00`;
}

/**
 * フォルダの中のファイルを、ページ送りしながら全部読む（中のフォルダもたどる）。
 * 途中で読めなかったときは、それまでに読めた分と error を返す。
 */
async function listAllFilePaths(
  supabase: SupabaseClient,
  bucket: string,
  folder: string,
  depth = 0
): Promise<{ paths: string[]; error: string | null }> {
  const paths: string[] = [];
  let offset = 0;
  for (let page = 0; page < STORAGE_LIST_MAX_PAGES; page++) {
    const { data, error } = await supabase.storage.from(bucket).list(folder, {
      limit: STORAGE_LIST_PAGE_SIZE,
      offset,
      sortBy: { column: "name", order: "asc" },
    });
    if (error) {
      return { paths, error: `list ${bucket}/${folder}/ offset=${offset}: ${error.message}` };
    }
    if (!data || data.length === 0) return { paths, error: null };
    for (const item of data) {
      const path = `${folder}/${item.name}`;
      if (item.id) {
        paths.push(path);
        continue;
      }
      // id が無いのはフォルダ
      if (depth >= STORAGE_MAX_FOLDER_DEPTH) {
        return { paths, error: `folder too deep: ${bucket}/${path}/` };
      }
      const sub = await listAllFilePaths(supabase, bucket, path, depth + 1);
      paths.push(...sub.paths);
      if (sub.error) return { paths, error: sub.error };
    }
    offset += data.length;
  }
  return { paths, error: `too many files: ${bucket}/${folder}/ (over ${STORAGE_LIST_MAX_PAGES} pages)` };
}

/**
 * 1人分のフォルダ（{bucket}/{userId}/）の写真を全部消し、消し残しがないか読み直して確かめる。
 * 失敗しても例外は投げず、failures に入れて返す（ユーザーデータの削除は続ける）。
 */
async function deletePhotoFolder(
  supabase: SupabaseClient,
  bucket: string,
  userId: string
): Promise<{ removed: number; failures: DeleteFailure[] }> {
  const step = `storage:${bucket}`;
  const failures: DeleteFailure[] = [];
  let removed = 0;
  try {
    // 先に全部読んでから消す（消しながら offset で読むと、ずれて読み飛ばすため）
    const listed = await listAllFilePaths(supabase, bucket, userId);
    if (listed.error) failures.push({ step, detail: listed.error });

    for (let i = 0; i < listed.paths.length; i += STORAGE_REMOVE_BATCH_SIZE) {
      const batch = listed.paths.slice(i, i + STORAGE_REMOVE_BATCH_SIZE);
      const { data, error } = await supabase.storage.from(bucket).remove(batch);
      if (error) {
        failures.push({
          step,
          detail: `remove ${batch.length} files in ${bucket}/${userId}/: ${error.message}`,
        });
        continue;
      }
      removed += data?.length ?? 0;
    }

    // 消し残しがないか読み直す
    const after = await listAllFilePaths(supabase, bucket, userId);
    if (after.error) {
      failures.push({ step, detail: `recheck: ${after.error}` });
    } else if (after.paths.length > 0) {
      failures.push({
        step,
        detail: `${after.paths.length} files left in ${bucket}/${userId}/ (e.g. ${after.paths
          .slice(0, 3)
          .join(", ")})`,
      });
    }
  } catch (e) {
    failures.push({ step, detail: `${bucket}/${userId}/: ${errorMessage(e)}` });
  }
  return { removed, failures };
}

/** DB の削除を1つ行い、エラーを確かめる（例外も拾い、ほかの削除を止めない） */
async function runDbStep(
  step: string,
  run: () => PromiseLike<{ error: { message: string } | null; count: number | null }>
): Promise<{ step: string; count: number | null; failure: DeleteFailure | null }> {
  try {
    const { error, count } = await run();
    if (error) return { step, count: null, failure: { step, detail: error.message } };
    return { step, count, failure: null };
  } catch (e) {
    return { step, count: null, failure: { step, detail: errorMessage(e) } };
  }
}

/**
 * RevenueCat の顧客（app_user_id = deviceId。lib/iap.ts）を消す。
 * DELETE https://api.revenuecat.com/v1/subscribers/{app_user_id}。RevenueCat の説明どおり、
 * 200（削除を受け付けた）と 404（もともと無い＝料金プランの画面を開いたことがない人）は「消えた」として扱う。
 */
async function deleteRevenueCatCustomer(
  appUserId: string
): Promise<{ deleted: boolean; detail: string }> {
  if (!REVENUECAT_SECRET_API_KEY) {
    return { deleted: false, detail: "REVENUECAT_SECRET_API_KEY が未設定" };
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(
      `https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(appUserId)}`,
      {
        method: "DELETE",
        headers: { Authorization: `Bearer ${REVENUECAT_SECRET_API_KEY}` },
        cache: "no-store",
        signal: controller.signal,
      }
    );
    if (res.ok || res.status === 404) return { deleted: true, detail: `HTTP ${res.status}` };
    return { deleted: false, detail: `HTTP ${res.status}` };
  } catch (e) {
    return { deleted: false, detail: errorMessage(e) };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * RevenueCat の顧客をその場で消せなかったときに、運営が後から消せるように「やること」を support_tickets に残す
 * （管理画面 /admin/support に未対応として出る。users を消すと deviceId をたどれなくなるため、users より先に残す）。
 * 同じ deviceId の「やること」が未対応のまま残っていれば、作り直さない（やり直しのたびに増えないように）。
 * お名前・メールなどは入れず、RevenueCat で顧客を探すための deviceId だけを書く。
 */
async function ensureRevenueCatTodo(
  supabase: SupabaseClient,
  deviceId: string,
  reason: string
): Promise<DeleteFailure | null> {
  const step = "revenuecat";
  const ticketDeviceId = deviceId.slice(0, SUPPORT_TICKET_DEVICE_ID_MAX);
  try {
    const { data: existing, error: findErr } = await supabase
      .from("support_tickets")
      .select("id")
      .eq("device_id", ticketDeviceId)
      .eq("subject", REVENUECAT_TODO_SUBJECT)
      .in("status", ["pending", "in_progress"])
      .limit(1);
    if (findErr) return { step, detail: `todo lookup: ${findErr.message} (revenuecat: ${reason})` };
    if (existing && existing.length > 0) return null;

    const { error: insErr } = await supabase.from("support_tickets").insert({
      user_id: null,
      name: "（自動）アカウント削除",
      email: REVENUECAT_TODO_EMAIL,
      category: "account",
      subject: REVENUECAT_TODO_SUBJECT,
      message: [
        `アプリからアカウントが削除されましたが、RevenueCat の顧客記録をその場で削除できませんでした（理由: ${reason}）。`,
        `RevenueCat の管理画面で、App User ID「${deviceId}」の顧客を探して削除してください（見つからなければ、何もしなくてかまいません）。終わったら、このお問い合わせを「解決済」にしてください（「解決済」にすると、このお問い合わせは消えます）。`,
        "/delete-account とプライバシーポリシーで「30日以内に削除します」とお知らせしています。",
        "Vercel の環境変数 REVENUECAT_SECRET_API_KEY（RevenueCat のシークレットキー）を入れると、次からはアカウントの削除と同時に消えます。",
      ].join("\n"),
      status: "pending",
      device_id: ticketDeviceId,
      device_info: null,
    });
    if (insErr) return { step, detail: `todo insert: ${insErr.message} (revenuecat: ${reason})` };
    return null;
  } catch (e) {
    return { step, detail: `todo: ${errorMessage(e)} (revenuecat: ${reason})` };
  }
}

type KeptTicketRow = { id: string; user_id: string | null; subject: string | null };

/**
 * 対応が終わっていないお問い合わせ（未対応・対応中）を残すときに、あとから見つけて消せるように目印を付ける。
 *   - 対象: user_id が本人（userIds）か、device_id がこの端末のもののうち、status が resolved・spam でない行。
 *     device_id だけが合う行（登録の前に送ったものなど）も含める。RevenueCat の「やること」の行と、
 *     user_id がほかの人の行は触らない。
 *   - 件名の頭に ACCOUNT_DELETED_TICKET_PREFIX を付け、user_id を外す（移行ファイルの ON DELETE SET NULL と同じことを
 *     自分で行う。本番の外部キーを確かめていないので、外れていないと users を消せない場合がある）。
 *   - 目印が付いて user_id も外れている行は、何もしない（やり直しても、目印が重ならない）。
 * 管理画面でこの行を「解決済」にすると、api/admin/support の PATCH が消す。
 */
async function markKeptSupportTickets(
  supabase: SupabaseClient,
  userIds: string[],
  ticketDeviceId: string
): Promise<{ step: string; count: number | null; failure: DeleteFailure | null }> {
  const step = "table:support_tickets(mark_kept)";
  const finished = `(${SUPPORT_TICKET_FINISHED_STATUSES.join(",")})`;
  try {
    // device_id は端末から届いた文字列なので、.or() の文字列に入れずに2回に分けて読む
    const [byUser, byDevice] = await Promise.all([
      supabase
        .from("support_tickets")
        .select("id, user_id, subject")
        .in("user_id", userIds)
        .not("status", "in", finished),
      supabase
        .from("support_tickets")
        .select("id, user_id, subject")
        .eq("device_id", ticketDeviceId)
        .not("status", "in", finished),
    ]);
    if (byUser.error) return { step, count: null, failure: { step, detail: `lookup(user): ${byUser.error.message}` } };
    if (byDevice.error) {
      return { step, count: null, failure: { step, detail: `lookup(device): ${byDevice.error.message}` } };
    }

    const userIdSet = new Set(userIds);
    const rows = new Map<string, KeptTicketRow>();
    for (const row of [...(byUser.data || []), ...(byDevice.data || [])] as KeptTicketRow[]) {
      rows.set(row.id, row);
    }
    const targets = Array.from(rows.values()).filter(
      (row) =>
        row.subject !== REVENUECAT_TODO_SUBJECT &&
        (row.user_id === null || userIdSet.has(row.user_id))
    );

    let count = 0;
    const errors: string[] = [];
    await Promise.all(
      targets.map(async (row) => {
        const subject = markAccountDeletedSubject(row.subject);
        if (subject === row.subject && row.user_id === null) return; // 付け終わっている
        const { error } = await supabase
          .from("support_tickets")
          .update({ subject, user_id: null })
          .eq("id", row.id);
        if (error) errors.push(`${row.id}: ${error.message}`);
        else count += 1;
      })
    );
    if (errors.length > 0) {
      return {
        step,
        count,
        failure: { step, detail: `update ${errors.length} rows: ${errors.slice(0, 3).join("; ")}` },
      };
    }
    return { step, count, failure: null };
  } catch (e) {
    return { step, count: null, failure: { step, detail: errorMessage(e) } };
  }
}

/**
 * DELETE /api/account
 * Body: { deviceId, confirmText: 'DELETE' }
 * アカウントと関連するデータを削除する（設定画面の「アカウントを削除」）。
 *
 * 本人の確認は今までどおり「その端末の deviceId」と「DELETE の入力」だけ。deviceId に合う users の行が
 * 1行も無ければ 404 で、何も消さない（問い合わせ・利用の記録だけを消すこともしない）。
 *
 * 消す順番（2026-10-02。消すもの・残るものは /delete-account と privacy の 8. に書いている）:
 *   0. 審査用の共用アカウント（reusable の引継ぎコード REVIEW26 などを持つ users）は消さずに 403 を返す。
 *      消すと transfer_codes の CASCADE でコードも消え、次の審査で入れなくなる（docs/app-review-2026-09.md）。
 *   1. 写真: posture-images と meal-images の {userId}/ の下。list() をページ送りして全部読んでから消し、読み直して確かめる。
 *   2. 記録の表を消す。CASCADE で消える表も、本番の外部キーを確かめていないので明示的に消す（子の表を先に、親の表をあと）。
 *      - USER_TABLES と CASCADE_CHILD_TABLES を user_id で
 *      - family_members（本人の行と、本人がオーナーの家族グループの行）、invite_redemptions（招待した側・された側）
 *      - support_tickets（問い合わせ）: user_id か device_id が合う行のうち、対応が終わったもの（resolved・spam）だけ。
 *        対応が終わっていないもの（未対応・対応中）は残す（SUPPORT_TICKET_FINISHED_STATUSES の上の説明）
 *      - app_events（利用の記録）: device_id が合う行（users と外部キーが無いので、消さないと残る）。
 *        ただし今日の checkin_ai_free だけは、device_id を使い捨ての番号に置きかえて残す（FREE_AI_LEDGER_EVENT の説明）
 *      - そのあとで coaching_programs と families（本人がオーナー）。残す問い合わせには、件名の頭に
 *        「【アカウント削除済み・対応後に削除】」を付けて user_id を外す（markKeptSupportTickets。device_id だけが合う行も同じ）。
 *        管理画面で「解決済」にすると、その行は api/admin/support の PATCH が消す
 *   3. RevenueCat の顧客記録（app_user_id = deviceId）。その場で消せなかったときは（シークレットキーが未設定のときも）、
 *      運営が後から消せるように support_tickets に「やること」を残す（ensureRevenueCatTodo。これも「解決済」にすると消える）。
 *   4. users の行（同じ deviceId の行が2つ以上あっても全部。save・meal は「探してから作る」ので同時に呼ばれるとできうる）。
 *
 * 失敗したとき:
 *   1〜3 のどれかが失敗したら、users は消さずに 500 を返す（アカウントが残っているので、もう一度押せば続きから消せる。
 *   どの手順も2回行っても結果は変わらない）。以前は users を消して ok: true を返し、消し残しはログ1行だけだった。
 *   users が消えなかったときも 500。どちらも "[account-delete] incomplete" で deviceId・userIds と中身をログに出す。
 *
 * 消さないもの（ここでは消せない・決めが要る）:
 *   - App Store / Google Play の購入記録
 *   - 引継ぎコードで復元したとき、新しい端末で先に作られたアカウント（transfer/restore は元のアカウントを消さない。
 *     その端末の deviceId は上書きされて端末に残らないので、ここからはたどれない）
 *   - 未登録のときに撮った姿勢写真（posture-images/anonymous/。誰の写真か分からない）
 *   - 別の端末やパソコンのブラウザから送った問い合わせ（user_id も device_id も合わない）
 *   - 未対応・対応中の問い合わせ（目印を付けて残し、管理画面で「解決済」にしたときに消える。上の 2. を参照）
 *   - 問い合わせのときに Resend で送ったメール（運営のメールボックスと Resend の送信記録）
 */
export async function DELETE(req: NextRequest) {
  try {
    const { deviceId, confirmText } = await req.json();

    if (!deviceId || typeof deviceId !== "string") {
      return NextResponse.json({ error: "deviceId required" }, { status: 400 });
    }

    // 誤削除防止: 「DELETE」と入力してもらう
    if (confirmText !== "DELETE") {
      return NextResponse.json(
        { error: "confirmText must be 'DELETE'" },
        { status: 400 }
      );
    }

    const supabase = getSupabase();
    const { data: users, error: usersErr } = await supabase
      .from("users")
      .select("id")
      .eq("device_id", deviceId);

    if (usersErr) {
      throw new Error(`users lookup failed: ${usersErr.message}`);
    }
    if (!users || users.length === 0) {
      return NextResponse.json({ error: "user not found" }, { status: 404 });
    }
    // 同じ deviceId の行が2つ以上あっても全部消す（以前は users[0] だけだった）
    const userIds: string[] = Array.from(new Set(users.map((u: { id: string }) => u.id)));

    // 0. 審査用の共用アカウントは消さない（何も消さずに返す。確かめられないときも消さない）
    const { data: reviewerCodes, error: reviewerErr } = await supabase
      .from("transfer_codes")
      .select("code")
      .in("user_id", userIds)
      .eq("reusable", true)
      .limit(1);
    if (reviewerErr) {
      throw new Error(`reviewer check failed: ${reviewerErr.message}`);
    }
    if (reviewerCodes && reviewerCodes.length > 0) {
      console.log("[account-delete] skipped: shared App Review account", JSON.stringify({ userIds }));
      return NextResponse.json(
        {
          error:
            "このアカウントは、アプリの審査のための共用アカウントのため、削除できません。削除の動作は、新しく登録したアカウントでお試しください。（This is the shared App Review account, so it cannot be deleted. Please register a new account to try account deletion.）",
          reviewerAccount: true,
        },
        { status: 403 }
      );
    }

    // 1. Storage から写真を削除（{userId}/ の下を全部）
    const photoResults = await Promise.all(
      userIds.flatMap((userId) =>
        PHOTO_BUCKETS.map(async (bucket) => ({
          bucket,
          ...(await deletePhotoFolder(supabase, bucket, userId)),
        }))
      )
    );

    // 2. 記録の表を削除（子の表 → 親の表の順）
    const ticketDeviceId = deviceId.slice(0, SUPPORT_TICKET_DEVICE_ID_MAX);
    const todayStart = startOfTodayJst();

    // 本人がオーナーの家族グループ（ほかのメンバーの family_members の行も、グループより先に消す）
    let ownedFamilyIds: string[] = [];
    const lookupFailures: DeleteFailure[] = [];
    try {
      const { data: owned, error: ownedErr } = await supabase
        .from("families")
        .select("id")
        .in("owner_user_id", userIds);
      if (ownedErr) lookupFailures.push({ step: "table:families", detail: `lookup: ${ownedErr.message}` });
      else ownedFamilyIds = (owned || []).map((f: { id: string }) => f.id);
    } catch (e) {
      lookupFailures.push({ step: "table:families", detail: `lookup: ${errorMessage(e)}` });
    }

    const childResults = await Promise.all([
      ...[...USER_TABLES, ...CASCADE_CHILD_TABLES].map((table) =>
        runDbStep(`table:${table}`, () =>
          supabase.from(table).delete({ count: "exact" }).in("user_id", userIds)
        )
      ),
      runDbStep("table:family_members", () =>
        supabase.from("family_members").delete({ count: "exact" }).in("user_id", userIds)
      ),
      ...(ownedFamilyIds.length > 0
        ? [
            runDbStep("table:family_members(owned_family)", () =>
              supabase
                .from("family_members")
                .delete({ count: "exact" })
                .in("family_id", ownedFamilyIds)
            ),
          ]
        : []),
      runDbStep("table:invite_redemptions(inviter)", () =>
        supabase.from("invite_redemptions").delete({ count: "exact" }).in("inviter_user_id", userIds)
      ),
      runDbStep("table:invite_redemptions(invitee)", () =>
        supabase.from("invite_redemptions").delete({ count: "exact" }).in("invitee_user_id", userIds)
      ),
      runDbStep("table:support_tickets", () =>
        supabase
          .from("support_tickets")
          .delete({ count: "exact" })
          .in("user_id", userIds)
          .in("status", [...SUPPORT_TICKET_FINISHED_STATUSES])
      ),
      runDbStep("table:support_tickets(device)", () =>
        supabase
          .from("support_tickets")
          .delete({ count: "exact" })
          .eq("device_id", ticketDeviceId)
          .in("status", [...SUPPORT_TICKET_FINISHED_STATUSES])
      ),
      runDbStep("table:app_events", () =>
        supabase
          .from("app_events")
          .delete({ count: "exact" })
          .eq("device_id", deviceId)
          .neq("event", FREE_AI_LEDGER_EVENT)
      ),
      runDbStep("table:app_events(ledger_past)", () =>
        supabase
          .from("app_events")
          .delete({ count: "exact" })
          .eq("device_id", deviceId)
          .eq("event", FREE_AI_LEDGER_EVENT)
          .lt("created_at", todayStart)
      ),
      runDbStep("table:app_events(ledger_today)", () =>
        supabase
          .from("app_events")
          .update({ device_id: `deleted-${randomUUID()}` }, { count: "exact" })
          .eq("device_id", deviceId)
          .eq("event", FREE_AI_LEDGER_EVENT)
          .gte("created_at", todayStart)
      ),
    ]);
    const parentResults = await Promise.all([
      runDbStep("table:coaching_programs", () =>
        supabase.from("coaching_programs").delete({ count: "exact" }).in("user_id", userIds)
      ),
      runDbStep("table:families", () =>
        supabase.from("families").delete({ count: "exact" }).in("owner_user_id", userIds)
      ),
      // 残す問い合わせ（対応が終わっていないもの）に目印を付けて、user_id を外す（markKeptSupportTickets の説明）。
      // 対応の終わった行は上で消している。device_id は残る（管理画面で「解決済」にしたときに行ごと消える）
      markKeptSupportTickets(supabase, userIds, ticketDeviceId),
    ]);
    const dbResults = [...childResults, ...parentResults];

    const failures: DeleteFailure[] = [
      ...photoResults.flatMap((r) => r.failures),
      ...lookupFailures,
      ...dbResults.flatMap((r) => (r.failure ? [r.failure] : [])),
    ];

    // 3. RevenueCat の顧客記録（写真と記録を消せたときだけ。消せなかったら「やること」を残す）
    let revenueCat: "deleted" | "todo" | "not_run" = "not_run";
    if (failures.length === 0) {
      const rc = await deleteRevenueCatCustomer(deviceId);
      if (rc.deleted) {
        revenueCat = "deleted";
      } else {
        console.warn("[account-delete] revenuecat not deleted:", rc.detail);
        const todoFailure = await ensureRevenueCatTodo(supabase, deviceId, rc.detail);
        if (todoFailure) failures.push(todoFailure);
        else revenueCat = "todo";
      }
    }

    const summary = {
      users: userIds.length,
      photosRemoved: Object.fromEntries(
        PHOTO_BUCKETS.map((bucket) => [
          bucket,
          photoResults.filter((r) => r.bucket === bucket).reduce((n, r) => n + r.removed, 0),
        ])
      ),
      rows: Object.fromEntries(dbResults.map((r) => [r.step.replace(/^table:/, ""), r.count])),
      revenueCat,
    };

    // 1〜3 で消せなかったものがあれば、users は消さない（アカウントを残して、やり直せるようにする）
    if (failures.length > 0) {
      console.error(
        "[account-delete] incomplete",
        JSON.stringify({ deviceId, userIds, accountDeleted: false, ...summary, failures })
      );
      return NextResponse.json(
        {
          error:
            "削除の途中で、一部のデータを消せませんでした。アカウントはまだ残っています。時間をおいて、もう一度「完全に削除する」を押してください（続きから削除します）。何度も失敗するときは、サポートのお問い合わせフォームからお知らせください。",
          failures: Array.from(new Set(failures.map((f) => f.step))),
        },
        { status: 500 }
      );
    }

    // 4. ユーザー本体を削除し、消えたかを読み直して確かめる
    const usersResult = await runDbStep("table:users", () =>
      supabase.from("users").delete({ count: "exact" }).in("id", userIds)
    );
    let usersLeft: number | null = null;
    try {
      const { data: remaining, error: recheckErr } = await supabase
        .from("users")
        .select("id")
        .in("id", userIds);
      if (!recheckErr) usersLeft = remaining?.length ?? 0;
    } catch {
      // 読み直せなかったときは、削除の件数で判断する
    }
    const accountDeleted =
      usersLeft === null
        ? !usersResult.failure && usersResult.count === userIds.length
        : usersLeft === 0;

    if (!accountDeleted) {
      const userFailures: DeleteFailure[] = [
        ...(usersResult.failure ? [usersResult.failure] : []),
        ...(usersLeft ? [{ step: "table:users", detail: `${usersLeft} users rows left` }] : []),
      ];
      console.error(
        "[account-delete] incomplete",
        JSON.stringify({ deviceId, userIds, accountDeleted, ...summary, failures: userFailures })
      );
      return NextResponse.json(
        {
          error:
            "アカウントを削除できませんでした。時間をおいて、もう一度「完全に削除する」を押してください。何度も失敗するときは、サポートのお問い合わせフォームからお知らせください。",
          failures: Array.from(new Set(userFailures.map((f) => f.step))),
        },
        { status: 500 }
      );
    }

    console.log("[account-delete] done", JSON.stringify({ ...summary, usersDeleted: usersResult.count }));
    return NextResponse.json({ ok: true, message: "アカウントを削除しました" });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[account-delete] failed", msg);
    return NextResponse.json(
      {
        error:
          "アカウントを削除できませんでした。時間をおいて、もう一度お試しください。何度も失敗するときは、サポートのお問い合わせフォームからお知らせください。",
        detail: msg,
      },
      { status: 500 }
    );
  }
}
