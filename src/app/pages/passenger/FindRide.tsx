import { useEffect, useMemo, useState } from 'react';
import { Search, MapPin, Calendar, Clock, Filter, Leaf, Star, ShieldCheck, Users } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Badge } from '../../components/ui/badge';
import { supabase } from '../../../lib/supabase';

interface RideRow {
  id: string;
  from_location: string;
  to_location: string;
  departure_time: string;
  distance_km: number | null;
  total_seats: number;
  vacant_seats: number;
  fuel_price: number | null;
  mileage_kmpl: number | null;
  women_only: boolean;
  non_smoker_only: boolean;
  estimated_total_points: number | null;
  driver: {
    id: string;
    full_name: string | null;
    driver_rating_avg: number | null;
    driver_rating_count: number;
    gender: string | null;
    is_smoker: boolean;
    verified_at: string | null;
  } | null;
}

export default function PassengerFindRide() {
  const [searchParams, setSearchParams] = useState({
    from: '',
    to: '',
    date: '',
    time: '',
  });
  const [rides, setRides] = useState<RideRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [womenOnlyFilter, setWomenOnlyFilter] = useState(false);
  const [nonSmokerFilter, setNonSmokerFilter] = useState(false);
  const [passengerDistanceKm, setPassengerDistanceKm] = useState<number | null>(null);

  const [walletBalance, setWalletBalance] = useState<number | null>(null);

  // helper to extract message from Supabase/Postgrest error objects
  const extractMessage = (err: unknown, fallback: string) => {
    if (err instanceof Error) return err.message;
    if (err && typeof err === 'object' && 'message' in err) {
      return (err as any).message as string;
    }
    return fallback;
  };
  useEffect(() => {
    let cancelled = false;

    async function loadWallet() {
      try {
        const { data: authData, error: authError } = await supabase.auth.getUser();
        if (authError) throw authError;
        const user = authData.user;
        if (!user) return;

        const { data: wallet, error: walletError } = await supabase
          .from('wallets')
          .select('balance_points')
          .eq('profile_id', user.id)
          .maybeSingle();

        if (walletError) throw walletError;
        if (!cancelled) {
          setWalletBalance(wallet?.balance_points ?? 0);
        }
      } catch {
        // ignore wallet errors in search UI
      }
    }

    void loadWallet();
    return () => {
      cancelled = true;
    };
  }, []);

  const searchRides = async () => {
    setError(null);
    setLoading(true);
    try {
      const { data, error: ridesError } = await supabase
        .from('rides')
        .select(
          `
          id,
          from_location,
          to_location,
          departure_time,
          distance_km,
          total_seats,
          vacant_seats,
          fuel_price,
          mileage_kmpl,
          women_only,
          non_smoker_only,
          estimated_total_points,
          driver:driver_id (
            id,
            full_name,
            driver_rating_avg,
            driver_rating_count,
            gender,
            is_smoker,
            verified_at
          )
        `,
        )
        .eq('status', 'scheduled')
        .gte('vacant_seats', 1)
        .order('departure_time', { ascending: true });

      if (ridesError) throw ridesError;

      const filtered = (data ?? []).filter((ride) => {
        const matchesFrom =
          !searchParams.from ||
          ride.from_location.toLowerCase().includes(searchParams.from.toLowerCase());
        const matchesTo =
          !searchParams.to ||
          ride.to_location.toLowerCase().includes(searchParams.to.toLowerCase());
        const matchesWomen = !womenOnlyFilter || ride.women_only;
        const matchesNonSmoker = !nonSmokerFilter || ride.non_smoker_only;
        return matchesFrom && matchesTo && matchesWomen && matchesNonSmoker;
      });

      setRides(filtered as RideRow[]);
    } catch (err) {
      const msg = extractMessage(err, 'Failed to load rides.');
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const computePointsNeeded = (ride: RideRow): number | null => {
    if (!passengerDistanceKm || !ride.fuel_price || !ride.mileage_kmpl || !ride.total_seats) {
      return null;
    }
    const raw =
      (ride.fuel_price * passengerDistanceKm) / (ride.total_seats * ride.mileage_kmpl);
    return Math.max(0, Math.floor(raw));
  };

  const handleBook = async (ride: RideRow) => {
    setError(null);
    if (!passengerDistanceKm || passengerDistanceKm <= 0) {
      setError('Select a valid route so we can calculate distance first.');
      return;
    }

    try {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      const user = authData.user;
      if (!user) throw new Error('You must be logged in to book a ride.');

      const pointsNeeded = computePointsNeeded(ride);
      if (!pointsNeeded || pointsNeeded <= 0) {
        throw new Error('Unable to calculate wallet points for this ride.');
      }

      const effectiveBalance = walletBalance;
      if (effectiveBalance !== null && effectiveBalance < pointsNeeded) {
        throw new Error('Not enough wallet points. Please recharge your wallet first.');
      }

      // re-check vacant seats on the server to avoid stale UI causing a confusing
      // "Not enough vacant seats" exception from the DB trigger. This is not
      // perfectly race-free, but it reduces spurious failures and shows a
      // clearer message to the user when seats truly aren't available.
      const { data: latestRide, error: latestRideError } = await supabase
        .from('rides')
        .select('vacant_seats')
        .eq('id', ride.id)
        .maybeSingle();

      if (latestRideError) throw latestRideError;
      const latestVacant = (latestRide as any)?.vacant_seats;
      // log for diagnostics; helps determine if race occurs very quickly or
      // the value unexpectedly comes back null/undefined.
      // eslint-disable-next-line no-console
      console.log('latest vacant seats before booking', latestVacant);
      if (latestVacant === null || latestVacant === undefined) {
        // don't block the booking; the RPC itself will enforce correctness. We
        // log a warning so we can investigate data anomalies server‑side.
        // eslint-disable-next-line no-console
        console.warn('vacant_seats returned null/undefined, skipping early check');
      } else if (latestVacant < 1) {
        throw new Error(`Not enough vacant seats for this ride (available: ${latestVacant}).`);
      }

      // atomic booking using RPC; avoids race where seats disappear between
      // the previous select and the insert.  the stored procedure throws the
      // same 22000 error when seats are insufficient.
      const { data: booking, error: rpcError } = await supabase.rpc('book_ride', {
        p_ride_id: ride.id,
        p_passenger_id: user.id,
        p_seats: 1,
        p_distance: passengerDistanceKm,
        p_points: pointsNeeded,
      });

      if (rpcError) {
        console.error('booking rpc failed', {
          ride_id: ride.id,
          passenger_id: user.id,
          passengerDistanceKm,
          pointsNeeded,
          error: JSON.stringify(rpcError, null, 2),
        });

        // log the current seat count after the failure to help diagnose races
        const { data: postRide, error: postError } = await supabase
          .from('rides')
          .select('vacant_seats')
          .eq('id', ride.id)
          .maybeSingle();
        // eslint-disable-next-line no-console
        console.log('vacant seats after rpc failure', postRide?.vacant_seats, postError);

        // if the RPC says the ride doesn't exist, the most likely causes are
        // RLS blocking or the ride got deleted/cancelled. we already refresh
        // the list below for seat errors; treat this similarly so the UI stays
        // in sync and the user sees a helpful message.
        if (
          rpcError.message &&
          rpcError.message.toLowerCase().includes('ride does not exist')
        ) {
          await searchRides();
          setError('Sorry, that ride is no longer available.');
          return;
        }
        throw rpcError;
      }
      if (!booking) throw new Error('Failed to create booking.');

      if (ride.driver?.id) {
        await supabase.from('notifications').insert({
          user_id: ride.driver.id,
          type: 'booking_created',
          title: 'New booking',
          body: 'A passenger booked a seat on your ride.',
          related_ride_id: ride.id,
          related_booking_id: booking.id,
        });
      }

      await searchRides();
    } catch (err) {
      const msg = extractMessage(err, 'Failed to book ride.');
      // if the database trigger reports a seat shortage, refresh the list
      // because the UI may be stale and the ride is no longer available.
      if (msg.toLowerCase().includes('not enough vacant seats')) {
        // race or stale UI: the server saw 0 seats available when the rpc
        // executed, even if our earlier check showed >0. reloading the list
        // keeps the UI in sync and ensures the seat count is updated.
        await searchRides();

        const friendly =
          'Sorry, this ride just filled up. Please try another one.';
        // eslint-disable-next-line no-console
        console.warn('booking failure due to seats:', msg);
        setError(friendly);
        return;
      }
      setError(msg);
    }
  };

  const ridesWithPoints = useMemo(
    () =>
      rides.map((ride) => ({
        ride,
        pointsNeeded: computePointsNeeded(ride),
      })),
    [rides, passengerDistanceKm],
  );

  // helper to decide if a ride should be visible given the current search
  // parameters and filters. used for the realtime subscription below.
  const matchesFilters = (ride: RideRow) => {
    if (ride.status !== 'scheduled' || ride.vacant_seats < 1) return false;
    if (womenOnlyFilter && !ride.women_only) return false;
    if (nonSmokerFilter && !ride.non_smoker_only) return false;
    if (
      searchParams.from &&
      !ride.from_location.toLowerCase().includes(searchParams.from.toLowerCase())
    )
      return false;
    if (
      searchParams.to &&
      !ride.to_location.toLowerCase().includes(searchParams.to.toLowerCase())
    )
      return false;
    return true;
  };

  // realtime updates for rides that match the current query. this keeps the
  // list in sync if another passenger books or a driver modifies a ride.
  useEffect(() => {
    const channel = supabase
      .channel('rides_list')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'rides' },
        (payload) => {
          const ride = payload.new as RideRow;
          if (matchesFilters(ride)) {
            setRides((prev) => [...prev.filter((r) => r.id !== ride.id), ride]);
          }
        },
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'rides' },
        (payload) => {
          const ride = payload.new as RideRow;
          setRides((prev) => {
            const filtered = prev.filter((r) => r.id !== ride.id);
            if (matchesFilters(ride)) {
              filtered.push(ride);
            }
            return filtered;
          });
        },
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'rides' },
        (payload) => {
          const ride = payload.old as RideRow;
          setRides((prev) => prev.filter((r) => r.id !== ride.id));
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [searchParams, womenOnlyFilter, nonSmokerFilter]);

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="bg-gradient-to-r from-[#00C853] to-emerald-600 px-4 pt-6 pb-8">
        <div className="max-w-screen-xl mx-auto">
          <h1 className="text-2xl md:text-3xl font-bold text-white mb-2">Find a Ride</h1>
          <p className="text-emerald-100">Search for available rides</p>
        </div>
      </div>

      {/* Search Form */}
      <div className="max-w-screen-xl mx-auto px-4 -mt-4">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6 border border-gray-200 dark:border-gray-700">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div className="space-y-2">
              <Label htmlFor="from" className="text-gray-700 dark:text-gray-300">From</Label>
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#00C853]" />
                <Input
                  id="from"
                  placeholder="Pickup location"
                  value={searchParams.from}
                  onChange={(e) => setSearchParams({ ...searchParams, from: e.target.value })}
                  className="pl-10 h-12 dark:bg-gray-900 dark:border-gray-700 dark:text-white"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="to" className="text-gray-700 dark:text-gray-300">To</Label>
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-red-500" />
                <Input
                  id="to"
                  placeholder="Drop-off location"
                  value={searchParams.to}
                  onChange={(e) => setSearchParams({ ...searchParams, to: e.target.value })}
                  className="pl-10 h-12 dark:bg-gray-900 dark:border-gray-700 dark:text-white"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="date" className="text-gray-700 dark:text-gray-300">Date</Label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <Input
                  id="date"
                  type="date"
                  value={searchParams.date}
                  onChange={(e) => setSearchParams({ ...searchParams, date: e.target.value })}
                  className="pl-10 h-12 dark:bg-gray-900 dark:border-gray-700 dark:text-white"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="time" className="text-gray-700 dark:text-gray-300">Time</Label>
              <div className="relative">
                <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <Input
                  id="time"
                  type="time"
                  value={searchParams.time}
                  onChange={(e) => setSearchParams({ ...searchParams, time: e.target.value })}
                  className="pl-10 h-12 dark:bg-gray-900 dark:border-gray-700 dark:text-white"
                />
              </div>
            </div>
          </div>

          {/* Map + distance helper disabled */}
          {/* RouteMap moved to manual input below */}

          {/* Manual estimated distance input (used in wallet calculation) */}
          <div className="mt-4 max-w-xs space-y-1">
            <Label htmlFor="estimatedDistance" className="text-gray-700 dark:text-gray-300">
              Estimated distance for your trip (km)
            </Label>
            <Input
              id="estimatedDistance"
              type="number"
              min="1"
              step="0.1"
              value={passengerDistanceKm ?? ''}
              onChange={(e) => {
                const value = parseFloat(e.target.value);
                setPassengerDistanceKm(Number.isFinite(value) && value > 0 ? value : null);
              }}
              className="h-11 dark:bg-gray-900 dark:border-gray-700 dark:text-white"
              placeholder="e.g. 12.5"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400">
              This distance is used to calculate wallet points for each ride you book.
            </p>
          </div>

          <Button
            type="button"
            onClick={searchRides}
            disabled={loading}
            className="mt-4 w-full h-12 bg-gradient-to-r from-[#00C853] to-emerald-600 hover:from-emerald-600 hover:to-[#00C853] text-white"
          >
            <Search className="w-5 h-5 mr-2" />
            {loading ? 'Searching…' : 'Search Rides'}
          </Button>

          {error && (
            <div className="mt-3 rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 px-4 py-3 text-sm text-red-700 dark:text-red-300">
              {error}
            </div>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="max-w-screen-xl mx-auto px-4 mt-6">
        <div className="flex items-center gap-3 overflow-x-auto pb-2">
          <Button variant="outline" size="sm" className="flex-shrink-0 dark:border-gray-700 dark:text-gray-300">
            <Filter className="w-4 h-4 mr-2" />
            Filters
          </Button>
          <Button
            variant={womenOnlyFilter ? 'default' : 'outline'}
            size="sm"
            onClick={() => setWomenOnlyFilter((v) => !v)}
            className="flex-shrink-0 dark:border-gray-700 dark:text-gray-300"
          >
            Women only
          </Button>
          <Button
            variant={nonSmokerFilter ? 'default' : 'outline'}
            size="sm"
            onClick={() => setNonSmokerFilter((v) => !v)}
            className="flex-shrink-0 dark:border-gray-700 dark:text-gray-300"
          >
            Non-smoker
          </Button>
          <Button variant="outline" size="sm" className="flex-shrink-0 dark:border-gray-700 dark:text-gray-300">
            <Leaf className="w-4 h-4 mr-2" />
            Eco-Friendly
          </Button>
          <Button variant="outline" size="sm" className="flex-shrink-0 dark:border-gray-700 dark:text-gray-300">
            Lowest Price
          </Button>
          <Button variant="outline" size="sm" className="flex-shrink-0 dark:border-gray-700 dark:text-gray-300">
            Highest Rating
          </Button>
        </div>
      </div>

      {/* Results */}
      <div className="max-w-screen-xl mx-auto px-4 mt-6 space-y-4">
        <div className="flex items-baseline justify-between">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            {ridesWithPoints.length} rides available
          </h2>
          {walletBalance !== null && (
            <p className="text-sm text-gray-600 dark:text-gray-300">
              Wallet balance:{' '}
              <span className="font-semibold text-[#00C853]">{walletBalance} pts</span>
            </p>
          )}
        </div>

        {ridesWithPoints.map(({ ride, pointsNeeded }) => (
          <div
            key={ride.ride_id ?? ride.ride?.id ?? ride.id}
            className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-md transition-shadow"
          >
            {/* Driver Info */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white font-semibold">
                  {(ride.driver?.full_name ?? 'D').charAt(0)}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-gray-900 dark:text-white">
                      {ride.driver?.full_name ?? 'Driver'}
                    </h3>
                    {ride.driver?.verified_at && (
                      <Badge variant="secondary" className="bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs">
                        <ShieldCheck className="w-3 h-3 mr-1" />
                        Verified
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                      {ride.driver?.driver_rating_avg?.toFixed(1) ?? 'New'}
                    </span>
                    {ride.driver?.driver_rating_count ? (
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        ({ride.driver.driver_rating_count})
                      </span>
                    ) : null}
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      • {ride.total_seats - ride.vacant_seats}/{ride.total_seats} seats filled
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex flex-col items-end gap-1">
                {ride.women_only && (
                  <Badge className="bg-pink-100 dark:bg-pink-900/30 text-pink-700 dark:text-pink-300 border-0 text-xs">
                    Women only
                  </Badge>
                )}
                {ride.non_smoker_only && (
                  <Badge className="bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 border-0 text-xs">
                    Non-smoker
                  </Badge>
                )}
                <Badge className="bg-emerald-100 dark:bg-emerald-900/30 text-[#00C853] dark:text-emerald-400 border-0">
                  <Users className="w-3 h-3 mr-1" />
                  {ride.vacant_seats} seats left
                </Badge>
              </div>
            </div>

            {/* Route */}
            <div className="space-y-3 mb-4">
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
            </div>

            {/* Details */}
            <div className="flex items-center justify-between pt-4 border-t border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-300">
                  <Clock className="w-4 h-4" />
                  <span>
                    {new Date(ride.departure_time).toLocaleString(undefined, {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-300">
                  {ride.vacant_seats} seats available
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Wallet points needed (for your trip)
                  </p>
                  <p className="text-2xl font-bold text-[#00C853]">
                    {pointsNeeded !== null ? pointsNeeded : '—'}
                  </p>
                </div>
                <Button
                  className="bg-[#00C853] hover:bg-emerald-600 text-white"
                  onClick={() => handleBook(ride)}
                  disabled={pointsNeeded === null || loading}
                >
                  Book
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
