import { NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceSupabase } from "../../../lib/supabase-server";
import {
  activeStatusFor,
  applyRevenueCatLookup,
  fetchRevenueCatEntitlement,
  planFromProductId,
  type RevenueCatLookup,
} from "../../../lib/revenuecat";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * RevenueCat Webhook 受信エンドポイント
 *
 * RevenueCat ダッシュボード → Project Settings → Integrations → Webhooks
 * URL: https://posture-app-steel.vercel.app/api/revenuecat/webhook
 *
 * Authorization Header に共有シークレットを設定しておき、
 * 環境変数 REVENUECAT_WEBHOOK_SECRET と照合する。
 *
 * イベント種別:
 *   INITIAL_PURCHASE / RENEWAL / UNCANCELLATION
 *     → status を active_monthly / active_yearly に。plan と is_family もそのときの商品から書き直す
 *     （ストアの無料体験で始まったもの＝period_type が TRIAL は status を trial にし、
 *       trial_ends_at に無料体験の終了日時を入れる。無料体験のあとの RENEWAL は active に戻る）
 *   CANCELLATION / EXPIRATION（2026-10-02〜 聞き直して書く）
 *     → イベントの中身では書かず、RevenueCat に今の状態を聞き直して書く（handleEndOfTerm）。
 *       有料なら有料のまま（自動更新を止めていれば cancelled）、有料でなければ expired。plan / is_family は
 *       有料のときだけ今の商品で書き直す。以前はイベントの status と期限をそのまま upsert していたため、
 *       遅れて届いた古い知らせ（1回目の配信が 500 になって再送されたもの・RevenueCat の検知が遅れたもの）が、
 *       そのあと買い直した人の有料の行（購入直後の同期や新しい購入の Webhook が書いたもの）を上書きし、
 *       次の RENEWAL（月額なら1か月後・年額なら1年後）まで無料扱いになっていた。
 *       聞き直せなかったときは、イベントの期限より後ろの期限を持つ行（新しい期間の行）は書き換えない。
 *   PRODUCT_CHANGE（2026-10-02〜）
 *     → イベントの商品IDでは書かず、RevenueCat に今の状態を聞き直して書く。
 *       RevenueCat の PRODUCT_CHANGE は「切替を申し込んだ」知らせで、切替が効いたことは意味しない
 *       （単身⇄家族の切替は次の更新から効くことが多い。product_id は切替前の商品）。
 *       以前は product_id で plan / is_family / status を書いていたため、
 *       家族→単身に下げた人の is_family が true のまま残り、家族メンバーが880円の契約で有料扱いになっていた。
 *   TRANSFER（2026-10-02〜）
 *     → 「購入を復元」で購入が別の deviceId へ移ったとき（RevenueCat の復元の既定は「移す」）。
 *       transferred_from / transferred_to の各 deviceId について RevenueCat に今の状態を聞き直し、
 *       移し元は有料でなければ expired にする。以前は無視していたため、移し元が active_* のまま残り、
 *       1つの定期購入で何台も有料になり、解約後も移し元はずっと有料だった
 *       （解約・期限切れの知らせは移し先にしか届かない）。
 *       移し元が家族のオーナーなら、家族ごと移し先へ付け替える（moveFamilyOwnership）。付け替えないと、
 *       移し元が expired になった時点で家族全員が無料扱いになる（メンバーはオーナーの行だけを見るため）。
 *   BILLING_ISSUE → 状態は変えない（ストアが課金をやり直す）
 *
 * 聞き直し（GET /v1/subscribers）に失敗したときは 500 を返す。RevenueCat が時間をおいて送り直す。
 */

// 読み取りがキャッシュされて古い値が返るのを防ぐため、
// no-store を指定した共通クライアントを使う（supabase-server.ts に経緯あり）
const getSupabase = createServiceSupabase;

