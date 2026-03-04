-- Run in Supabase SQL Editor (optional, but recommended).
-- Creates private buckets + policies for user document uploads and avatars.

-- Buckets
insert into storage.buckets (id, name, public)
values
  ('user-documents', 'user-documents', false),
  ('avatars', 'avatars', false)
on conflict (id) do nothing;

-- Helper: only allow access to own folder, or admins
create or replace function public.storage_is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_admin();
$$;

-- DOCUMENTS bucket policies
drop policy if exists "docs_read_own_or_admin" on storage.objects;
create policy "docs_read_own_or_admin"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'user-documents'
  and (
    (storage.foldername(name))[1] = auth.uid()::text
    or public.storage_is_admin()
  )
);

drop policy if exists "docs_upload_own" on storage.objects;
create policy "docs_upload_own"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'user-documents'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "docs_update_own" on storage.objects;
create policy "docs_update_own"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'user-documents'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'user-documents'
  and (storage.foldername(name))[1] = auth.uid()::text
);

-- AVATARS bucket policies
drop policy if exists "avatars_read_own_or_admin" on storage.objects;
create policy "avatars_read_own_or_admin"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'avatars'
  and (
    (storage.foldername(name))[1] = auth.uid()::text
    or public.storage_is_admin()
  )
);

drop policy if exists "avatars_upload_own" on storage.objects;
create policy "avatars_upload_own"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "avatars_update_own" on storage.objects;
create policy "avatars_update_own"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);

