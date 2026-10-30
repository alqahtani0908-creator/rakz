-- Rakz platform — Supabase schema.
-- Run once in: Supabase Dashboard → SQL Editor → New query → paste → Run.

-- One table holds every record. "path" mirrors the app's document paths
-- (e.g. cases/abc, cases/abc/log/xyz); "collection" is the parent path.
create table if not exists public.documents (
  path        text primary key,
  collection  text not null,
  id          text not null,
  data        jsonb not null default '{}'::jsonb,
  updated_at  timestamptz not null default now(),
  updated_by  uuid default auth.uid()
);
create index if not exists documents_collection_idx on public.documents (collection);

-- Only signed-in members (invited from the dashboard) can read or write.
alter table public.documents enable row level security;
drop policy if exists "members read"   on public.documents;
drop policy if exists "members insert" on public.documents;
drop policy if exists "members update" on public.documents;
drop policy if exists "members delete" on public.documents;
create policy "members read"   on public.documents for select to authenticated using (true);
create policy "members insert" on public.documents for insert to authenticated with check (true);
create policy "members update" on public.documents for update to authenticated using (true) with check (true);
create policy "members delete" on public.documents for delete to authenticated using (true);

-- Live updates across the team.
alter table public.documents replica identity full;
do $$ begin
  alter publication supabase_realtime add table public.documents;
exception when duplicate_object then null; end $$;

-- Private bucket for case attachments (PDF, images, Word). 20 MB per file.
insert into storage.buckets (id, name, public, file_size_limit)
values ('files', 'files', false, 20971520)
on conflict (id) do update set public = false, file_size_limit = 20971520;

drop policy if exists "members read files"   on storage.objects;
drop policy if exists "members upload files" on storage.objects;
drop policy if exists "members delete files" on storage.objects;
create policy "members read files"   on storage.objects for select to authenticated using (bucket_id = 'files');
create policy "members upload files" on storage.objects for insert to authenticated with check (bucket_id = 'files');
create policy "members delete files" on storage.objects for delete to authenticated using (bucket_id = 'files');

-- Members only: the database opens to an email that is on an active lawyer record (فريق العمل).
create or replace function public.is_member() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.documents d where d.collection = 'lawyers'
    and lower(d.data->>'email') = lower(coalesce(auth.jwt()->>'email', ''))
    and coalesce((d.data->>'active')::boolean, true));
$$;
revoke all on function public.is_member() from public, anon;
grant execute on function public.is_member() to authenticated;
drop policy if exists "members read"   on public.documents;
drop policy if exists "members insert" on public.documents;
drop policy if exists "members update" on public.documents;
drop policy if exists "members delete" on public.documents;
create policy "members read"   on public.documents for select to authenticated using (public.is_member());
create policy "members insert" on public.documents for insert to authenticated with check (public.is_member());
create policy "members update" on public.documents for update to authenticated using (public.is_member()) with check (public.is_member());
create policy "members delete" on public.documents for delete to authenticated using (public.is_member());
drop policy if exists "members read files"   on storage.objects;
drop policy if exists "members upload files" on storage.objects;
drop policy if exists "members delete files" on storage.objects;
create policy "members read files"   on storage.objects for select to authenticated using (bucket_id = 'files' and public.is_member());
create policy "members upload files" on storage.objects for insert to authenticated with check (bucket_id = 'files' and public.is_member());
create policy "members delete files" on storage.objects for delete to authenticated using (bucket_id = 'files' and public.is_member());
-- Bootstrap: the first manager's lawyer record must exist before anyone else can sign in.
-- Insert it once from the SQL editor if the team list is empty, e.g.:
-- insert into public.documents(path, collection, id, data) values ('lawyers/owner','lawyers','owner','{"name":"المدير","role":"manager","email":"you@example.com","active":true}');

-- Governance (2026-10-13): identity = signed-in email on an active lawyer record; only role «manager»
-- assigns work, handles finance (finance rows, fees, fee proposals, invoices, contracts), manages the
-- team and settings. Applied as migration "governance_roles"; see that migration for the full SQL
-- (functions my_lawyer, is_manager, my_lawyer_id, no_manager_yet, manager_only, trigger guard_documents).

