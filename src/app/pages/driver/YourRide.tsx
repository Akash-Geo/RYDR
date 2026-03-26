import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Phone, X, MapPin, Calendar, Clock, User as UserIcon, Navigation, Star, AlertTriangle, Coins, Gauge, Car } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { supabase } from '../../../lib/supabase';

// supported status values for a ride; these must match whatever
// the database and/or realtime updates use.  the UI previously had a
// couple of states that weren't in the union which generated
// TypeScript errors.
//
// ('ongoing' is used on the backend but isn't actually referenced in
// the component, it's included for completeness.)
type RideStatus =
  | 'scheduled'
  | 'ongoing'
  | 'en-route-pickup'
  | 'en-route-destination'
  | 'completed'
  | 'cancelled';

type BookingStatus =
  | 'pending'
  | 'confirmed'
  | 'cancelled_by_passenger'
  | 'cancelled_by_driver'
  | 'completed';

interface PassengerProfile {
  id: string;
  full_name: string | null;
  gender: string | null;
  avatar_path: string | null;
  phone: string | null;
}

interface BookingRow {
  id: string;
  ride_id: string;
  passenger_id: string;
  seats_booked: number;
  status: BookingStatus;
  points_required: number;
  pickup_location?: string;
  dropoff_location?: string;
  passenger: PassengerProfile | null;
}

/**
 * This is the raw structure returned by Supabase. We keep
 * snake_case names here so it's easy to map the query results
 * directly, but the UI uses derived/calculated values instead
 * of relying on the incorrect identifiers that were previously
 * referenced (e.g. `activeRide.from`).
 */
interface RideRow {
  id: string;
  from_location: string;
  to_location: string;
  departure_time: string;
  arrival_time: string | null;
  fuel_price: number | null;
  mileage_kmpl: number | null;
  status: RideStatus;
  vehicle_company: string | null;
  vehicle_model: string | null;
  vehicle_color: string | null;
  vehicle_registration: string | null;
  total_seats: number;
  distance_km: number | null;
  bookings: BookingRow[];
  feedbacks?: {
    id: string;
    passenger_id: string;
    rating: number;
    feedback: string | null;
  }[];
}

const UserAvatar = ({ path, name }: { path: string | null; name: string }) => {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!path) {
      setUrl(null);
      return;
    }
    let mounted = true;
    setUrl(null);
    supabase.storage.from('avatars').createSignedUrl(path, 3600).then(({ data }) => {
      if (mounted && data?.signedUrl) setUrl(data.signedUrl);
    });
    return () => { mounted = false; };
  }, [path]);

  if (url) {
    return <img src={url} alt={name} className="w-16 h-16 rounded-full object-cover border border-gray-200 dark:border-gray-700" />;
  }

  return (
    <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white font-bold text-2xl flex-shrink-0">
      {name.charAt(0).toUpperCase()}
    </div>
  );
};

