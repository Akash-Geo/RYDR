-- Run this in Supabase SQL Editor.
-- Auth (email/password) is handled by Supabase Auth (auth.users).
-- This schema adds an app-side profile table matching your SignUp UI fields.

-- 1) Role type
do $$
begin
  if not exists (select 1 from pg_type where typname = 'user_role') then
    create type public.user_role as enum ('passenger', 'driver', 'admin');
  end if;
end $$;

-- 2) Profiles table (1 row per auth user)
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,

  role public.user_role not null default 'passenger',

  -- Common fields (from your UI)
  full_name text,
  email text unique, -- copied from auth.users.email at signup time
  phone text,

  -- Admin-only (from your UI)
  admin_id text,

  -- Passenger-only (from your UI)
  aadhaar_number text,
  aadhaar_document_path text,

  -- Driver-only (from your UI)
  license_number text,
  license_issue_date date,
  license_expiry_date date,
  license_front_document_path text,
  license_back_document_path text,

  -- Verification workflow (optional but useful)
  verification_status text not null default 'pending'
    check (verification_status in ('pending', 'verified', 'rejected')),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- Basic sanity constraints
  constraint aadhaar_len check (aadhaar_number is null or length(aadhaar_number) = 12),
  constraint admin_id_required check (role <> 'admin' or admin_id is not null),
  constraint license_required check (
    role <> 'driver'
    or (license_number is not null and license_issue_date is not null and license_expiry_date is not null)
  )
);

-- Helpful indexes
create index if not exists profiles_role_idx on public.profiles (role);
create unique index if not exists profiles_admin_id_unique
  on public.profiles (admin_id)
  where admin_id is not null;

-- 3) updated_at trigger
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
before update on public.profiles
for each row
execute function public.set_updated_at();

-- 4) Create a profile automatically when a new auth user signs up
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  meta jsonb;
  meta_role text;
begin
  meta := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  meta_role := coalesce(meta->>'role', 'passenger');

  insert into public.profiles (
    id,
    role,
    full_name,
    email,
    phone,
    admin_id,
    aadhaar_number,
    license_number,
    license_issue_date,
    license_expiry_date,
    verification_status
  )
  values (
    new.id,
    meta_role::public.user_role,
    nullif(meta->>'full_name', ''),
    new.email,
    nullif(meta->>'phone', ''),
    nullif(meta->>'admin_id', ''),
    nullif(meta->>'aadhaar_number', ''),
    nullif(meta->>'license_number', ''),
    nullif(meta->>'license_issue_date', '')::date,
    nullif(meta->>'license_expiry_date', '')::date,
    case
      when meta_role = 'admin' then 'verified'
      else 'pending'
    end
  )
  on conflict (id) do update set
    role = excluded.role,
    full_name = coalesce(excluded.full_name, public.profiles.full_name),
    email = excluded.email,
    phone = coalesce(excluded.phone, public.profiles.phone),
    admin_id = coalesce(excluded.admin_id, public.profiles.admin_id),
    aadhaar_number = coalesce(excluded.aadhaar_number, public.profiles.aadhaar_number),
    license_number = coalesce(excluded.license_number, public.profiles.license_number),
    license_issue_date = coalesce(excluded.license_issue_date, public.profiles.license_issue_date),
    license_expiry_date = coalesce(excluded.license_expiry_date, public.profiles.license_expiry_date);

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row
execute function public.handle_new_user();

-- 5) Row Level Security
alter table public.profiles enable row level security;

-- Users can read their own profile
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
on public.profiles
for select
to authenticated
using (id = auth.uid());

-- Users can update their own profile
drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
on public.profiles
for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

-- (Optional) allow users to insert their own profile (not required if using the trigger)
drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
on public.profiles
for insert
to authenticated
with check (id = auth.uid());

