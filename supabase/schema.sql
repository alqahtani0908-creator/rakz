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