interface RevenueCatEvent {
  type: string;
  /** TRANSFER のイベントには入らないことがある */
  app_user_id?: string;
  /** PRODUCT_CHANGE では切替前の商品 */
  product_id?: string;
  /** PRODUCT_CHANGE の切替後の商品（参考。書き込みには使わず RevenueCat に聞き直す） */
  new_product_id?: string;
  expiration_at_ms?: number;
  purchased_at_ms?: number;
  /** TRIAL（ストアの無料体験中）/ INTRO / NORMAL / PREPAID */
  period_type?: string;
  entitlement_ids?: string[];
  /** APP_STORE / PLAY_STORE など */
  store?: string;
  /** TRANSFER のみ: 購入が移る前の App User ID（＝deviceId）たち */
  transferred_from?: string[];
  /** TRANSFER のみ: 購入が移った先の App User ID（＝deviceId）たち */
  transferred_to?: string[];
}

type DbStatus =
  | "free"
  | "trial"
  | "active_monthly"
  | "active_yearly"
  | "cancelled"
  | "expired";

/** RevenueCat のストア名 → 問い合わせに使う公開キーの種類 */
function platformOf(event: RevenueCatEvent): "ios" | "android" {
  return event.store === "PLAY_STORE" ? "android" : "ios";
}

/** deviceId → users.id。見つからなければ null、読み込みに失敗したら例外 */
async function findUserId(supabase: SupabaseClient, deviceId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from("users")
    .select("id")
    .eq("device_id", deviceId)
    .limit(1);
  if (error) throw new Error(`failed to load user: ${error.message}`);
  return (data?.[0]?.id as string | undefined) ?? null;
}

/** TRANSFER の ID の並びを、問い合わせてよいものだけにする */
function toDeviceIdList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const ids = value.filter(
    (v): v is string =>
      typeof v === "string" &&
      v.length > 0 &&
      v.length <= 200 &&
      // アプリは必ず deviceId でログインするので、匿名 ID は users にいない（問い合わせると顧客ができてしまう）
      !v.startsWith("$RCAnonymousID")
  );
  return Array.from(new Set(ids)).slice(0, 20);
}

/** TRANSFER で読んだ1件分（users に登録済みで、RevenueCat に聞き直せたもの） */
interface TransferTarget {
  deviceId: string;
  role: "from" | "to";
  userId: string;
  lookup: Extract<RevenueCatLookup, { ok: true }>;
}

type TransferResult = { deviceId: string; role: "from" | "to" | "family"; result: string };

/**
 * TRANSFER: 移し元・移し先の各 deviceId を RevenueCat の今の状態に合わせる。
 * - 移し先（transferred_to）: 有料なら有料にする（/api/subscription/sync と同じ書き込み）
 * - 移し元が家族のオーナーなら、家族ごと移し先へ付け替える（moveFamilyOwnership。2026-10-02）
 * - 移し元（transferred_from）: 有料なら有料のまま書き直し、有料でなければ expired にする（downgrade）
 * 移し先 → 家族の付け替え → 移し元 の順に書く（家族のメンバーが無料扱いになる間をつくらないため）。
 * どれか1つでも聞き直し・書き込みに失敗したら 500 を返し、RevenueCat に送り直してもらう
 * （書き込みは何度やっても同じ結果になる）。
 */
