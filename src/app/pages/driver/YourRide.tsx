import { useEffect, useState } from 'react';
import { Phone, X, MapPin, Calendar, Clock, User as UserIcon, Navigation, Star } from 'lucide-react';
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
}

interface BookingRow {
  id: string;
  ride_id: string;
  passenger_id: string;
  seats_booked: number;
  status: BookingStatus;
  points_required: number;
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
  status: RideStatus;
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

export default function DriverYourRide() {
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
            status,
            total_seats,
            distance_km,
            bookings:bookings (
              id,
              passenger_id,
              seats_booked,
              status,
              points_required,
              passenger:passenger_id (
                id,
                full_name,
                gender
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
            status,
            total_seats,
            distance_km,
            bookings:bookings (
              id,
              ride_id,
              passenger_id,
              seats_booked,
              status,
              points_required,
              passenger:passenger_id (
                id,
                full_name,
                gender
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
    const confirmedBookings = ride.bookings.filter((b) => b.status === 'confirmed');
    const passengerCount = confirmedBookings.length;
    const seatsAvailable = ride.total_seats - passengerCount;
    const statusInfo = getStatusInfo(ride.status);
    const earning = totalEarningsPotential(ride);

    return (
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-200 dark:border-gray-700 shadow-sm space-y-4">
        {/* header section */}
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              {ride.from_location} → {ride.to_location}
            </h2>
            <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
              <Calendar className="w-4 h-4" />
              <span className="text-sm">
                {new Date(ride.departure_time).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                })}{' '}
                {new Date(ride.departure_time).toLocaleTimeString(undefined, {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            </div>
          </div>
          <Badge className={`${statusInfo.color} border-0`}>{statusInfo.text}</Badge>
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
                    <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white font-bold text-2xl flex-shrink-0">
                      {(passenger.full_name ?? 'P').charAt(0)}
                    </div>
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
                      </div>
                      <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                        <Phone className="w-4 h-4" />
                        <span className="text-sm font-medium">{passenger.id}</span>
                      </div>
                    </div>
                    <Badge className="bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 border-0">
                      Confirmed
                    </Badge>
                  </div>

                  {/* pickup/drop placeholders */}
                  <div className="space-y-3 mb-4 p-4 bg-gray-50 dark:bg-gray-900/50 rounded-xl">
                    <div className="flex items-start gap-3">
                      <div className="w-2 h-2 rounded-full bg-[#00C853] mt-2 flex-shrink-0" />
                      <div className="flex-1">
                        <p className="text-xs text-gray-500 dark:text-gray-400">Pickup</p>
                        <p className="font-medium text-gray-900 dark:text-white">
                          Pickup location as per ride route
                        </p>
                      </div>
                    </div>
                    <div className="border-l-2 border-dashed border-gray-300 dark:border-gray-700 h-4 ml-1" />
                    <div className="flex items-start gap-3">
                      <div className="w-2 h-2 rounded-full bg-red-500 mt-2 flex-shrink-0" />
                      <div className="flex-1">
                        <p className="text-xs text-gray-500 dark:text-gray-400">Drop-off</p>
                        <p className="font-medium text-gray-900 dark:text-white">
                          Drop-off location as per ride route
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <Button
                      onClick={() => handleCallPassenger('')}
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
        {passengerCount < ride.total_seats && (
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
