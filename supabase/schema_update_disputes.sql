-- Create dispute status enum
create type public.dispute_status as enum ('open', 'in_progress', 'resolved', 'closed');

-- Create disputes table
create table if not exists public.disputes (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  raised_by uuid not null references public.profiles(id),
  description text not null,
  status public.dispute_status not null default 'open',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Create dispute messages table (for chat)
create table if not exists public.dispute_messages (
  id uuid primary key default gen_random_uuid(),
  dispute_id uuid not null references public.disputes(id) on delete cascade,
  sender_id uuid not null references public.profiles(id),
  content text not null,
  created_at timestamptz not null default now()
);

-- Enable RLS
alter table public.disputes enable row level security;
alter table public.dispute_messages enable row level security;

-- Policies for Disputes
-- Users can view disputes they raised. Admins can view all.
create policy "disputes_select_own_or_admin"
  on public.disputes for select
  to authenticated
  using (raised_by = auth.uid() or public.is_admin());

-- Users can insert disputes for themselves.
create policy "disputes_insert_own"
  on public.disputes for insert
  to authenticated
  with check (raised_by = auth.uid());

-- Admins can update status.
create policy "disputes_update_admin"
  on public.disputes for update
  to authenticated
  using (public.is_admin());

-- Policies for Messages
-- Participants (raiser) and Admins can view messages.
create policy "messages_select_participants"
  on public.dispute_messages for select
  to authenticated
  using (
    exists (
      select 1 from public.disputes d
      where d.id = dispute_messages.dispute_id
      and (d.raised_by = auth.uid() or public.is_admin())
    )
  );

-- Participants and Admins can insert messages.
create policy "messages_insert_participants"
  on public.dispute_messages for insert
  to authenticated
  with check (
    exists (
      select 1 from public.disputes d
      where d.id = dispute_messages.dispute_id
      and (d.raised_by = auth.uid() or public.is_admin())
    )
  );