async function handleTransfer(supabase: SupabaseClient, event: RevenueCatEvent): Promise<Response> {
  const platform = platformOf(event);
  const from = toDeviceIdList(event.transferred_from);
  const to = toDeviceIdList(event.transferred_to);
  const results: TransferResult[] = [];
  let failed = false;
  /** 移し先のどれかを読めなかった・書けなかった（家族の付け替えは送り直しのときにする） */
  let toIncomplete = false;

  // 1. 各 deviceId の users.id と RevenueCat の今の状態を読む
  const targets: Array<{ deviceId: string; role: "from" | "to" }> = [
    ...from.map((deviceId) => ({ deviceId, role: "from" as const })),
    ...to.map((deviceId) => ({ deviceId, role: "to" as const })),
  ];
  const resolved: TransferTarget[] = [];
  const unregisteredTo: string[] = [];
  for (const { deviceId, role } of targets) {
    let userId: string | null;
    try {
      userId = await findUserId(supabase, deviceId);
    } catch (e) {
      console.error("[revenuecat/webhook] TRANSFER user lookup failed:", e);
      failed = true;
      if (role === "to") toIncomplete = true;
      continue;
    }
    if (!userId) {
      results.push({ deviceId, role, result: "user_not_found" });
      if (role === "to") unregisteredTo.push(deviceId);
      continue;
    }
    const lookup = await fetchRevenueCatEntitlement(deviceId, { platform });
    if (!lookup.ok) {
      failed = true;
      if (role === "to") toIncomplete = true;
      results.push({ deviceId, role, result: "revenuecat_lookup_failed" });
      continue;
    }
    resolved.push({ deviceId, role, userId, lookup });
  }
  const fromTargets = resolved.filter((t) => t.role === "from");
  const toTargets: TransferTarget[] = [];

  // 2. 移し先を書く（有料へ上げる向きだけ）
  for (const t of resolved.filter((r) => r.role === "to")) {
    const applied = await applyRevenueCatLookup(supabase, t.userId, t.deviceId, t.lookup, {
      downgrade: false,
    });
    if (applied.error) {
      console.error("[revenuecat/webhook] TRANSFER write failed:", applied.error);
      failed = true;
      toIncomplete = true;
      results.push({ deviceId: t.deviceId, role: "to", result: "db_error" });
      continue;
    }
    toTargets.push(t);
    results.push({ deviceId: t.deviceId, role: "to", result: applied.status ?? "unchanged" });
  }

  // 3. 移し元が家族のオーナーなら、家族ごと移し先へ付け替える。
  //    移し先を読めなかった・書けなかったときは、送り直しのとき（500 を返す）にまとめてする
  let familyFailed = false;
  if (!toIncomplete) {
    const moved = await moveFamilyOwnership(supabase, fromTargets, toTargets, unregisteredTo);
    results.push(...moved.results);
    if (moved.error) {
      console.error("[revenuecat/webhook] TRANSFER family owner move failed:", moved.error);
      failed = true;
      familyFailed = true;
    }
  }

  // 4. 移し元を書く（有料でなければ expired）。
  //    移し先を読めなかった・書けなかった（＝家族の付け替えをまだしていない）とき、家族の付け替えに失敗したときは、
  //    家族のメンバーを締め出さないよう移し元も書かずに送り直してもらう（送り直しで 1.〜4. をやり直す）
  if (!toIncomplete && !familyFailed) {
    for (const t of fromTargets) {
      const applied = await applyRevenueCatLookup(supabase, t.userId, t.deviceId, t.lookup, {
        downgrade: true,
      });
      if (applied.error) {
        console.error("[revenuecat/webhook] TRANSFER write failed:", applied.error);
        failed = true;
        results.push({ deviceId: t.deviceId, role: "from", result: "db_error" });
        continue;
      }
      results.push({ deviceId: t.deviceId, role: "from", result: applied.status ?? "unchanged" });
    }
  }

  console.log("[revenuecat/webhook] TRANSFER", JSON.stringify(results));
  if (failed) {
    return Response.json({ error: "transfer not fully applied", results }, { status: 500 });
  }
  return Response.json({ ok: true, type: "TRANSFER", results });
}

/**
 * TRANSFER: 移し元が家族のオーナーなら、家族ごと移し先へ付け替える（2026-10-02）。
 * 家族のメンバーはオーナー（families.owner_user_id）の行だけを見て有料かを決める（lib/subscription.ts の isFamilyPremium）。
 * 付け替えないと、移し元の行が expired になった時点で、払い続けているのに家族全員が無料扱いになる。
 * オーナー本人は移し先で有料のままだが、移し先からは古い家族を見ることも管理することもできない
 * （/api/family は family_members.user_id で家族を探す）。
 * 例: オーナーがアプリを入れ直して deviceId が変わり、新しく登録してから「購入を復元」を押した。
 *
 * 付け替えるのは次をすべて満たすときだけ:
 *   - 移し元（users.id）が families のオーナー
 *   - 移し元は RevenueCat で家族プランの有料ではない（まだ家族プランで有料なら、家族は移し元のまま）
 *   - 移し先が users に登録済みで、RevenueCat で家族プランの有料（lookup.paid.isFamily）、
 *     かつ別の家族に入っていない（オーナーでもメンバーでもない）。同じ家族のメンバーなら、オーナーに上げる
 * 付け替えるもの:
 *   - 移し先がその家族に入っていない（例: 同じ人の入れ直し）: families.owner_user_id と、
 *     family_members のオーナーの行（role='owner'）の user_id を移し先へ
 *   - 移し先が同じ家族のメンバー（例: 同じ Apple ID でサインインした家族の iPad で「購入の復元」を押した）:
 *     オーナーとメンバーの役割を入れ替える（移し先の行を role='owner'、移し元の行を role='member'）と、
 *     families.owner_user_id を移し先へ。移し元は家族に残り、家族プラン（移し先の行）で有料のまま使える。
 *     2026-10-02 まで: 移し先のメンバーの行を消して移し元のオーナーの行を移し先へ付け替えていたので、
 *     移し元は家族から外れ、4. で自分の行も expired になり、払っている人が無料扱いになっていた
 *     （逆向きに「購入の復元」を押すたびに、家族から1人ずつ外れていった）。
 * 付け替えられないとき（移し先が未登録・家族プランで有料でない・すでに別の家族がある）は console.warn で記録する
 * （サポートで上の2つを手で直す）。読み書きに失敗したら error を返す（500 で送り直してもらう。何度やっても同じ結果になる）。
 */
