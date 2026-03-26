-- Run AFTER `supabase/schema.sql` (or merge into it).
-- Adds: gender + smoker + profile photo + admin access + better verification support.

-- 1) Gender type
do $$
begin
  if not exists (select 1 from pg_type where typname = 'gender') then
    create type public.gender as enum ('male', 'female', 'other', 'prefer_not_to_say');
  end if;
end $$;

-- 2) Extend profiles table
alter table public.profiles
  add column if not exists gender public.gender,
  add column if not exists is_smoker boolean not null default false,
  add column if not exists avatar_path text,
  add column if not exists verified_at timestamptz,
  add column if not exists verified_by uuid references auth.users (id),
  add column if not exists rejection_reason text;

-- Keep verified timestamps in sync
create or replace function public.set_verification_audit_fields()
returns trigger
language plpgsql
as $$
begin
  if new.verification_status is distinct from old.verification_status then
    if new.verification_status = 'verified' then
      new.verified_at := now();
      new.rejection_reason := null;
    elsif new.verification_status = 'rejected' then
      new.verified_at := null;
    else
      new.verified_at := null;
      new.rejection_reason := null;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists set_profiles_verification_audit on public.profiles;
create trigger set_profiles_verification_audit
before update on public.profiles
for each row
execute function public.set_verification_audit_fields();

-- 3) Admin helper for RLS
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'::public.user_role
  );
$$;

-- 4) Update RLS policies to allow admins to view/manage verification
drop policy if exists "profiles_select_own" on public.profiles;
drop policy if exists "profiles_select_own_or_admin" on public.profiles;
drop policy if exists "profiles_select_all" on public.profiles;
create policy "profiles_select_all"
on public.profiles
for select
to authenticated
using (true);

drop policy if exists "profiles_update_own" on public.profiles;
drop policy if exists "profiles_update_own_or_admin" on public.profiles;
create policy "profiles_update_own_or_admin"
on public.profiles
for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

-- 5) Wallet support (per-profile balance + payments)

-- Payment method type
do $$
begin
  if not exists (select 1 from pg_type where typname = 'payment_method') then
    create type public.payment_method as enum ('debit_card', 'credit_card', 'upi');
  end if;
end $$;

-- Wallet table (1 row per profile, holds current points balance)
create table if not exists public.wallets (
  profile_id uuid primary key references public.profiles (id) on delete cascade,
  balance_points integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Keep wallets.updated_at in sync
create or replace function public.set_wallet_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_wallets_updated_at on public.wallets;
create trigger set_wallets_updated_at
before update on public.wallets
for each row
execute function public.set_wallet_updated_at();

-- Ensure every profile has a wallet row
create or replace function public.ensure_wallet_for_profile()
returns trigger
language plpgsql
as $$
begin
  insert into public.wallets (profile_id)
  values (new.id)
  on conflict (profile_id) do nothing;
  return new;
end;
$$;

drop trigger if exists ensure_wallet_after_profile_insert on public.profiles;
create trigger ensure_wallet_after_profile_insert
after insert on public.profiles
for each row
execute function public.ensure_wallet_for_profile();

-- Wallet payments table: stores each recharge/payment and credits points
create table if not exists public.wallet_payments (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  amount_inr numeric(10, 2) not null check (amount_inr > 0),
  points_credited integer not null,
  method public.payment_method not null,
  created_at timestamptz not null default now()
);

create index if not exists wallet_payments_profile_id_idx
  on public.wallet_payments (profile_id, created_at desc);

-- Allow wallet_payments to represent both credits and debits in points.
-- Positive points_credited = credit, negative = debit.
alter table public.wallet_payments
  drop constraint if exists wallet_payments_points_credited_check;

alter table public.wallet_payments
  add constraint wallet_payments_points_credited_check
  check (points_credited <> 0);

-- When a payment is recorded, credit the user's wallet
create or replace function public.apply_wallet_payment()
returns trigger
language plpgsql
as $$
begin
  -- Apply the points delta (can be positive = credit or negative = debit)
  update public.wallets w
  set balance_points = w.balance_points + new.points_credited,
      updated_at = now()
  where w.profile_id = new.profile_id;

  -- In case a wallet row doesn't exist yet for some reason, create it
  insert into public.wallets (profile_id, balance_points)
  select new.profile_id, new.points_credited
  where not exists (
    select 1 from public.wallets w2 where w2.profile_id = new.profile_id
  );

  return new;
end;
$$;

drop trigger if exists apply_wallet_payment_after_insert on public.wallet_payments;
create trigger apply_wallet_payment_after_insert
after insert on public.wallet_payments
for each row
execute function public.apply_wallet_payment();

-- RLS for wallets
alter table public.wallets enable row level security;

drop policy if exists "wallets_select_own" on public.wallets;
create policy "wallets_select_own"
on public.wallets
for select
to authenticated
using (profile_id = auth.uid());

drop policy if exists "wallets_update_own" on public.wallets;
create policy "wallets_update_own"
on public.wallets
for update
to authenticated
using (profile_id = auth.uid())
with check (profile_id = auth.uid());

drop policy if exists "wallets_insert_own" on public.wallets;
create policy "wallets_insert_own"
on public.wallets
for insert
to authenticated
with check (profile_id = auth.uid());

-- RLS for wallet payments
alter table public.wallet_payments enable row level security;

drop policy if exists "wallet_payments_select_own" on public.wallet_payments;
create policy "wallet_payments_select_own"
on public.wallet_payments
for select
to authenticated
using (profile_id = auth.uid());

drop policy if exists "wallet_payments_insert_own" on public.wallet_payments;
create policy "wallet_payments_insert_own"
on public.wallet_payments
for insert
to authenticated
with check (profile_id = auth.uid());

-- 6) Ride sharing core schema: rides, bookings, notifications, ratings

