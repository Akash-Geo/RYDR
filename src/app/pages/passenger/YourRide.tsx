import { useEffect, useState } from 'react';
import { Phone, X, Star, MapPin, Calendar, Clock, User } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { Input } from '../../components/ui/input';
import { supabase } from '../../../lib/supabase';

type BookingStatus =
  | 'pending'
  | 'confirmed'
  | 'cancelled_by_passenger'
  | 'cancelled_by_driver'
  | 'completed';

interface DriverProfile {
  id: string;
  full_name: string | null;
  driver_rating_avg: number | null;
  driver_rating_count: number;
}

interface RideRow {
  id: string;
  from_location: string;
  to_location: string;
  departure_time: string;
  status: 'scheduled' | 'ongoing' | 'completed' | 'cancelled';
  driver: DriverProfile | null;
}

interface BookingRow {
  id: string;
  ride_id: string;
  status: BookingStatus;
  points_required: number;
  created_at: string;
  ride: RideRow | null;
  feedback?: {
    rating: number;
    feedback: string | null;
  } | null;
}

export default function PassengerYourRide() {
  const [activeTab, setActiveTab] = useState('current');
  const [bookings, setBookings] = useState<BookingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

        const { data, error: bookingsError } = await supabase
          .from('bookings')
          .select(
            `
            id,
            ride_id,
            status,
            points_required,
            created_at,
            ride:ride_id (
              id,
              from_location,
              to_location,
              departure_time,
              status,
              driver:driver_id (
                id,
                full_name,
                driver_rating_avg,
                driver_rating_count
              )
            )
          `,
          )
          .eq('passenger_id', user.id)
          .order('created_at', { ascending: false });

        if (bookingsError) throw bookingsError;
        let bookingsList = (data ?? []) as BookingRow[];

        // fetch feedbacks for these rides (current user only)
        const rideIds = bookingsList.map((b) => b.ride_id);
        if (rideIds.length) {
          const { data: fbData } = await supabase
            .from('ride_feedback')
            .select('ride_id, rating, feedback')
            .in('ride_id', rideIds)
            .eq('passenger_id', user.id);
          const feedbackMap: Record<string, { rating: number; feedback: string | null }> = {};
          (fbData ?? []).forEach((f: any) => {
            feedbackMap[f.ride_id] = { rating: f.rating, feedback: f.feedback };
          });
          bookingsList = bookingsList.map((b) => ({
            ...b,
            feedback: feedbackMap[b.ride_id] ?? null,
          }));
        }

        if (!cancelled) {
          setBookings(bookingsList);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to load rides.';
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

  // realtime subscription so the passenger sees new/updated bookings immediately
  useEffect(() => {
    let channel: any;
    let mounted = true;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const { data: authData, error: authError } = await supabase.auth.getUser();
        if (authError) throw authError;
        const user = authData.user;
        if (!user) throw new Error('User not logged in');

        const { data, error: bookingsError } = await supabase
          .from('bookings')
          .select(
            `
            id,
            ride_id,
            status,
            points_required,
            created_at,
            ride:ride_id (
              id,
              from_location,
              to_location,
              departure_time,
              status,
              driver:driver_id (
                id,
                full_name,
                driver_rating_avg,
                driver_rating_count
              )
            )
          `,
          )
          .eq('passenger_id', user.id)
          .order('created_at', { ascending: false });

        if (bookingsError) throw bookingsError;
        let bookingsList = (data ?? []) as BookingRow[];

        // fetch feedbacks for these rides (current user only)
        const rideIds = bookingsList.map((b) => b.ride_id);
        if (rideIds.length) {
          const { data: fbData } = await supabase
            .from('ride_feedback')
            .select('ride_id, rating, feedback')
            .in('ride_id', rideIds)
            .eq('passenger_id', user.id);
          const feedbackMap: Record<string, { rating: number; feedback: string | null }> = {};
          (fbData ?? []).forEach((f: any) => {
            feedbackMap[f.ride_id] = { rating: f.rating, feedback: f.feedback };
          });
          bookingsList = bookingsList.map((b) => ({
            ...b,
            feedback: feedbackMap[b.ride_id] ?? null,
          }));
        }

        if (mounted) {
          setBookings(bookingsList);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to load rides.';
        if (mounted) setError(msg);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    (async () => {
      const { data: authData } = await supabase.auth.getUser();
      const user = authData.user;
      if (!user || !mounted) return;

      channel = supabase
        .channel('bookings_passenger')
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'bookings' },
          (payload) => {
            const b = payload.new as BookingRow;
            if (b.passenger_id !== user.id) return;
            // refetch full bookings with nested ride data to ensure we have
            // complete information for display
            void load();
          },
        )
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'bookings' },
          (payload) => {
            const b = payload.new as BookingRow;
            if (b.passenger_id !== user.id) return;
            // refetch to ensure we have the latest ride status and complete data
            void load();
          },
        )
        .on(
          'postgres_changes',
          { event: 'DELETE', schema: 'public', table: 'bookings' },
          (payload) => {
            const b = payload.old as BookingRow;
            if (!b) return;
            setBookings((prev) => prev.filter((p) => p.id !== b.id));
          },
        )
        .subscribe();
    })();

    return () => {
      mounted = false;
      if (channel) supabase.removeChannel(channel);
    };
  }, []);

  const currentBookings = bookings.filter(
    (b) =>
      b.ride &&
      b.ride.status !== 'completed' &&
      b.status !== 'cancelled_by_driver' &&
      b.status !== 'cancelled_by_passenger',
  );

  const pastBookings = bookings.filter(
    (b) =>
      !b.ride ||
      b.ride.status === 'completed' ||
      b.status === 'cancelled_by_driver' ||
      b.status === 'cancelled_by_passenger',
  );

  const handleCancelRide = async (bookingId: string) => {
    if (!confirm('Are you sure you want to cancel this ride?')) return;
    setError(null);
    try {
      const booking = bookings.find((b) => b.id === bookingId);
      if (!booking || !booking.ride || !booking.ride.driver) return;

      const { error: updateError } = await supabase
        .from('bookings')
        .update({ status: 'cancelled_by_passenger' })
        .eq('id', bookingId);
      if (updateError) throw updateError;

      await supabase.from('notifications').insert({
        user_id: booking.ride.driver.id,
        type: 'ride_cancelled_passenger',
        title: 'Passenger cancelled ride',
        body: 'A passenger cancelled their booking on your ride.',
        related_ride_id: booking.ride.id,
        related_booking_id: booking.id,
      });

      setBookings((prev) =>
        prev.map((b) => (b.id === bookingId ? { ...b, status: 'cancelled_by_passenger' } : b)),
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to cancel ride.';
      setError(msg);
    }
  };

  const handleCallDriver = (phone: string) => {
    window.location.href = `tel:${phone}`;
  };


  const RideCard = ({ booking, showActions }: { booking: BookingRow; showActions: boolean }) => {
    const ride = booking.ride;
    if (!ride || !ride.driver) return null;

    const isCurrent =
      ride.status !== 'completed' &&
      booking.status !== 'cancelled_by_driver' &&
      booking.status !== 'cancelled_by_passenger';
    const isCancelled =
      booking.status === 'cancelled_by_driver' || booking.status === 'cancelled_by_passenger';

    const statusLabel = isCurrent
      ? 'Active'
      : ride.status === 'completed'
      ? 'Completed'
      : 'Cancelled';

    // whether the user has already submitted feedback
    const hasFeedback = !!booking.feedback;

    const [localRating, setLocalRating] = useState<number>(booking.feedback?.rating ?? 0);
    const [localFeedback, setLocalFeedback] = useState<string>(booking.feedback?.feedback || '');

    const submitLocalRating = async () => {
      if (!localRating) return;
      try {
        const { data: authData, error: authError } = await supabase.auth.getUser();
        if (authError) throw authError;
        const user = authData.user;
        if (!user) throw new Error('User not logged in');

        await supabase.from('ride_feedback').insert({
          ride_id: ride.id,
          passenger_id: user.id,
          driver_id: ride.driver.id,
          rating: localRating,
          feedback: localFeedback || null,
        });

        // update booking state locally
        setBookings((prev) =>
          prev.map((b) =>
            b.id === booking.id ? { ...b, feedback: { rating: localRating, feedback: localFeedback || null } } : b,
          ),
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to submit rating.';
        setError(msg);
      }
    };

    return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-200 dark:border-gray-700 shadow-sm">
      {/* Driver Info */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-14 h-14 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white font-semibold text-lg">
            {(ride.driver.full_name ?? 'D').charAt(0)}
          </div>
          <div>
            <h3 className="font-semibold text-lg text-gray-900 dark:text-white">
              {ride.driver.full_name ?? 'Driver'}
            </h3>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1">
                <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                <span className="text-sm font-medium text-gray-900 dark:text-white">
                  {ride.driver.driver_rating_avg?.toFixed(1) ?? 'New'}
                </span>
              </div>
              {ride.driver.driver_rating_count ? (
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  ({ride.driver.driver_rating_count})
                </span>
              ) : null}
            </div>
          </div>
        </div>
        <Badge
          className={
            ride.status === 'current'
              ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 border-0'
              : ride.status === 'completed'
              ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 border-0'
              : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-0'
          }
        >
          {statusLabel}
        </Badge>
      </div>

      {/* Route Details */}
      <div className="space-y-3 mb-4">
        <div className="flex items-start gap-3">
          <MapPin className="w-5 h-5 text-[#00C853] mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm text-gray-500 dark:text-gray-400">From</p>
            <p className="font-medium text-gray-900 dark:text-white">{ride.from_location}</p>
          </div>
        </div>
        <div className="flex items-start gap-3">
          <MapPin className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm text-gray-500 dark:text-gray-400">To</p>
            <p className="font-medium text-gray-900 dark:text-white">{ride.to_location}</p>
          </div>
        </div>
      </div>

      {/* Date & Time */}
      <div className="flex items-center gap-4 mb-4 text-sm text-gray-600 dark:text-gray-300">
        <div className="flex items-center gap-1">
          <Calendar className="w-4 h-4" />
          <span>
            {new Date(ride.departure_time).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            })}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <Clock className="w-4 h-4" />
          <span>
            {new Date(ride.departure_time).toLocaleTimeString(undefined, {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </span>
        </div>
      </div>

      {/* Price */}
      <div className="flex items-center justify-between pt-4 border-t border-gray-200 dark:border-gray-700">
        <div>
          <p className="text-xs text-gray-600 dark:text-gray-300 mb-1">Wallet points needed</p>
          <p className="text-2xl font-bold text-[#00C853]">{booking.points_required} Points</p>
        </div>

        {/* Actions */}
        {showActions && isCurrent && (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => handleCallDriver('')}
              className="flex items-center gap-2 dark:border-gray-700 dark:text-gray-300"
            >
              <Phone className="w-4 h-4" />
              Call
            </Button>
            <Button
              variant="solid"
              onClick={() => handleCancelRide(booking.id)}
              className="flex items-center gap-2 bg-red-600 text-white hover:bg-red-700"
            >
              <X className="w-4 h-4" />
              Cancel
            </Button>
          </div>
        )}

        {/* post-completion rating area */}
        {ride.status === 'completed' && (
          <div className="mt-4">
            {hasFeedback ? (
              <div className="space-y-2">
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star
                      key={star}
                      className={`w-4 h-4 ${star <= (booking.feedback?.rating ?? 0) ? 'fill-amber-400 text-amber-400' : 'text-gray-300 dark:text-gray-600'}`}
                    />
                  ))}
                </div>
                {booking.feedback?.feedback && (
                  <p className="text-sm text-gray-700 dark:text-gray-300">
                    {booking.feedback.feedback}
                  </p>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm font-medium">Rate &amp; review your driver</p>
                <div className="flex items-center gap-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      onClick={() => setLocalRating(star)}
                      className="transition-transform hover:scale-110"
                    >
                      <Star
                        className={`w-6 h-6 ${star <= localRating ? 'fill-amber-400 text-amber-400' : 'text-gray-300 dark:text-gray-600'}`}
                      />
                    </button>
                  ))}
                </div>
                <Input
                  placeholder="Leave feedback (optional)"
                  value={localFeedback}
                  onChange={(e) => setLocalFeedback(e.target.value)}
                />
                <Button
                  size="sm"
                  disabled={localRating === 0}
                  onClick={submitLocalRating}
                  className="bg-[#00C853] text-white"
                >
                  Submit
                </Button>
              </div>
            )}
          </div>
        )}

        {showActions && isCancelled && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600 dark:text-gray-400">
              {booking.status === 'cancelled_by_driver'
                ? 'Cancelled by driver'
                : 'Cancelled by you'}
            </span>
          </div>
        )}
      </div>

      {/* Info (Current rides) */}
      {isCurrent && (
        <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl">
          <p className="text-sm text-gray-700 dark:text-gray-300 flex items-center gap-2">
            <Phone className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            Points reserved for this ride:{' '}
            <span className="font-semibold">{booking.points_required}</span>
          </p>
        </div>
      )}
    </div>
  );
  };

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-500 to-blue-600 px-4 pt-6 pb-8">
        <div className="max-w-screen-xl mx-auto">
          <h1 className="text-2xl md:text-3xl font-bold text-white mb-2">Your Rides</h1>
          <p className="text-blue-100">Track and manage your rides</p>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-screen-xl mx-auto px-4 -mt-4">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="w-full bg-white dark:bg-gray-800 rounded-t-2xl shadow-lg border-x border-t border-gray-200 dark:border-gray-700 h-14">
            <TabsTrigger value="current" className="flex-1 text-base data-[state=active]:bg-blue-50 dark:data-[state=active]:bg-blue-900/30 data-[state=active]:text-blue-600 dark:data-[state=active]:text-blue-400">
              Current Ride
            </TabsTrigger>
            <TabsTrigger value="past" className="flex-1 text-base data-[state=active]:bg-blue-50 dark:data-[state=active]:bg-blue-900/30 data-[state=active]:text-blue-600 dark:data-[state=active]:text-blue-400">
              Past Rides
            </TabsTrigger>
          </TabsList>

          <TabsContent value="current" className="mt-0">
            <div className="bg-white dark:bg-gray-800 rounded-b-2xl shadow-lg border-x border-b border-gray-200 dark:border-gray-700 p-6">
              {loading ? (
                <div className="text-center py-12">
                  <p className="text-gray-600 dark:text-gray-400">Loading your rides…</p>
                </div>
              ) : currentBookings.length === 0 ? (
                <div className="text-center py-12">
                  <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
                    <User className="w-8 h-8 text-gray-400 dark:text-gray-500" />
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">No active rides</h3>
                  <p className="text-gray-600 dark:text-gray-400">Book a ride to get started</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {currentBookings.map((booking) => (
                    <RideCard key={booking.id} booking={booking} showActions={true} />
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
              ) : pastBookings.length === 0 ? (
                <div className="text-center py-12">
                  <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Clock className="w-8 h-8 text-gray-400 dark:text-gray-500" />
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">No past rides</h3>
                  <p className="text-gray-600 dark:text-gray-400">Your ride history will appear here</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {pastBookings.map((booking) => (
                    <RideCard key={booking.id} booking={booking} showActions={true} />
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