async function moveFamilyOwnership(
  supabase: SupabaseClient,
  fromTargets: TransferTarget[],
  toTargets: TransferTarget[],
  unregisteredTo: string[]
): Promise<{ error: string | null; results: TransferResult[] }> {
  const results: TransferResult[] = [];
  const candidates = toTargets.filter((t) => t.lookup.entitled && t.lookup.paid.isFamily);
  /** 付け替えに使った移し先（1人がオーナーになれる家族は1つ） */
  const used = new Set<string>();

  for (const src of fromTargets) {
    const { data: owned, error: ownedErr } = await supabase
      .from("families")
      .select("id")
      .eq("owner_user_id", src.userId);
    if (ownedErr) return { error: `failed to load families: ${ownedErr.message}`, results };
    if (!owned || owned.length === 0) continue;
    if (src.lookup.entitled && src.lookup.paid.isFamily) continue;

    for (const fam of owned as Array<{ id: string }>) {
      const familyId = fam.id;
      const reasons: string[] = unregisteredTo.map((d) => `${d}:not_registered`);
      for (const t of toTargets) {
        if (!candidates.includes(t)) reasons.push(`${t.deviceId}:not_family_paid`);
      }
      let movedTo: TransferTarget | null = null;
      for (const dst of candidates) {
        if (dst.userId === src.userId || used.has(dst.userId)) continue;
        const check = await checkCanTakeFamily(supabase, dst.userId, familyId);
        if (check.error) return { error: check.error, results };
        if (!check.ok) {
          reasons.push(`${dst.deviceId}:already_in_other_family`);
          continue;
        }
        const moveErr = await reassignFamilyOwner(
          supabase,
          familyId,
          src.userId,
          dst.userId,
          check.roleInFamily
        );
        if (moveErr) return { error: moveErr, results };
        movedTo = dst;
        used.add(dst.userId);
        break;
      }

      if (movedTo) {
        console.log(
          `[revenuecat/webhook] TRANSFER family owner moved: family=${familyId} from=${src.deviceId} to=${movedTo.deviceId}`
        );
        results.push({ deviceId: movedTo.deviceId, role: "family", result: `owner_moved:${familyId}` });
      } else {
        console.warn(
          `[revenuecat/webhook] TRANSFER family owner NOT moved: family=${familyId} from=${src.deviceId} (user ${src.userId}) ` +
            `reasons=${reasons.join(",") || "no_destination"}. Members lose premium when the from row expires. ` +
            `Support: set families.owner_user_id and the family_members owner row (role='owner') to the new owner's users.id.`
        );
        results.push({ deviceId: src.deviceId, role: "family", result: `owner_not_moved:${familyId}` });
      }
    }
  }
  return { error: null, results };
}

/**
 * 移し先がその家族のオーナーになれるか。別の家族のオーナー・メンバーなら false。
 * roleInFamily はその家族での今の役割（入っていなければ null。前回の付け替えが途中で止まったときは 'owner'）
 */
async function checkCanTakeFamily(
  supabase: SupabaseClient,
  userId: string,
  familyId: string
): Promise<
  | { error: string; ok?: undefined; roleInFamily?: undefined }
  | { error: null; ok: false; roleInFamily?: undefined }
  | { error: null; ok: true; roleInFamily: string | null }