export default function DriverYourRide() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<string>('current');
  const [rides, setRides] = useState<RideRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [settlingIds, setSettlingIds] = useState<Set<string>>(new Set());
  const [cancellingIds, setCancellingIds] = useState<Set<string>>(new Set());

  // helper that works with Supabase error objects that are not
  // instances of `Error` (they're PostgrestError). Falls back to
  // a generic message so the UI has something sensible.
  const extractMessage = (err: unknown, fallback: string) => {
    if (err instanceof Error) return err.message;
    if (err && typeof err === 'object' && 'message' in err) {
      return (err as any).message as string;
    }
    return fallback;
  };

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const { data: authData, error: authError } = await supabase.auth.getUser();
        if (authError) throw authError;
        const user = authData.user;
        if (!user) throw new Error('User not logged in');

        // fetch all rides for this driver, irrespective of status
        const { data, error: ridesError } = await supabase
          .from('rides')
          .select(
            `
            id,
            from_location,
            to_location,
            departure_time,
            arrival_time,
            fuel_price,
            mileage_kmpl,
            status,
            vehicle_company,
            vehicle_model,
            vehicle_color,
            vehicle_registration,
            total_seats,
            distance_km,
            bookings:bookings (
              id,
              passenger_id,
              seats_booked,
              status,
              points_required,
              pickup_location,
              dropoff_location,
              passenger:passenger_id (
                id,
                full_name,
                gender,
                avatar_path,
                phone
              )
            ),
            feedbacks:ride_feedback (
              id,
              passenger_id,
              rating,
              feedback
            )
          `,
          )
          .eq('driver_id', user.id)
          .order('departure_time', { ascending: false });

        if (ridesError) throw ridesError;
        if (!cancelled) {
          setRides(((data ?? []) as unknown) as RideRow[]);
        }
      } catch (err) {
        const msg = extractMessage(err, 'Failed to load your rides.');
        if (!cancelled) setError(msg);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, []);

  // realtime subscription for bookings so driver sees passenger adds/updates immediately
  useEffect(() => {
    let channel: any;
    let mounted = true;
    const loadRides = async () => {
      try {
        const { data: authData } = await supabase.auth.getUser();
        const user = authData.user;
        if (!user || !mounted) return;

        const { data, error: ridesError } = await supabase
          .from('rides')
          .select(
            `
            id,
            from_location,
            to_location,
            departure_time,
            arrival_time,
            fuel_price,
            mileage_kmpl,
            status,
            vehicle_company,
            vehicle_model,
            vehicle_color,
            vehicle_registration,
            total_seats,
            distance_km,
            bookings:bookings (
              id,
              ride_id,
              passenger_id,
              seats_booked,
              status,
              points_required,
              pickup_location,
              dropoff_location,
              passenger:passenger_id (
                id,
                full_name,
                gender,
                avatar_path,
                phone
              )
            ),
            feedbacks:ride_feedback (
              id,
              passenger_id,
              rating,
              feedback
            )
          `,
          )
          .eq('driver_id', user.id)
          .order('departure_time', { ascending: false });

        if (ridesError) throw ridesError;
        if (mounted) {
          setRides(((data ?? []) as unknown) as RideRow[]);
        }
      } catch (err) {
        // silently fail on realtime refresh; the data will be stale but
        // usable, and the user can manually refresh if needed.
      }
    };

    (async () => {
      const { data: authData } = await supabase.auth.getUser();
      const user = authData.user;
      if (!user || !mounted) return;

      channel = supabase
        .channel('bookings_driver')
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'bookings' },
          () => {
            // a booking was added; refetch rides to get the full nested
            // passenger data for the new booking
            void loadRides();
          },
        )
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'bookings' },
          () => {
            // booking status changed; refetch to get the latest state
            void loadRides();
          },
        )
        .on(
          'postgres_changes',
          { event: 'DELETE', schema: 'public', table: 'bookings' },
          () => {
            // booking was deleted; refetch to remove it from the list
            void loadRides();
          },
        )
        .subscribe();
    })();

    return () => {
      mounted = false;
      if (channel) supabase.removeChannel(channel);
    };
  }, []);

  // realtime updates aren't currently wired up for the multi-ride
  // interface. the page reloads when mounted and the user can always pull
  // to refresh if necessary. should the need arise we can add channel
  // subscriptions for individual rides or a driver-specific channel.

  // total earnings for a given ride
  const totalEarningsPotential = (ride: RideRow) =>
    ride.bookings
      .filter((b) => b.status === 'confirmed' || b.status === 'completed')
      .reduce((sum, b) => sum + b.points_required, 0);

  const handleCallPassenger = (phone: string) => {
    window.location.href = `tel:${phone}`;
  };

  const handleCancelPassenger = async (rideId: string, bookingId: string) => {
    if (!confirm('Cancel this passenger booking?')) return;
    try {
      const ride = rides.find((r) => r.id === rideId);
      const booking = ride?.bookings.find((b) => b.id === bookingId);
      if (!booking || !ride) return;

      const { error } = await supabase
        .from('bookings')
        .update({ status: 'cancelled_by_driver' })
        .eq('id', bookingId);
      if (error) throw error;

      await supabase.from('notifications').insert({
        user_id: booking.passenger_id,
        type: 'ride_cancelled_driver',
        title: 'Driver cancelled your booking',
        body: 'The driver cancelled your booking on this ride.',
        related_ride_id: ride.id,
        related_booking_id: booking.id,
      });

      setRides((prev) =>
        prev.map((r) =>
          r.id === rideId
            ? {
                ...r,
                bookings: r.bookings.map((b) =>
                  b.id === bookingId ? { ...b, status: 'cancelled_by_driver' } : b,
                ),
              }
            : r,
        ),
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to cancel passenger.';
      setError(msg);
    }
  };

  const handleCancelRide = async (rideId: string) => {
    if (!confirm('Are you sure you want to cancel this entire ride?')) return;
    setCancellingIds((s) => new Set(s).add(rideId));
    setError(null);
    try {
      const ride = rides.find((r) => r.id === rideId);
      if (!ride) return;

      const passengerBookings = ride.bookings.filter(
        (b) => b.status === 'confirmed' || b.status === 'pending',
      );

      if (passengerBookings.length > 0) {
        const notifications = passengerBookings.map((b) => ({
          user_id: b.passenger_id,
          type: 'ride_cancelled_driver' as const,
          title: 'Ride cancelled',
          body: 'The driver cancelled the ride you booked.',
          related_ride_id: ride.id,
          related_booking_id: b.id,
        }));
        await supabase.from('notifications').insert(notifications);
      }

      // instead of deleting the row (which is blocked by RLS in many
      // setups), simply mark the ride cancelled. the driver already has
      // update rights, and the status change will cause it to disappear from
      // the passenger view via the realtime subscription.
      const { error: updateError } = await supabase
        .from('rides')
        .update({ status: 'cancelled' })
        .eq('id', ride.id);
      if (updateError) {
        // log full error for debugging
        // eslint-disable-next-line no-console
        console.error('failed to cancel ride:', updateError);
        throw updateError;
      }

      setRides((prev) => prev.filter((r) => r.id !== rideId));
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to cancel ride.';
      setError(msg);
    } finally {
      setCancellingIds((s) => {
        const n = new Set(s);
        n.delete(rideId);
        return n;
      });
    }
  };

  const handleSettleRide = async (rideId: string) => {
    if (!confirm('Mark this ride as completed and settle wallet points?')) return;
    setSettlingIds((s) => new Set(s).add(rideId));
    setError(null);
    try {
      const { error } = await supabase.rpc('settle_ride', { p_ride_id: rideId });
      if (error) throw error;
      setRides((prev) => prev.filter((r) => r.id !== rideId));
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to settle ride.';
      setError(msg);
    } finally {
      setSettlingIds((s) => {
        const n = new Set(s);
        n.delete(rideId);
        return n;
      });
    }
  };

  const getStatusInfo = (status: RideStatus) => {
    switch (status) {
      case 'scheduled':
        return { text: 'Scheduled', color: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400' };
      case 'en-route-pickup':
        return { text: 'En Route to Pickup', color: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400' };
      case 'en-route-destination':
        return { text: 'En Route to Destination', color: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' };
      case 'completed':
        return { text: 'Completed', color: 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300' };
      default:
        return { text: 'Unknown', color: 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300' };
    }
  };

  // helper values for a specific ride are computed inside RideCard below.

  const currentRides = rides.filter(
    (r) => r.status !== 'completed' && r.status !== 'cancelled',
  );
  const pastRides = rides.filter(
    (r) => r.status === 'completed' || r.status === 'cancelled',
  );

  const RideCard = ({ ride }: { ride: RideRow }) => {
    const confirmedBookings = ride.bookings.filter((b) => b.status === 'confirmed' || b.status === 'completed');
    const seatsBooked = confirmedBookings.reduce((sum, b) => sum + (b.seats_booked || 1), 0);
    const seatsAvailable = Math.max(0, ride.total_seats - seatsBooked);
    const statusInfo = getStatusInfo(ride.status);
    const earning = totalEarningsPotential(ride);

    return (
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-200 dark:border-gray-700 shadow-sm space-y-4">
        {/* header section */}
        <div className="flex items-start justify-between mb-4">
          <Badge className={`${statusInfo.color} border-0`}>{statusInfo.text}</Badge>
        </div>

        {/* Route & Ride Details */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-4">
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <MapPin className="w-5 h-5 text-[#00C853] mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">From</p>
                <p className="font-medium text-gray-900 dark:text-white">{ride.from_location}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <MapPin className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">To</p>
                <p className="font-medium text-gray-900 dark:text-white">{ride.to_location}</p>
              </div>
            </div>

            {(ride.vehicle_company || ride.vehicle_model) && (
              <div className="flex flex-col gap-2 mt-3 text-sm text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-900/50 p-3 rounded-xl w-fit">
                <div className="flex items-center gap-2">
                  <Car className="w-4 h-4" />
                  <span>
                    {ride.vehicle_color} {ride.vehicle_company} {ride.vehicle_model}
                    {ride.vehicle_registration && (
                      <span className="ml-2 font-mono font-medium text-gray-900 dark:text-gray-300 bg-white dark:bg-gray-800 px-1.5 py-0.5 rounded border border-gray-200 dark:border-gray-700 text-xs">
                        {ride.vehicle_registration}
                      </span>
                    )}
                  </span>
                </div>
                <div className="flex items-center gap-4 pt-1">
                  <span className="flex items-center gap-1 font-medium">
                    <Coins className="w-4 h-4 text-amber-500" />
                    ₹{ride.fuel_price}/L
                  </span>
                  <span className="flex items-center gap-1 font-medium">
                    <Gauge className="w-4 h-4 text-blue-500" />
                    {ride.mileage_kmpl} km/L
                  </span>
                </div>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-1.5 text-gray-600 dark:text-gray-400">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              <span className="text-sm">
                <span className="inline-block w-10">Dep:</span> {new Date(ride.departure_time).toLocaleString('en-GB', {
                  day: '2-digit', month: '2-digit', year: 'numeric',
                  hour: '2-digit', minute: '2-digit',
                })}
              </span>
            </div>
            {ride.arrival_time && (
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 opacity-0" />
                <span className="text-sm">
                  <span className="inline-block w-10">Arr:</span> {new Date(ride.arrival_time).toLocaleString('en-GB', {
                    day: '2-digit', month: '2-digit', year: 'numeric',
                    hour: '2-digit', minute: '2-digit',
                  })}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* earnings/controls */}
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Potential earnings: <span className="font-semibold">{earning} pts</span>
          </p>
          <div className="flex gap-2">
            {ride.status !== 'completed' && ride.status !== 'cancelled' && (
              <>
                <Button
                  size="sm"
                  disabled={cancellingIds.has(ride.id)}
                  onClick={() => handleCancelRide(ride.id)}
                  className="bg-red-600 text-white hover:bg-red-700"
                >
                  Cancel ride
                </Button>
                <Button
                  size="sm"
                  disabled={settlingIds.has(ride.id)}
                  onClick={() => handleSettleRide(ride.id)}
                  className="bg-white text-emerald-700 hover:bg-emerald-100"
                >
                  {settlingIds.has(ride.id) ? 'Settling…' : 'Mark as completed'}
                </Button>
              </>
            )}
            {(ride.status === 'completed' || ride.status === 'cancelled') && (
              <Button
                size="sm"
                variant="ghost"
                className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                onClick={async () => {
                  try {
                    const { data: { user } } = await supabase.auth.getUser();
                    if (!user) return;

                    const { data: existing } = await supabase
                      .from('disputes')
                      .select('id')
                      .eq('ride_id', ride.id)
                      .eq('raised_by', user.id)
                      .maybeSingle();

                    if (existing) {
                      navigate(`/dispute/${existing.id}`);
                      return;
                    }

                    const { data: newDispute, error: createError } = await supabase
                      .from('disputes')
                      .insert({
                        ride_id: ride.id,
                        raised_by: user.id,
                        status: 'open',
                        description: 'Dispute initiated',
                      })
                      .select()
                      .single();

                    if (createError) throw createError;

                    // Construct system message
                    try {
                      const passengers = ride.bookings.map((b) => `${b.passenger?.full_name} (${b.passenger?.phone})`).join(', ');
                      const systemMsg = `System: Dispute started by Driver.\nFrom: ${ride.from_location}\nTo: ${ride.to_location}\nDeparture: ${new Date(ride.departure_time).toLocaleString()}\nArrival: ${ride.arrival_time ? new Date(ride.arrival_time).toLocaleString() : 'Not set'}\nFuel Price: ₹${ride.fuel_price}/L\nMileage: ${ride.mileage_kmpl} km/L\nPassengers: ${passengers}`;

                      await supabase.from('dispute_messages').insert({ 
                        dispute_id: newDispute.id, 
                        sender_id: user.id, 
                        content: systemMsg 
                      });
                    } catch (msgErr) {
                      console.warn('Failed to create system message, continuing to chat...', msgErr);
                    }
                    
                    navigate(`/dispute/${newDispute.id}`);
                  } catch (err) {
                    console.error(err);
                    alert(`Failed to start dispute: ${err instanceof Error ? err.message : 'Unknown error'}`);
                  }
                }}
              >
                <AlertTriangle className="w-4 h-4 mr-2" />
                Report Issue
              </Button>
            )}
          </div>
        </div>

        {/* passenger list */}
        {confirmedBookings.length > 0 ? (
          <div className="space-y-4">
            {confirmedBookings.map((booking) => {
              const passenger = booking.passenger;
              // if passenger data isn't available (e.g. from realtime insert),
              // skip rendering this booking for now; it will be filled in on next
              // refresh or when the query fetches full nested data
              if (!passenger) return null;
              return (
                <div
                  key={booking.id}
                  className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-200 dark:border-gray-700 shadow-sm"
                >
                  {/* passenger card */}
                  <div className="flex items-start gap-4 mb-4">
                    <UserAvatar path={passenger.avatar_path} name={passenger.full_name ?? 'P'} />
                    <div className="flex-1 min-w-0">
                      <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-1">
                        {passenger.full_name ?? 'Passenger'}
                      </h3>
                      <div className="flex items-center gap-2 mb-2">
                        <Badge
                          variant="secondary"
                          className="bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-0 text-sm"
                        >
                          {passenger.gender ?? '—'}
                        </Badge>
                        <Badge
                          variant="secondary"
                          className="bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 border-0 text-xs font-medium"
                        >
                          {booking.seats_booked || 1} Seat{(booking.seats_booked || 1) > 1 ? 's' : ''}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                        <Phone className="w-4 h-4" />
                        <span className="text-sm font-medium">{passenger.phone || 'No phone'}</span>
                      </div>
                    </div>
                    <Badge className="bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 border-0">
                      {booking.status === 'completed' ? 'Completed' : 'Confirmed'}
                    </Badge>
                  </div>

                  {/* pickup/drop placeholders */}
                  <div className="space-y-3 mb-4 p-4 bg-gray-50 dark:bg-gray-900/50 rounded-xl">
                    <div className="flex items-start gap-3">
                      <div className="w-2 h-2 rounded-full bg-[#00C853] mt-2 flex-shrink-0" />
                      <div className="flex-1">
                        <p className="text-xs text-gray-500 dark:text-gray-400">Pickup</p>
                        <p className="font-medium text-gray-900 dark:text-white">
                          {booking.pickup_location || 'Pickup location as per ride route'}
                        </p>
                      </div>
                    </div>
                    <div className="border-l-2 border-dashed border-gray-300 dark:border-gray-700 h-4 ml-1" />
                    <div className="flex items-start gap-3">
                      <div className="w-2 h-2 rounded-full bg-red-500 mt-2 flex-shrink-0" />
                      <div className="flex-1">
                        <p className="text-xs text-gray-500 dark:text-gray-400">Drop-off</p>
                        <p className="font-medium text-gray-900 dark:text-white">
                          {booking.dropoff_location || 'Drop-off location as per ride route'}
                        </p>
                      </div>
                    </div>
                  </div>

                  {ride.status !== 'completed' && ride.status !== 'cancelled' && (
                    <div className="flex gap-3">
                      <Button
                        onClick={() => handleCallPassenger(passenger.phone || '')}
                        className="flex-1 h-12 bg-[#00C853] hover:bg-emerald-600 text-white font-semibold"
                      >
                        <Phone className="w-5 h-5 mr-2" />
                        Call Passenger
                      </Button>
                      <Button
                        onClick={() => handleCancelPassenger(ride.id, booking.id)}
                        className="h-12 px-6 bg-red-600 text-white hover:bg-red-700 font-semibold"
                      >
                        <X className="w-5 h-5 mr-2" />
                        Cancel
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-12">
            <p className="text-gray-600 dark:text-gray-400">No confirmed passengers yet</p>
          </div>
        )}

        {/* feedbacks - show only if ride is completed/cancelled and there are feedback rows */}
        {ride.feedbacks && ride.feedbacks.length > 0 && (
          <div className="bg-gray-50 dark:bg-gray-900/50 rounded-2xl p-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              Passenger feedback
            </h3>
            <div className="space-y-3">
              {ride.feedbacks.map((f) => (
                <div key={f.id} className="space-y-1">
                  <div className="flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star
                        key={star}
                        className={`w-4 h-4 ${star <= f.rating ? 'fill-amber-400 text-amber-400' : 'text-gray-300 dark:text-gray-600'}`}
                      />
                    ))}
                  </div>
                  {f.feedback && (
                    <p className="text-sm text-gray-700 dark:text-gray-300">
                      {f.feedback}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* seats info */}
        {seatsAvailable > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-dashed border-gray-300 dark:border-gray-700">
            <div className="text-center">
              <UserIcon className="w-12 h-12 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-600 dark:text-gray-400">
                {seatsAvailable} seat(s) still available
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">
                Waiting for more bookings...
              </p>
            </div>
          </div>
        )}
      </div>
    );
  };

  // top-level render for multi-ride interface
  const renderEmpty = (text: string) => (
    <div className="text-center py-12">
      <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
        <Navigation className="w-8 h-8 text-gray-400 dark:text-gray-500" />
      </div>
      <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">{text}</h3>
      <p className="text-gray-600 dark:text-gray-400">
        {loading ? 'Loading your rides…' : 'Post a ride to get started'}
      </p>
    </div>
  );

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="bg-gradient-to-r from-[#00C853] to-emerald-600 px-4 pt-6 pb-8">
        <div className="max-w-screen-xl mx-auto">
          <h1 className="text-2xl md:text-3xl font-bold text-white mb-2">Your Rides</h1>
          <p className="text-emerald-100">Manage rides you've posted</p>
        </div>
      </div>

      {/* Content tabs */}
      <div className="max-w-screen-xl mx-auto px-4 -mt-4">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="w-full bg-white dark:bg-gray-800 rounded-t-2xl shadow-lg border-x border-t border-gray-200 dark:border-gray-700 h-14">
            <TabsTrigger
              value="current"
              className="flex-1 text-base data-[state=active]:bg-green-50 dark:data-[state=active]:bg-green-900/30 data-[state=active]:text-green-600 dark:data-[state=active]:text-green-400"
            >
              Current Rides
            </TabsTrigger>
            <TabsTrigger
              value="past"
              className="flex-1 text-base data-[state=active]:bg-gray-50 dark:data-[state=active]:bg-gray-900/30 data-[state=active]:text-gray-600 dark:data-[state=active]:text-gray-400"
            >
              Past Rides
            </TabsTrigger>
          </TabsList>

          <TabsContent value="current" className="mt-0">
            <div className="bg-white dark:bg-gray-800 rounded-b-2xl shadow-lg border-x border-b border-gray-200 dark:border-gray-700 p-6">
              {loading ? (
                <div className="text-center py-12">
                  <p className="text-gray-600 dark:text-gray-400">Loading your rides…</p>
                </div>
              ) : currentRides.length === 0 ? (
                renderEmpty('No active rides')
              ) : (
                <div className="space-y-4">
                  {currentRides.map((ride) => (
                    <RideCard key={ride.id} ride={ride} />
                  ))}
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="past" className="mt-0">
            <div className="bg-white dark:bg-gray-800 rounded-b-2xl shadow-lg border-x border-b border-gray-200 dark:border-gray-700 p-6">
              {loading ? (
                <div className="text-center py-12">
                  <p className="text-gray-600 dark:text-gray-400">Loading your rides…</p>
                </div>
              ) : pastRides.length === 0 ? (
                renderEmpty('No past rides')
              ) : (
                <div className="space-y-4">
                  {pastRides.map((ride) => (
                    <RideCard key={ride.id} ride={ride} />
                  ))}
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
