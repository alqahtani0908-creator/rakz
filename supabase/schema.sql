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