> {
  const { data: memberships, error: memberErr } = await supabase
    .from("family_members")
    .select("family_id, role")
    .eq("user_id", userId);
  if (memberErr) return { error: `failed to load family_members: ${memberErr.message}` };
  const { data: ownedByDst, error: ownedErr } = await supabase
    .from("families")
    .select("id")
    .eq("owner_user_id", userId);
  if (ownedErr) return { error: `failed to load families: ${ownedErr.message}` };

  const rows = (memberships ?? []) as Array<{ family_id: string; role: string | null }>;
  const inOtherFamily =
    rows.some((m) => m.family_id !== familyId) ||
    ((ownedByDst ?? []) as Array<{ id: string }>).some((f) => f.id !== familyId);
  if (inOtherFamily) return { error: null, ok: false };
  const same = rows.find((m) => m.family_id === familyId);
  return { error: null, ok: true, roleInFamily: same ? same.role ?? "member" : null };
}

/**
 * 家族のオーナーを src から dst へ付け替える。family_members → families の順に書く。
 * 途中で止まっても、送り直しのときに続きから書き直せる:
 *   - 入れ替え（dst が同じ家族のメンバー）: src を member に下げる → dst を owner に上げる → families の順。
 *     src を下げたあと・dst を上げる前に止まったら、送り直しでは roleInFamily='member' なので入れ替えをやり直す
 *     （下げる・入れるは何度やっても同じ結果）。dst を上げたあとに止まったら roleInFamily='owner' になる
 *   - roleInFamily='owner'（前回が途中で止まった）: src に残ったオーナーの行があれば member に下げ、families だけを書き直す
 */
async function reassignFamilyOwner(
  supabase: SupabaseClient,
  familyId: string,
  srcUserId: string,
  dstUserId: string,
  dstRoleInFamily: string | null
): Promise<string | null> {
  if (dstRoleInFamily === "owner") {
    // 前回の付け替えが途中で止まった。オーナーの行が2つ残らないよう、src のオーナーの行が残っていれば下げる
    // （入れ直しの付け替えなら src の行は dst へ移したあとなので 0件）
    const { error: demoteErr } = await supabase
      .from("family_members")
      .update({ role: "member" })
      .eq("family_id", familyId)
      .eq("user_id", srcUserId)
      .eq("role", "owner");
    if (demoteErr) return `failed to demote old owner row: ${demoteErr.message}`;
  } else if (dstRoleInFamily !== null) {
    // 移し先が同じ家族のメンバー: 役割を入れ替える。移し元は家族に残し、家族プラン（移し先の行）で有料のまま使えるようにする。
    // 先に src を下げる（オーナーの行が一時的に2つになり、dst の「脱退」で家族ごと消える、を避ける）
    const { data: demoted, error: demoteErr } = await supabase
      .from("family_members")
      .update({ role: "member" })
      .eq("family_id", familyId)
      .eq("user_id", srcUserId)
      .eq("role", "owner")
      .select("id");
    if (demoteErr) return `failed to demote old owner row: ${demoteErr.message}`;
    if (!demoted || demoted.length === 0) {
      // 移し元のオーナーの行が無かった（古いデータ・前回ここまで書いて止まった）: 移し元をメンバーとして入れる
      // （すでにメンバーの行があれば UNIQUE(family_id, user_id) に当たるので、そのままでよい）
      const { error: insErr } = await supabase.from("family_members").insert({
        family_id: familyId,
        user_id: srcUserId,
        role: "member",
        share_data: true,
      });
      if (insErr && insErr.code !== "23505") return `failed to insert old owner as member: ${insErr.message}`;
    }
    const { data: promoted, error: promoteErr } = await supabase
      .from("family_members")
      .update({ role: "owner" })
      .eq("family_id", familyId)
      .eq("user_id", dstUserId)
      .select("id");
    if (promoteErr) return `failed to promote new owner row: ${promoteErr.message}`;
    if (!promoted || promoted.length === 0) {
      // 読んだあとに移し先が脱退していた: オーナーとして入れ直す
      const { error: insErr } = await supabase.from("family_members").insert({
        family_id: familyId,
        user_id: dstUserId,
        role: "owner",
        share_data: true,
      });
      if (insErr && insErr.code !== "23505") return `failed to insert owner member row: ${insErr.message}`;
    }
  } else {
    const { data: movedRows, error: moveErr } = await supabase
      .from("family_members")
      .update({ user_id: dstUserId })
      .eq("family_id", familyId)
      .eq("user_id", srcUserId)
      .eq("role", "owner")
      .select("id");
    if (moveErr) return `failed to move owner member row: ${moveErr.message}`;
    if (!movedRows || movedRows.length === 0) {
      // 移し元のオーナーの行が無かった（古いデータ）: 移し先をオーナーとして入れる
      const { error: insErr } = await supabase.from("family_members").insert({
        family_id: familyId,
        user_id: dstUserId,
        role: "owner",
        share_data: true,
      });
      if (insErr && insErr.code !== "23505") return `failed to insert owner member row: ${insErr.message}`;
    }
  }
  const { error: famErr } = await supabase
    .from("families")
    .update({ owner_user_id: dstUserId })
    .eq("id", familyId)
    .eq("owner_user_id", srcUserId);
  if (famErr) return `failed to move families.owner_user_id: ${famErr.message}`;
  return null;
}