-- Ride status type
do $$
begin
  if not exists (select 1 from pg_type where typname = 'ride_status') then
    create type public.ride_status as enum ('scheduled', 'ongoing', 'completed', 'cancelled');
  end if;
end $$;

-- Booking status type
do $$
begin
  if not exists (select 1 from pg_type where typname = 'booking_status') then
    create type public.booking_status as enum (
      'pending',
      'confirmed',
      'cancelled_by_passenger',
      'cancelled_by_driver',
      'completed'
    );
  end if;
end $$;

-- Notification type
do $$
begin
  if not exists (select 1 from pg_type where typname = 'notification_type') then
    create type public.notification_type as enum (
      'ride_created',
      'ride_cancelled_driver',
      'ride_cancelled_passenger',
      'booking_created',
      'booking_cancelled',
      'ride_completed',
      'verification_updated',
      'wallet_updated'
    );
  end if;
end $$;

-- Rides table (driver-posted rides)
create table if not exists public.rides (
  id uuid primary key default gen_random_uuid(),
  driver_id uuid not null references public.profiles (id) on delete cascade,

  from_location text not null,
  to_location text not null,
  from_lat numeric,
  from_lng numeric,
  to_lat numeric,
  to_lng numeric,

  departure_time timestamptz not null,
  arrival_time timestamptz,

  status public.ride_status not null default 'scheduled',

  total_seats integer not null check (total_seats > 0),
  vacant_seats integer not null check (vacant_seats >= 0),

  distance_km numeric(10, 2),

  fuel_price numeric(10, 2),           -- INR per litre
  mileage_kmpl numeric(10, 2),         -- km per litre
  estimated_total_points integer,      -- (fuel_price * distance_km) / mileage_kmpl

  vehicle_registration text,
  vehicle_company text,
  vehicle_model text,
  vehicle_color text,

  women_only boolean not null default false,
  non_smoker_only boolean not null default false,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists rides_driver_id_idx on public.rides (driver_id);
create index if not exists rides_status_idx on public.rides (status);
create index if not exists rides_departure_time_idx on public.rides (departure_time);

-- Keep rides.updated_at in sync
create or replace function public.set_rides_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_rides_updated_at on public.rides;
create trigger set_rides_updated_at
before update on public.rides
for each row
execute function public.set_rides_updated_at();

-- Bookings table (passenger bookings per ride)
create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  ride_id uuid not null references public.rides (id) on delete cascade,
  passenger_id uuid not null references public.profiles (id) on delete cascade,

  seats_booked integer not null default 1 check (seats_booked > 0),

  passenger_distance_km numeric(10, 2),
  points_required integer not null,

  status public.booking_status not null default 'pending',

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists bookings_ride_id_idx on public.bookings (ride_id);
create index if not exists bookings_passenger_id_idx on public.bookings (passenger_id);

-- Keep bookings.updated_at in sync
create or replace function public.set_bookings_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_bookings_updated_at on public.bookings;
create trigger set_bookings_updated_at
before update on public.bookings
for each row
execute function public.set_bookings_updated_at();

-- When a confirmed booking is inserted, reduce ride vacant_seats
create or replace function public.apply_booking_on_insert()
returns trigger
language plpgsql
as $$
declare
  v_current_vacant integer;
  v_ride_exists boolean;
begin
  if new.status = 'confirmed' then
    -- Get current vacant seats and check if ride exists (lock row)
    select vacant_seats, true into v_current_vacant, v_ride_exists
    from public.rides
    where id = new.ride_id
    for update;

    -- audit: note that trigger ran for this insert
    insert into public.booking_audit (p_ride_id, p_passenger_id, p_seats, stage, details)
    values (new.ride_id, new.passenger_id, new.seats_booked, 'trigger_after_insert', null);

    -- Check if ride exists
    if not v_ride_exists then
      raise exception 'Ride does not exist (ride_id: %)', new.ride_id
        using errcode = '22000';
    end if;

    -- Check if vacant_seats is NULL
    if v_current_vacant is null then
      raise exception 'Ride vacant_seats is NULL. Cannot book. (ride_id: %)', new.ride_id
        using errcode = '22000';
    end if;

    -- Check if enough seats available
    if v_current_vacant < new.seats_booked then
      raise exception 'Not enough vacant seats for this ride. Available: %, Requested: %', 
        v_current_vacant, new.seats_booked
        using errcode = '22000';
    end if;

    -- Update vacant seats
    update public.rides r
    set vacant_seats = r.vacant_seats - new.seats_booked
    where r.id = new.ride_id;
  end if;

  return new;
end;
$$;

drop trigger if exists apply_booking_on_insert on public.bookings;
create trigger apply_booking_on_insert
after insert on public.bookings
for each row
execute function public.apply_booking_on_insert();

-- When a booking is cancelled, free seats back
create or replace function public.apply_booking_on_update()
returns trigger
language plpgsql
as $$
begin
  if old.status = 'confirmed'
     and new.status in ('cancelled_by_passenger', 'cancelled_by_driver') then
    update public.rides r
    set vacant_seats = r.vacant_seats + old.seats_booked
    where r.id = old.ride_id;
  end if;

  return new;
end;
$$;

-- RPC for atomic seat decrement+booking insert. avoids race between select and insert.
-- runs as security definer so the helper can read/lock the ride row despite
-- RLS policies; the caller must still be authenticated for the booking
-- insert itself (the insert will be subject to normal policies).
create or replace function public.book_ride(
  p_ride_id uuid,
  p_passenger_id uuid,
  p_seats integer,
  p_distance numeric,
  p_points integer
)
returns public.bookings
language plpgsql
security definer
set search_path = public
as $$
declare
  new_booking public.bookings%rowtype;
  r public.rides%rowtype;
begin
  -- lock the ride row to serialize concurrent bookings. the FOR UPDATE
  -- clause forces other transactions attempting to touch the same ride to
  -- wait until we commit, eliminating "lost update" scenarios where two
  -- transactions both decrement from the same starting value. because this
  -- function is security definer, the select bypasses RLS and will find the
  -- row regardless of the caller's identity.
  select * into r
  from public.rides
  where id = p_ride_id
  for update;

  -- audit: record the attempt parameters
  insert into public.booking_audit (p_ride_id, p_passenger_id, p_seats, stage)
  values (p_ride_id, p_passenger_id, p_seats, 'rpc_start');

  if not found then
    raise exception 'Ride does not exist' using errcode = '22000';
  end if;

  if r.vacant_seats is null then
    raise exception 'Ride vacant_seats is NULL. Cannot book.' using errcode = '22000';
  end if;

  if r.vacant_seats < p_seats then
    raise exception 'Not enough vacant seats for this ride (available %).', r.vacant_seats
      using errcode = '22000';
  end if;

  -- now that we've locked and checked, perform the insert. the
  -- `apply_booking_on_insert` trigger will decrement `vacant_seats` once
  -- inside the same transaction. removing the explicit update here avoids a
  -- double-decrement when the trigger also runs.
  insert into public.bookings(
    ride_id,
    passenger_id,
    seats_booked,
    passenger_distance_km,
    points_required,
    status
  ) values (
    p_ride_id,
    p_passenger_id,
    p_seats,
    p_distance,
    p_points,
    'confirmed'
  ) returning * into new_booking;

  -- audit: record that the insert completed inside the rpc
  insert into public.booking_audit (p_ride_id, p_passenger_id, p_seats, stage, details)
  values (p_ride_id, p_passenger_id, p_seats, 'rpc_after_insert', coalesce(new_booking.id::text, '')); 

  return new_booking;
end;
$$;

drop trigger if exists apply_booking_on_update on public.bookings;
create trigger apply_booking_on_update
after update on public.bookings
for each row
execute function public.apply_booking_on_update();

-- Notifications table
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  type public.notification_type not null,
  title text not null,
  body text not null,
  related_ride_id uuid references public.rides (id) on delete cascade,
  related_booking_id uuid references public.bookings (id) on delete cascade,
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create index if not exists notifications_user_id_idx on public.notifications (user_id, created_at desc);

-- Debug/audit table for booking attempts (temporary; can be removed after debugging)
create table if not exists public.booking_audit (
  id uuid primary key default gen_random_uuid(),
  p_ride_id uuid,
  p_passenger_id uuid,
  p_seats integer,
  stage text,
  details text,
  created_at timestamptz not null default now()
);

create index if not exists booking_audit_ride_idx on public.booking_audit (p_ride_id, created_at desc);

-- Ratings and feedback per ride
create table if not exists public.ride_feedback (
  id uuid primary key default gen_random_uuid(),
  ride_id uuid not null references public.rides (id) on delete cascade,
  passenger_id uuid not null references public.profiles (id) on delete cascade,
  driver_id uuid not null references public.profiles (id) on delete cascade,
  rating integer not null check (rating between 1 and 5),
  feedback text,
  created_at timestamptz not null default now(),
  unique (ride_id, passenger_id)
);

create index if not exists ride_feedback_driver_id_idx on public.ride_feedback (driver_id);

-- Optional: track driver rating aggregates on profiles
alter table public.profiles
  add column if not exists driver_rating_avg numeric(3, 2),
  add column if not exists driver_rating_count integer not null default 0;

create or replace function public.update_driver_rating_aggregate()
returns trigger
language plpgsql
as $$
begin
  update public.profiles p
  set
    driver_rating_avg = sub.avg_rating,
    driver_rating_count = sub.rating_count
  from (
    select
      driver_id,
      avg(rating)::numeric(3,2) as avg_rating,
      count(*)::integer as rating_count
    from public.ride_feedback
    where driver_id = new.driver_id
    group by driver_id
  ) as sub
  where p.id = sub.driver_id;

  return new;
end;
$$;

drop trigger if exists update_driver_rating_aggregate_after_insert on public.ride_feedback;
create trigger update_driver_rating_aggregate_after_insert
after insert on public.ride_feedback
for each row
execute function public.update_driver_rating_aggregate();

-- 7) Ride settlement helper: move wallet points at ride completion
create or replace function public.settle_ride(p_ride_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_driver_id uuid;
  v_booking record;
begin
  -- Ensure the ride exists and belongs to the current driver
  select r.driver_id
  into v_driver_id
  from public.rides r
  where r.id = p_ride_id
  for update;

  if not found then
    raise exception 'Ride not found';
  end if;

  if v_driver_id <> auth.uid() then
    raise exception 'Not authorized to settle this ride';
  end if;

  -- For each confirmed booking: move points from passenger to driver
  for v_booking in
    select b.id, b.passenger_id, b.points_required
    from public.bookings b
    where b.ride_id = p_ride_id
      and b.status = 'confirmed'
  loop
    -- Deduct from passenger wallet
    update public.wallets w
    set balance_points = w.balance_points - v_booking.points_required,
        updated_at = now()
    where w.profile_id = v_booking.passenger_id;

    -- Credit driver wallet
    update public.wallets w
    set balance_points = w.balance_points + v_booking.points_required,
        updated_at = now()
    where w.profile_id = v_driver_id;

    -- Record wallet payment rows (debit for passenger, credit for driver)
    insert into public.wallet_payments (profile_id, amount_inr, points_credited, method)
    values
      (v_booking.passenger_id, v_booking.points_required, -v_booking.points_required, 'upi'),
      (v_driver_id, v_booking.points_required, v_booking.points_required, 'upi');

    -- Mark booking completed
    update public.bookings b2
    set status = 'completed'
    where b2.id = v_booking.id;

    -- Notify passenger about ride completion and wallet deduction
    insert into public.notifications (user_id, type, title, body, related_ride_id, related_booking_id)
    values (
      v_booking.passenger_id,
      'ride_completed',
      'Ride completed',
      'Your ride has been completed and wallet points have been deducted.',
      p_ride_id,
      v_booking.id
    );
  end loop;

  -- Mark ride completed
  update public.rides r
  set status = 'completed'
  where r.id = p_ride_id;

  -- Notify driver about settlement
  insert into public.notifications (user_id, type, title, body, related_ride_id)
  values (
    v_driver_id,
    'ride_completed',
    'Ride settled',
    'Ride has been marked as completed and wallet points have been credited.',
    p_ride_id
  );
end;
$$;

-- Basic RLS
alter table public.rides enable row level security;
alter table public.bookings enable row level security;
alter table public.notifications enable row level security;
alter table public.ride_feedback enable row level security;

-- Rides: allow all authenticated users to read all ride statuses.
-- privacy is enforced at the bookings level (passengers see only their bookings).
-- drivers can manage their own rides (update/insert/delete).
drop policy if exists "rides_select_public" on public.rides;
drop policy if exists "rides_insert_driver" on public.rides;
drop policy if exists "rides_update_driver" on public.rides;
create policy "rides_select_public"
on public.rides
for select
to authenticated
using (true);

create policy "rides_insert_driver"
on public.rides
for insert
to authenticated
with check (driver_id = auth.uid());

create policy "rides_update_driver"
on public.rides
for update
to authenticated
using (driver_id = auth.uid())
with check (driver_id = auth.uid());

-- Bookings: passengers manage their own bookings
drop policy if exists "bookings_select_own" on public.bookings;
drop policy if exists "bookings_insert_own" on public.bookings;
drop policy if exists "bookings_update_own" on public.bookings;
create policy "bookings_select_own"
on public.bookings
for select
to authenticated
using (
  passenger_id = auth.uid()
  or exists (
    select 1 from public.rides r where r.id = public.bookings.ride_id and r.driver_id = auth.uid()
  )
);

create policy "bookings_insert_own"
on public.bookings
for insert
to authenticated
with check (passenger_id = auth.uid());

create policy "bookings_update_own"
on public.bookings
for update
to authenticated
using (passenger_id = auth.uid())
with check (passenger_id = auth.uid());

-- Notifications: user can read their own notifications
drop policy if exists "notifications_select_own" on public.notifications;
drop policy if exists "notifications_update_own" on public.notifications;
drop policy if exists "notifications_insert_any" on public.notifications;
create policy "notifications_select_own"
on public.notifications
for select
to authenticated
using (user_id = auth.uid());

create policy "notifications_update_own"
on public.notifications
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

-- Notifications: allow any authenticated user to insert notifications
create policy "notifications_insert_any"
on public.notifications
for insert
to authenticated
with check (true);

-- Ratings: passengers can insert their own feedback, everyone can read
drop policy if exists "ride_feedback_select_all" on public.ride_feedback;
drop policy if exists "ride_feedback_insert_own" on public.ride_feedback;
create policy "ride_feedback_select_all"
on public.ride_feedback
for select
to authenticated
using (true);

create policy "ride_feedback_insert_own"
on public.ride_feedback
for insert
to authenticated
with check (passenger_id = auth.uid());