-- ---------- 2026-10-15: law library hierarchy + manager-only finance files ----------
alter table public.law_sources add column if not exists parent text, add column if not exists kind text not null default 'نظام', add column if not exists ord integer, add column if not exists status text;

drop function if exists public.search_laws(text, integer, text);
create function public.search_laws(p_q text, p_k integer default 8, p_law text default null)
returns table(law_slug text, law_name text, article text, num integer, body text, rank real, kind text, parent_name text, status text)
language sql stable set search_path to 'public' as $$
  with query as (
    select to_tsquery('arabic', array_to_string(tsvector_to_array(to_tsvector('arabic', coalesce(p_q, ''))), ' | ')) as tq
  )
  select a.law_slug, a.law, a.article, a.num, a.body, ts_rank_cd(a.tsv, query.tq) as rank, s.kind, p.name, s.status
  from public.law_articles a cross join query
  left join public.law_sources s on s.slug = a.law_slug
  left join public.law_sources p on p.slug = s.parent
  where numnode(query.tq) > 0 and a.tsv @@ query.tq
    and (p_law is null or a.law_slug = p_law or s.parent = p_law)
  order by rank desc
  limit least(greatest(p_k, 1), 30);
$$;
revoke all on function public.search_laws(text, integer, text) from public, anon;
grant execute on function public.search_laws(text, integer, text) to authenticated;

-- Payment receipts live under finance/ in the files bucket: managers only.
drop policy if exists "members read files" on storage.objects;
drop policy if exists "members upload files" on storage.objects;
drop policy if exists "members delete files" on storage.objects;
create policy "members read files" on storage.objects for select to authenticated
  using (bucket_id = 'files' and public.is_member() and (name not like 'finance/%' or public.is_manager()));
create policy "members upload files" on storage.objects for insert to authenticated
  with check (bucket_id = 'files' and public.is_member() and (name not like 'finance/%' or public.is_manager()));
create policy "members delete files" on storage.objects for delete to authenticated
  using (bucket_id = 'files' and public.is_member() and (name not like 'finance/%' or public.is_manager()));

-- ---------- 2026-10-23: issued tax invoices and credit notes are immutable ----------
create or replace function public.guard_tax()
returns trigger language plpgsql security definer set search_path to 'public' as $$
begin
  if tg_op = 'DELETE' then
    if old.collection = 'finance' and old.data ? 'tax' and auth.uid() is not null then raise exception 'tax_invoice_immutable'; end if;
    return old;
  end if;
  if new.collection <> 'finance' or tg_op <> 'UPDATE' or not (old.data ? 'tax') then return new; end if;
  if (new.data->'tax') is distinct from (old.data->'tax') or (new.data->'amount') is distinct from (old.data->'amount')
     or (new.data->'total') is distinct from (old.data->'total') or (new.data->'vat') is distinct from (old.data->'vat')
     or (new.data->'vatAmount') is distinct from (old.data->'vatAmount') or (new.data->'clientId') is distinct from (old.data->'clientId')
     or (new.data->'desc') is distinct from (old.data->'desc') or coalesce(new.data->>'status','') = 'void' then
    raise exception 'tax_invoice_immutable';
  end if;
  return new;
end; $$;
drop trigger if exists guard_tax on public.documents;
create trigger guard_tax before update or delete on public.documents for each row execute function public.guard_tax();
revoke all on function public.guard_tax() from public, anon, authenticated;

-- ---------- 2026-10-30: professional / administrative split ----------
-- Financial requests (finreq) are filed by any member; only a manager approves or rejects them.
create or replace function public.guard_finreq()
returns trigger language plpgsql security definer set search_path to 'public' as $$
begin
  if tg_op = 'DELETE' then
    if old.collection = 'finreq' and auth.uid() is not null and coalesce(old.data->>'status','pending') <> 'pending' and not public.is_manager() then raise exception 'requires_manager'; end if;
    return old;
  end if;
  if new.collection <> 'finreq' or auth.uid() is null or public.is_manager() then return new; end if;
  if tg_op = 'INSERT' and coalesce(new.data->>'status','pending') <> 'pending' then raise exception 'requires_manager'; end if;
  if tg_op = 'UPDATE' and (coalesce(old.data->>'status','pending') <> 'pending' or coalesce(new.data->>'status','pending') <> 'pending') then raise exception 'requires_manager'; end if;
  return new;