/**
 * 聞き直せなかったときに「イベントより新しい期間の行」とみなす差。
 * 同じ期間なら、行の期限（購入直後の同期が RevenueCat の expires_date から書いたもの）と
 * イベントの expiration_at_ms は同じ時刻になる。丸めの差だけを吸収し、次の期間（最短でも数日後）とは取り違えない。
 */
const SAME_PERIOD_TOLERANCE_MS = 60 * 1000;

/**
 * CANCELLATION / EXPIRATION: 契約の終わりの知らせ。行の今の状態を見ずに書くと、
 * 遅れて届いた古い知らせが新しい期間の有料の行を上書きするので（ファイル冒頭の説明）、次の順で書く。
 *   1. 今の行（status・期限）を読む
 *   2. RevenueCat に今の状態を聞き直す
 *      - 有料: 有料のまま書き直す（自動更新を止めていれば cancelled・期限は RevenueCat の今の期限）
 *      - 有料でない: 1. で読んだ期限のままの有料扱いの行だけを expired にする
 *        （読んだあとに購入直後の同期などで書き換わった行は、古い判断で上書きしない）
 *   3. 聞き直せなかった: 行の期限がイベントの期限より後ろなら、新しい期間の行なので何も書かない。
 *      そうでなければ今までどおりイベントの status と期限を書く（1. で読んだ期限のままの行だけ）。
 *      イベントに期限が無く比べられないときは 500 を返し、RevenueCat に送り直してもらう
 */
