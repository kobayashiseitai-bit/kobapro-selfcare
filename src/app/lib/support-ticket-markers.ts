/**
 * アカウントの削除のあとに残すお問い合わせ（support_tickets）の目印（2026-10-02）。
 *
 * api/account の DELETE は、対応が終わっていないお問い合わせ（pending・in_progress）を消さずに残し、
 * 件名の頭に ACCOUNT_DELETED_TICKET_PREFIX を付けて user_id を外す。
 * /delete-account とプライバシーポリシーの 8. で「対応が終わってから削除します」とお約束しているので、
 * 管理画面（/admin/support）でこの目印の行を「解決済」（またはスパム）にすると、api/admin/support の PATCH がその行を消す。
 *
 * RevenueCat の顧客記録を消せなかったときの「やること」（REVENUECAT_TODO_SUBJECT）も、アカウント削除の続きなので、
 * 「解決済」にしたら同じように消す（削除した方の端末IDが書いてあるため）。
 *
 * サーバーとブラウザ（管理画面）の両方から読むので、ほかのモジュールを import しないこと。
 */

/** アカウントの削除で残したお問い合わせの、件名の頭に付ける目印 */
export const ACCOUNT_DELETED_TICKET_PREFIX = "【アカウント削除済み・対応後に削除】";

/** RevenueCat の顧客記録をその場で消せなかったときに残す「やること」の件名（api/account の ensureRevenueCatTodo） */
export const REVENUECAT_TODO_SUBJECT = "【自動】RevenueCat の顧客記録の削除（アカウント削除の続き）";

/** 「やること」の行のメールアドレス欄。フォームからは「@」の無いメールアドレスを送れないので、目印にもなる */
export const REVENUECAT_TODO_EMAIL = "-";

/** この状態にしたら「対応が終わった」とみなす（supabase/migrations/support_tickets.sql の status） */
export const SUPPORT_TICKET_FINISHED_STATUSES = ["resolved", "spam"] as const;

/** 件名の頭に目印を付ける（付いていれば、そのまま返す） */
export function markAccountDeletedSubject(subject: string | null): string {
  const s = subject ?? "";
  return s.startsWith(ACCOUNT_DELETED_TICKET_PREFIX) ? s : `${ACCOUNT_DELETED_TICKET_PREFIX}${s}`;
}

/**
 * お問い合わせフォームから届いた件名から、目印を取り除く（目印を自分で書いて送られても、
 * アカウントを削除した方のお問い合わせと取り違えないように。api/support の POST）
 */
export function stripAccountDeletedMarker(subject: string): string {
  let s = subject;
  while (s.startsWith(ACCOUNT_DELETED_TICKET_PREFIX)) {
    s = s.slice(ACCOUNT_DELETED_TICKET_PREFIX.length).trim();
  }
  return s;
}

/**
 * アカウントの削除で残した行か（解決済にしたら消す行か）。
 * どちらも user_id が外れている（null）ことも確かめる。
 */
export function isAccountDeletionTicket(ticket: {
  subject: string | null;
  email?: string | null;
  user_id: string | null;
}): boolean {
  if (ticket.user_id !== null) return false;
  const subject = ticket.subject ?? "";
  if (subject.startsWith(ACCOUNT_DELETED_TICKET_PREFIX)) return true;
  return subject === REVENUECAT_TODO_SUBJECT && ticket.email === REVENUECAT_TODO_EMAIL;
}

/** status が「対応が終わった」ものか */
export function isFinishedTicketStatus(status: unknown): boolean {
  return (SUPPORT_TICKET_FINISHED_STATUSES as readonly unknown[]).includes(status);
}