end; $$;
drop trigger if exists guard_finreq on public.documents;
create trigger guard_finreq before insert or update or delete on public.documents for each row execute function public.guard_finreq();
revoke all on function public.guard_finreq() from public, anon, authenticated;
-- Closing or reopening a case's financial file is a manager decision.
create or replace function public.guard_finclose()
returns trigger language plpgsql security definer set search_path to 'public' as $$
begin
  if new.collection <> 'cases' or auth.uid() is null or public.is_manager() then return new; end if;
  if (tg_op = 'INSERT' and new.data ? 'finClosed') or (tg_op = 'UPDATE' and (new.data->'finClosed') is distinct from (old.data->'finClosed')) then raise exception 'requires_manager'; end if;
  return new;
end; $$;
drop trigger if exists guard_finclose on public.documents;
create trigger guard_finclose before insert or update on public.documents for each row execute function public.guard_finclose();
revoke all on function public.guard_finclose() from public, anon, authenticated;

-- ============ Phone notifications (Web Push) ============
-- Devices: public.push_subs (saved through push_save()). Events: trigger push_on_change() → public.push_outbox → pg_net →
-- Edge Function «push» (JWT verification on; the trigger and cron send the public anon key; needs the secret VAPID_PRIVATE_KEY). Morning digest: pg_cron 04:00 UTC.
create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron;
create table if not exists public.push_subs (endpoint text primary key, email text not null, p256dh text not null, auth text not null, ua text, created_at timestamptz not null default now(), last_ok timestamptz);
alter table public.push_subs enable row level security;
create policy push_subs_own_select on public.push_subs for select to authenticated using (lower(email) = lower(coalesce(auth.jwt()->>'email', '')));
create policy push_subs_own_delete on public.push_subs for delete to authenticated using (lower(email) = lower(coalesce(auth.jwt()->>'email', '')));
create or replace function public.push_save(p_endpoint text, p_p256dh text, p_auth text, p_ua text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_member() then raise exception 'forbidden'; end if;
  insert into public.push_subs (endpoint, email, p256dh, auth, ua) values (p_endpoint, lower(auth.jwt()->>'email'), p_p256dh, p_auth, left(p_ua, 300))
  on conflict (endpoint) do update set email = excluded.email, p256dh = excluded.p256dh, auth = excluded.auth, ua = excluded.ua, created_at = now();
end $$;
revoke all on function public.push_save(text, text, text, text) from public, anon;
grant execute on function public.push_save(text, text, text, text) to authenticated;
create table if not exists public.push_outbox (id bigint generated always as identity primary key, op text not null, collection text not null, doc_id text not null, old_data jsonb, new_data jsonb, created_at timestamptz not null default now());
alter table public.push_outbox enable row level security;
create table if not exists public.push_runs (day date primary key, at timestamptz not null default now());
alter table public.push_runs enable row level security;
create or replace function public.push_on_change() returns trigger
language plpgsql security definer set search_path = public, extensions as $$
declare relevant boolean := false;
begin
  if new.collection = 'cases' then
    relevant := (tg_op = 'INSERT' and jsonb_typeof(new.data->'assignment') = 'object') or (tg_op = 'UPDATE' and (old.data->'assignment') is distinct from (new.data->'assignment'));
  elsif new.collection = 'tasks' then relevant := tg_op = 'INSERT' or (old.data->>'assignee') is distinct from (new.data->>'assignee');
  elsif new.collection in ('finreq', 'fees') then relevant := tg_op = 'INSERT' or (old.data->>'status') is distinct from (new.data->>'status');
  end if;
  if not relevant or not exists (select 1 from public.push_subs) then return new; end if;
  insert into public.push_outbox (op, collection, doc_id, old_data, new_data) values (tg_op, new.collection, new.id, case when tg_op = 'UPDATE' then old.data end, new.data);
  perform net.http_post(url := 'https://lsjtgzifniawkvbvytoi.supabase.co/functions/v1/push', body := '{"mode":"outbox"}'::jsonb, headers := '{"Content-Type":"application/json","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxzanRnemlmbmlhd2t2YnZ5dG9pIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE2NDI0MzIsImV4cCI6MjEwNzIxODQzMn0.HpvC81_nw6X7YyB2AWu3YhMo_rTC8q_vtwbkg4EeGiQ"}'::jsonb);
  return new;
exception when others then return new;
end $$;
drop trigger if exists push_notify on public.documents;
create trigger push_notify after insert or update on public.documents for each row when (new.collection in ('cases', 'tasks', 'finreq', 'fees')) execute function public.push_on_change();
select cron.schedule('rakz-push-daily', '0 4 * * *', $$select net.http_post(url := 'https://lsjtgzifniawkvbvytoi.supabase.co/functions/v1/push', body := '{"mode":"daily"}'::jsonb, headers := '{"Content-Type":"application/json","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxzanRnemlmbmlhd2t2YnZ5dG9pIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE2NDI0MzIsImV4cCI6MjEwNzIxODQzMn0.HpvC81_nw6X7YyB2AWu3YhMo_rTC8q_vtwbkg4EeGiQ"}'::jsonb)$$);

-- ============ (see also) Archive & renewal ============
-- ============ Archive & renewal ============
-- archive_create() always stores a full copy of every record (documents) first, then — only if asked — clears
-- the chosen groups so the platform starts a new period. archive_restore() puts an archive's records back
-- (after archiving the current state). Team members and settings are never cleared. Manager only.
create table if not exists public.archives (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  note text,
  cleared text[] not null default '{}',
  counts jsonb not null default '{}',
  snapshot jsonb not null,
  created_at timestamptz not null default now(),
  created_by text
);
alter table public.archives enable row level security;
drop policy if exists archives_mgr_select on public.archives;
create policy archives_mgr_select on public.archives for select to authenticated using (public.is_manager());

-- which records belong to a group
create or replace function public.archive_in_group(g text, coll text, d jsonb) returns boolean
language sql immutable as $$
  select case g
    when 'finance' then coll in ('finance', 'journal', 'finreq', 'fees') or (coll = 'docs' and d->>'kind' = 'invoice')
    when 'work' then coll in ('cases', 'tasks', 'consults') or coll like 'cases/%' or coll like 'consults/%' or (coll = 'docs' and coalesce(d->>'kind', '') <> 'invoice')
    when 'clients' then coll = 'clients'
    else false end;
$$;

create or replace function public.archive_create(p_title text, p_note text default null, p_clear text[] default '{}')
returns uuid language plpgsql security definer set search_path = public as $$
declare aid uuid; g text; snap jsonb; cnt jsonb;
begin
  if not public.is_manager() then raise exception 'requires_manager'; end if;
  if exists (select 1 from unnest(coalesce(p_clear, '{}')) x where x not in ('finance', 'work', 'clients')) then raise exception 'bad_group'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('path', path, 'collection', collection, 'id', id, 'data', data, 'updated_at', updated_at)), '[]'::jsonb) into snap from public.documents;
  select coalesce(jsonb_object_agg(k, n), '{}'::jsonb) into cnt from (select split_part(collection, '/', 1) || case when collection like '%/%' then '/' || split_part(collection, '/', 3) else '' end k, count(*) n from public.documents group by 1) s;
  insert into public.archives (title, note, cleared, counts, snapshot, created_by)
  values (coalesce(nullif(trim(p_title), ''), 'أرشيف ' || to_char(now() at time zone 'Asia/Riyadh', 'YYYY-MM-DD')), p_note, coalesce(p_clear, '{}'), cnt, snap, auth.jwt()->>'email')
  returning id into aid;
  if coalesce(array_length(p_clear, 1), 0) > 0 then
    perform set_config('rakz.archiving', 'on', true); -- lets this transaction remove posted entries (they are in the archive)
    foreach g in array p_clear loop
      delete from public.documents d where public.archive_in_group(g, d.collection, d.data);
    end loop;
    if 'finance' = any(p_clear) and not ('work' = any(p_clear)) then
      update public.documents set data = data - 'fee' - 'finClosed', updated_at = now()
      where collection in ('cases', 'consults') and (data ? 'fee' or data ? 'finClosed');
    end if;
  end if;
  return aid;