async function handleEndOfTerm(
  supabase: SupabaseClient,
  userId: string,
  deviceId: string,
  event: RevenueCatEvent,
  status: "cancelled" | "expired"
): Promise<Response> {
  const { data: row, error: rowError } = await supabase
    .from("subscriptions")
    .select("status, current_period_end")
    .eq("user_id", userId)
    .maybeSingle();
  if (rowError) {
    console.error(`[revenuecat/webhook] ${event.type} failed to load subscription:`, rowError);
    return Response.json({ error: "db error" }, { status: 500 });
  }
  const rowPeriodEnd = (row?.current_period_end as string | null | undefined) ?? null;

  // 2. RevenueCat の今の状態で書く
  const lookup = await fetchRevenueCatEntitlement(deviceId, { platform: platformOf(event) });
  if (lookup.ok) {
    const applied = await applyRevenueCatLookup(supabase, userId, deviceId, lookup, {
      downgrade: true,
      expectedPeriodEnd: row ? rowPeriodEnd : undefined,
    });
    if (applied.error) {
      console.error(`[revenuecat/webhook] ${event.type} write failed:`, applied.error);
      return Response.json({ error: "db error" }, { status: 500 });
    }
    return Response.json({
      ok: true,
      type: event.type,
      entitled: lookup.entitled,
      status: applied.status ?? "unchanged",
    });
  }

  // 3. 聞き直せなかった: イベントの中身で書く。ただし新しい期間の行は書き換えない
  const eventEndMs =
    typeof event.expiration_at_ms === "number" && Number.isFinite(event.expiration_at_ms)
      ? event.expiration_at_ms
      : null;
  const rowEndMs = rowPeriodEnd ? Date.parse(rowPeriodEnd) : NaN;
  if (Number.isFinite(rowEndMs)) {
    if (eventEndMs === null) {
      // 古い知らせかどうか分からない。書かずに送り直してもらう（次は聞き直せるかもしれない）
      return Response.json({ error: "revenuecat lookup failed" }, { status: 500 });
    }
    if (rowEndMs > eventEndMs + SAME_PERIOD_TOLERANCE_MS) {
      console.warn(
        `[revenuecat/webhook] stale ${event.type} ignored for ${deviceId}: row period end ${rowPeriodEnd} is after event ${new Date(eventEndMs).toISOString()}`
      );
      return Response.json({ ok: true, type: event.type, ignored: "stale_event" });
    }
  }

  const writeData: Record<string, unknown> = {
    status,
    current_period_start: event.purchased_at_ms
      ? new Date(event.purchased_at_ms).toISOString()
      : null,
    current_period_end: eventEndMs !== null ? new Date(eventEndMs).toISOString() : null,
    revenuecat_app_user_id: deviceId,
    revenuecat_entitlement: event.entitlement_ids?.[0] || "premium",
    updated_at: new Date().toISOString(),
  };

  if (row) {
    // 読んだときの期限のままの行だけを書き換える
    let q = supabase.from("subscriptions").update(writeData).eq("user_id", userId);
    q = rowPeriodEnd === null ? q.is("current_period_end", null) : q.eq("current_period_end", rowPeriodEnd);
    const { data: updated, error: updateError } = await q.select("id");
    if (updateError) {
      console.error(`[revenuecat/webhook] ${event.type} update failed:`, updateError);
      return Response.json({ error: "db error" }, { status: 500 });
    }
    if (!updated || updated.length === 0) {
      // 読んだあとに行が書き換わった（購入直後の同期など）。送り直してもらい、もう一度判断する
      return Response.json({ error: "subscription changed concurrently" }, { status: 500 });
    }
  } else {
    const { error: insertError } = await supabase
      .from("subscriptions")
      .insert({ user_id: userId, ...writeData });
    if (insertError) {
      // 同時に行が作られた（UNIQUE 違反）ときも、送り直してもらってもう一度判断する
      console.error(`[revenuecat/webhook] ${event.type} insert failed:`, insertError);
      return Response.json({ error: "db error" }, { status: 500 });
    }
  }
  return Response.json({ ok: true, type: event.type, status, fallback: "event_payload" });
}

