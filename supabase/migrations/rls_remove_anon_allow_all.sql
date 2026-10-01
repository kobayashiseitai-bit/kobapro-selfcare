-- anon キーで個人データを読み書きできた穴をふさぐ（2026-10-01 本番に適用済み）
--
-- 状態: RLS 自体は public の全テーブルで有効だったが、次の4テーブルにだけ
-- 「Allow all access to …」（FOR ALL TO anon USING (true) WITH CHECK (true)）が付いていた。
-- そのため anon キーを持つ人は全ユーザーの行を読む・書く・消すことができた。
--   users（名前・年齢・身長体重・痛み・device_id など） / posture_records / chat_logs / symptom_selections
--
-- 方針: public の全テーブルで RLS 有効・anon / authenticated 向けのポリシーは置かない。
-- アプリのサーバー（API Route）はサービスロールで接続しており RLS を通らないので、
-- ポリシーを消してもアプリの動作は変わらない（lib/supabase-server.ts）。
-- 画面（ブラウザ・iOS・Android）は Supabase を直接触らない。

begin;

drop policy if exists "Allow all access to users" on public.users;
drop policy if exists "Allow all access to posture_records" on public.posture_records;
drop policy if exists "Allow all access to chat_logs" on public.chat_logs;
drop policy if exists "Allow all access to symptom_selections" on public.symptom_selections;

-- 全テーブルで RLS を有効にする（すでに有効なものは何も変わらない）。
-- 今後テーブルを足したときもこの移行を流し直せば揃う。
do $$
declare
  t record;
begin
  for t in
    select c.relname
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('r', 'p') and not c.relrowsecurity
  loop
    execute format('alter table public.%I enable row level security', t.relname);
  end loop;
end $$;

-- 確認: anon / authenticated / public 向けのポリシーが public に残っていたら失敗させる
do $$
declare
  leftover text;
begin
  select string_agg(tablename || '.' || policyname, ', ')
    into leftover
  from pg_policies
  where schemaname = 'public'
    and roles && array['anon', 'authenticated', 'public']::name[];
  if leftover is not null then
    raise exception 'anon などに開いたポリシーが残っています: %', leftover;
  end if;
end $$;

commit;