end $$;

create or replace function public.archive_restore(p_id uuid)
returns int language plpgsql security definer set search_path = public as $$
declare a public.archives; n int;
begin
  if not public.is_manager() then raise exception 'requires_manager'; end if;
  select * into a from public.archives where id = p_id; if not found then raise exception 'not_found'; end if;
  perform public.archive_create('قبل استعادة «' || a.title || '»', 'نسخة تلقائية من الوضع السابق للاستعادة', '{}');
  perform set_config('rakz.archiving', 'on', true);
  insert into public.documents (path, collection, id, data, updated_at)
  select r->>'path', r->>'collection', r->>'id', r->'data', now() from jsonb_array_elements(a.snapshot) r
  where split_part(r->>'collection', '/', 1) not in ('lawyers', 'settings')
  on conflict (path) do update set data = excluded.data, updated_at = now();
  get diagnostics n = row_count;
  return n;
end $$;

create or replace function public.archive_snapshot(p_id uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select case when public.is_manager() then (select snapshot from public.archives where id = p_id) end;
$$;

revoke all on function public.archive_create(text, text, text[]) from public, anon;
revoke all on function public.archive_restore(uuid) from public, anon;
revoke all on function public.archive_snapshot(uuid) from public, anon;
grant execute on function public.archive_create(text, text, text[]) to authenticated;
grant execute on function public.archive_restore(uuid) to authenticated;
grant execute on function public.archive_snapshot(uuid) to authenticated;

-- posted entries and tax invoices stay immutable, except inside an archive transaction (they are kept in the archive)
create or replace function public.guard_journal() returns trigger
language plpgsql security definer set search_path = public as $$
declare dr numeric; cr numeric;
begin
  if current_setting('rakz.archiving', true) = 'on' then return coalesce(new, old); end if;
  if tg_op = 'DELETE' then
    if old.collection = 'journal' and auth.uid() is not null then raise exception 'journal_immutable'; end if;
    return old;
  end if;
  if new.collection <> 'journal' then return new; end if;
  if tg_op = 'UPDATE' and auth.uid() is not null then raise exception 'journal_immutable'; end if;
  select coalesce(sum((l->>'dr')::numeric), 0), coalesce(sum((l->>'cr')::numeric), 0)
    into dr, cr from jsonb_array_elements(coalesce(new.data->'lines', '[]'::jsonb)) l;
  if dr <= 0 or round(dr, 2) <> round(cr, 2) then raise exception 'journal_unbalanced'; end if;
  return new;
end $$;

create or replace function public.guard_tax() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if current_setting('rakz.archiving', true) = 'on' then return coalesce(new, old); end if;
  if tg_op = 'DELETE' then
    if old.collection = 'finance' and old.data ? 'tax' and auth.uid() is not null then raise exception 'tax_invoice_immutable'; end if;
    return old;
  end if;
  if new.collection <> 'finance' or tg_op <> 'UPDATE' or not (old.data ? 'tax') then return new; end if;
  if (new.data->'tax') is distinct from (old.data->'tax')
     or (new.data->'amount') is distinct from (old.data->'amount')
     or (new.data->'total') is distinct from (old.data->'total')
     or (new.data->'vat') is distinct from (old.data->'vat')
     or (new.data->'vatAmount') is distinct from (old.data->'vatAmount')
     or (new.data->'clientId') is distinct from (old.data->'clientId')
     or (new.data->'desc') is distinct from (old.data->'desc')
     or coalesce(new.data->>'status','') = 'void' then
    raise exception 'tax_invoice_immutable';
  end if;
  return new;
end $$;
