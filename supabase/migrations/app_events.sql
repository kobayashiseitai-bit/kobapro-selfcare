-- 効果測定用の行動ログ（2026-10-01 本番に適用済み）
-- アプリのサーバー（/api/event・サービスロール）だけが書き込む。
-- /api/checkin も event='checkin_ai_free'（新規・未課金の方へ AI の一言を作った記録。1日の上限を数える）を書く（2026-10-02）。
-- device_id は users とつながっていない（外部キーなし）。アカウントの削除（/api/account の DELETE）は device_id が合う行を消すが、
-- 今日（日本時間）の checkin_ai_free だけは device_id を使い捨ての番号に置きかえて残す（上限の数が減らない。2026-10-02）。
-- RLS は有効・ポリシーなし＝anon からは読み書きできない。
create table if not exists public.app_events (
  id bigserial primary key,
  device_id text not null,
  event text not null,
  props jsonb,
  created_at timestamptz not null default now()
);
alter table public.app_events enable row level security;
create index if not exists app_events_event_created on public.app_events (event, created_at);
