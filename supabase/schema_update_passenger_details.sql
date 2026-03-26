-- Add pickup and dropoff location columns to bookings table
alter table public.bookings
  add column if not exists pickup_location text,
  add column if not exists dropoff_location text;

-- Update the book_ride function to accept location parameters
create or replace function public.book_ride(
  p_ride_id uuid,
  p_passenger_id uuid,
  p_seats integer,
  p_distance numeric,
  p_points integer,
  p_pickup_location text,
  p_dropoff_location text
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
  select * into r
  from public.rides
  where id = p_ride_id
  for update;

  if not found then
    raise exception 'Ride does not exist' using errcode = '22000';
  end if;

  if r.vacant_seats < p_seats then
    raise exception 'Not enough vacant seats for this ride (available %).', r.vacant_seats
      using errcode = '22000';
  end if;

  insert into public.bookings(
    ride_id,
    passenger_id,
    seats_booked,
    passenger_distance_km,
    points_required,
    status,
    pickup_location,
    dropoff_location
  ) values (
    p_ride_id, p_passenger_id, p_seats, p_distance, p_points, 'confirmed', p_pickup_location, p_dropoff_location
  ) returning * into new_booking;

  return new_booking;
end;
$$;