export async function POST(req: NextRequest) {
  // 認証チェック
  const authHeader = req.headers.get("authorization") || "";
  const secret = process.env.REVENUECAT_WEBHOOK_SECRET;
  if (!secret || authHeader !== `Bearer ${secret}`) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const event: RevenueCatEvent = body.event || body;
    if (!event?.type) {
      return Response.json({ error: "invalid event" }, { status: 400 });
    }

    const supabase = getSupabase();

    // TRANSFER は app_user_id が入らないことがあるので、app_user_id の確認より前で分ける
    if (event.type === "TRANSFER") {
      return await handleTransfer(supabase, event);
    }

    if (!event.app_user_id) {
      return Response.json({ error: "invalid event" }, { status: 400 });
    }
    const deviceId = event.app_user_id;

    // deviceId からユーザーを特定
    const userId = await findUserId(supabase, deviceId);
    if (!userId) {
      console.warn(`[revenuecat/webhook] user not found for ${deviceId}`);
      return Response.json({ ok: true, ignored: true });
    }

    // プラン切替: イベントの商品ID（切替前）では書かず、RevenueCat に今の状態を聞き直して書く。
    // 切替がすぐ効いた（上位プランへの変更など）ならその商品で、次の更新から効くなら今の商品のまま書かれる。
    // 有料でないと返ってきたときは何もしない（期限切れは EXPIRATION で届く）
    if (event.type === "PRODUCT_CHANGE") {
      const lookup = await fetchRevenueCatEntitlement(deviceId, { platform: platformOf(event) });
      if (!lookup.ok) {
        // 送り直してもらう（何も書いていない）
        return Response.json({ error: "revenuecat lookup failed" }, { status: 500 });
      }
      const applied = await applyRevenueCatLookup(supabase, userId, deviceId, lookup, {
        downgrade: false,
      });
      if (applied.error) {
        console.error("[revenuecat/webhook] PRODUCT_CHANGE write failed:", applied.error);
        return Response.json({ error: "db error" }, { status: 500 });
      }
      return Response.json({ ok: true, type: "PRODUCT_CHANGE", status: applied.status ?? "unchanged" });
    }

    // 契約の終わりの知らせ: 行の今の状態と RevenueCat の今の状態を見てから書く（遅れて届いた古い知らせで、
    // 買い直した人の有料の行を上書きしないため。handleEndOfTerm の説明を参照）
    if (event.type === "CANCELLATION" || event.type === "EXPIRATION") {
      return await handleEndOfTerm(
        supabase,
        userId,
        deviceId,
        event,
        event.type === "CANCELLATION" ? "cancelled" : "expired"
      );
    }

    // プラン判定（商品ID → プラン。購入直後の同期 /api/subscription/sync と共通: lib/revenuecat.ts）
    const { plan, isFamily } = planFromProductId(event.product_id || "");

    // ステータス決定
    let status: DbStatus = "free";
    // その商品が今の契約になったイベントか（plan / is_family を書き直してよいか）
    let isEffectiveProduct = false;
    switch (event.type) {
      case "INITIAL_PURCHASE":
      case "RENEWAL":
      case "UNCANCELLATION":
        // 家族プランも課金周期ベースで active_monthly / active_yearly に正規化
        // 家族プラン購入かどうかは is_family カラムで別管理
        status = activeStatusFor(plan);
        // ストアの無料体験中（お試しで始まった INITIAL_PURCHASE など）は trial にする。
        // 以前は active として保存していたため、料金プラン画面に「無料体験中」も解約の締め切りも出ず、
        // 「次回更新: （無料体験が終わって課金される日）」だけが出ていた
        if (event.period_type === "TRIAL") {
          status = "trial";
        }
        isEffectiveProduct = true;
        break;
      case "BILLING_ISSUE":
        // 課金エラーは状態を維持（Apple側でリトライされる）
        return Response.json({ ok: true, note: "billing_issue logged" });
      default:
        // SUBSCRIBER_ALIAS など、その他のイベントは無視
        return Response.json({ ok: true, ignored: event.type });
    }

    const periodEnd = event.expiration_at_ms
      ? new Date(event.expiration_at_ms).toISOString()
      : null;
    const periodStart = event.purchased_at_ms
      ? new Date(event.purchased_at_ms).toISOString()
      : null;

    // upsert
    const upsertData: Record<string, unknown> = {
      user_id: userId,
      status,
      current_period_start: periodStart,
      current_period_end: periodEnd,
      revenuecat_app_user_id: deviceId,
      revenuecat_entitlement: event.entitlement_ids?.[0] || "premium",
      updated_at: new Date().toISOString(),
    };
    // plan と is_family は、その商品で課金が始まった・続いた・戻ったイベント（INITIAL_PURCHASE / RENEWAL /
    // UNCANCELLATION）のたびに、そのときの商品から書き直す。プランの切替は次の RENEWAL から効くので、
    // RENEWAL で書き直さないと、家族→単身に下げた人の is_family が true のまま残る（以前の不具合）。
    // 商品IDが分からないときは、今の値を消さない。
    // CANCELLATION / EXPIRATION は上の handleEndOfTerm で書く（ここには来ない）。
    if (isEffectiveProduct && plan) {
      upsertData.plan = plan;
      upsertData.is_family = isFamily;
    }
    // 無料体験中は、終了日時を trial_ends_at にも入れる（画面の「◯月◯日 ◯時までに解約すれば…」はこの値から出す）
    if (status === "trial") {
      upsertData.trial_ends_at = periodEnd;
      upsertData.trial_started_at = periodStart;
    }

    const { error: upsertError } = await supabase
      .from("subscriptions")
      .upsert(upsertData, { onConflict: "user_id" });

    if (upsertError) {
      console.error("[revenuecat/webhook] upsert failed:", upsertError);
      return Response.json({ error: "db error" }, { status: 500 });
    }

    return Response.json({ ok: true, status, plan });
  } catch (e) {
    console.error("[revenuecat/webhook] error:", e);
    return Response.json({ error: "server error" }, { status: 500 });
  }
}
