import { useEffect, useMemo, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, MapPin, Calendar, Clock, Filter, Leaf, Star, ShieldCheck, Users, Car, Coins, Gauge } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Badge } from '../../components/ui/badge';
import { supabase } from '../../../lib/supabase';
import { MapContainer, TileLayer, CircleMarker, Popup, Polyline, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import DriverAvatar from '../../components/DriverAvatar';

interface RideRow {
  id: string;
  from_location: string;
  to_location: string;
  from_lat: number | null;
  from_lng: number | null;
  to_lat: number | null;
  to_lng: number | null;
  departure_time: string;
  arrival_time: string | null;
  distance_km: number | null;
  total_seats: number;
  vacant_seats: number;
  fuel_price: number | null;
  mileage_kmpl: number | null;
  women_only: boolean;
  non_smoker_only: boolean;
  estimated_total_points: number | null;
  status: string;
  vehicle_company: string | null;
  vehicle_model: string | null;
  vehicle_color: string | null;
  vehicle_registration: string | null;
  driver: {
    id: string;
    full_name: string | null;
    driver_rating_avg: number | null;
    driver_rating_count: number;
    gender: string | null;
    is_smoker: boolean;
    verified_at: string | null;
    avatar_path: string | null;
  } | null;
}

export default function PassengerFindRide() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useState({
    from: '',
    to: '',
    date: '',
    time: '',
    seats: 1,
  });
  const [allRides, setAllRides] = useState<RideRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [womenOnlyFilter, setWomenOnlyFilter] = useState(false);
  const [nonSmokerFilter, setNonSmokerFilter] = useState(false);
  const [passengerDistanceKm, setPassengerDistanceKm] = useState<number | null>(null);
  const [routePath, setRoutePath] = useState<[number, number][]>([]);
  const [mapBounds, setMapBounds] = useState<L.LatLngBoundsExpression | null>(null);
  const [hasValidProfile, setHasValidProfile] = useState<boolean | null>(null);

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

  useEffect(() => {
    async function checkProfile() {
      const { data: authData } = await supabase.auth.getUser();
      if (!authData.user) return;

      const { data } = await supabase
        .from('profiles')
        .select('gender')
        .eq('id', authData.user.id)
        .single();

      if (!data?.gender) {
        setHasValidProfile(false);
        setError('You must complete your profile (gender) in the Account section before finding or booking a ride.');
      } else {
        setHasValidProfile(true);
      }
    }
    void checkProfile();
  }, []);

  const sortRides = useCallback(
    (ridesToSort: RideRow[]) => {
      const arr = [...ridesToSort];
      if (searchParams.time) {
        const [searchHours, searchMinutes] = searchParams.time.split(':').map(Number);
        
        arr.sort((a, b) => {
          const dateA = new Date(a.departure_time);
          const dateB = new Date(b.departure_time);
          
          const targetA = new Date(dateA);
          targetA.setHours(searchHours, searchMinutes, 0, 0);
          
          const targetB = new Date(dateB);
          targetB.setHours(searchHours, searchMinutes, 0, 0);
          
          const diffA = Math.abs(dateA.getTime() - targetA.getTime());
          const diffB = Math.abs(dateB.getTime() - targetB.getTime());
          
          if (diffA === diffB) {
             return dateA.getTime() - dateB.getTime();
          }
          return diffA - diffB;
        });
      } else {
        arr.sort((a, b) => new Date(a.departure_time).getTime() - new Date(b.departure_time).getTime());
      }
      return arr;
    },
    [searchParams.time]
  );

  const rides = useMemo(() => {
    const filtered = allRides.filter((ride) => {
      const matchesFrom =
        !searchParams.from ||
        ride.from_location.toLowerCase().includes(searchParams.from.toLowerCase());
      const matchesTo =
        !searchParams.to ||
        ride.to_location.toLowerCase().includes(searchParams.to.toLowerCase());
      const matchesWomen = !womenOnlyFilter || ride.driver?.gender === 'female';
      const matchesNonSmoker = !nonSmokerFilter || !ride.driver?.is_smoker;
      return matchesFrom && matchesTo && matchesWomen && matchesNonSmoker;
    });
    return sortRides(filtered);
  }, [allRides, searchParams.from, searchParams.to, womenOnlyFilter, nonSmokerFilter, sortRides]);

  const searchRides = async () => {
    if (hasValidProfile === false) {
      setError('You must complete your profile (gender) in the Account section before finding or booking a ride.');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      let query = supabase
        .from('rides')
        .select(
          `
          id,
          from_location,
          to_location,
          from_lat,
          from_lng,
          to_lat,
          to_lng,
          departure_time,
          arrival_time,
          distance_km,
          total_seats,
          vacant_seats,
          fuel_price,
          mileage_kmpl,
          women_only,
          non_smoker_only,
          estimated_total_points,
          status,
          vehicle_company,
          vehicle_model,
          vehicle_color,
          vehicle_registration,
          driver:driver_id (
            id,
            full_name,
            driver_rating_avg,
            driver_rating_count,
            gender,
            is_smoker,
            verified_at,
            avatar_path
          )
        `,
        )
        .eq('status', 'scheduled')
        .gte('vacant_seats', Math.max(1, searchParams.seats || 1));

      if (searchParams.date) {
        const startOfDay = new Date(`${searchParams.date}T00:00:00`);
        const endOfDay = new Date(`${searchParams.date}T23:59:59.999`);
        const now = new Date();
        const effectiveStart = startOfDay < now ? now : startOfDay;
        
        query = query
          .gte('departure_time', effectiveStart.toISOString())
          .lte('departure_time', endOfDay.toISOString());
      } else {
        query = query.gte('departure_time', new Date().toISOString());
      }

      const { data, error: ridesError } = await query;

      if (ridesError) throw ridesError;

      const rows = (data ?? []) as unknown as RideRow[];
      setAllRides(rows);
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
    const seats = Math.max(1, searchParams.seats || 1);
    const raw = ((ride.fuel_price * passengerDistanceKm) / (ride.total_seats * ride.mileage_kmpl)) * seats;
    return Math.max(0, Math.floor(raw));
  };

  const handleBook = async (ride: RideRow) => {
    if (hasValidProfile === false) {
      setError('You must complete your profile (gender) in the Account section before finding or booking a ride.');
      return;
    }
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

      const seatsToBook = Math.max(1, searchParams.seats || 1);

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
      } else if (latestVacant < seatsToBook) {
        throw new Error(`Not enough vacant seats for this ride (available: ${latestVacant}, requested: ${seatsToBook}).`);
      }

      // atomic booking using RPC; avoids race where seats disappear between
      // the previous select and the insert.  the stored procedure throws the
      // same 22000 error when seats are insufficient.
      const { data: booking, error: rpcError } = await supabase.rpc('book_ride', {
        p_ride_id: ride.id,
        p_passenger_id: user.id,
        p_seats: seatsToBook,
        p_distance: passengerDistanceKm,
        p_points: pointsNeeded,
        p_pickup_location: searchParams.from,
        p_dropoff_location: searchParams.to,
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
        const { error: driverNotifError } = await supabase.from('notifications').insert({
          user_id: ride.driver.id,
          type: 'booking_created',
          title: 'New booking',
          body: 'A passenger booked a seat on your ride.',
          related_ride_id: ride.id,
          related_booking_id: booking.id,
        });
        if (driverNotifError) {
          // should never happen but log to console if it does
          // eslint-disable-next-line no-console
          console.error('driver notification insert failed', driverNotifError);
        }
      }

      // also give the passenger a note that the booking succeeded
      const { error: passengerNotifError } = await supabase.from('notifications').insert({
        user_id: user.id,
        type: 'booking_created',
        title: 'Booking confirmed',
        body: `Your booking for ${seatsToBook} seat(s) has been confirmed.`,
        related_ride_id: ride.id,
        related_booking_id: booking.id,
      });
      if (passengerNotifError) {
        // eslint-disable-next-line no-console
        console.error('passenger notification insert failed', passengerNotifError);
      }

      // refresh the available rides so the seat count is accurate for
      // remaining searches, then send the user to their bookings so they can
      // immediately see the new ride in the “Your Rides” tab.
      await searchRides();
      navigate('/passenger/your-ride');
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
    if (new Date(ride.departure_time) < new Date()) return false;
    if (womenOnlyFilter && ride.driver?.gender !== 'female') return false;
    if (nonSmokerFilter && ride.driver?.is_smoker) return false;
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

    if (searchParams.date) {
      const rideDate = new Date(ride.departure_time);
      const targetDate = new Date(`${searchParams.date}T00:00:00`);
      if (rideDate.getFullYear() !== targetDate.getFullYear() ||
          rideDate.getMonth() !== targetDate.getMonth() ||
          rideDate.getDate() !== targetDate.getDate()) {
        return false;
      }
    }

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
            setAllRides((prev) => sortRides([...prev.filter((r) => r.id !== ride.id), ride]));
          }
        },
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'rides' },
        (payload) => {
          const ride = payload.new as RideRow;
          setAllRides((prev) => {
            const filtered = prev.filter((r) => r.id !== ride.id);
            if (matchesFilters(ride)) {
              filtered.push(ride);
            }
            return sortRides(filtered);
          });
        },
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'rides' },
        (payload) => {
          const ride = payload.old as RideRow;
          setAllRides((prev) => prev.filter((r) => r.id !== ride.id));
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [searchParams, womenOnlyFilter, nonSmokerFilter]);

  const fetchCoordinates = async (query: string) => {
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}`);
      const data = await res.json();
      if (data && data.length > 0) return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
    } catch (e) {
      console.error("Geocoding error", e);
    }
    return null;
  };

  const calculateRoute = async () => {
    if (!searchParams.from || !searchParams.to) return;
    
    const start = await fetchCoordinates(searchParams.from);
    const end = await fetchCoordinates(searchParams.to);
    
    if (start && end) {
      try {
        const res = await fetch(`https://router.project-osrm.org/route/v1/driving/${start.lon},${start.lat};${end.lon},${end.lat}?overview=full&geometries=geojson`);
        const data = await res.json();
        if (data.routes && data.routes.length > 0) {
          const route = data.routes[0];
          const distKm = parseFloat((route.distance / 1000).toFixed(1));
          setPassengerDistanceKm(distKm);
          
          const coords = route.geometry.coordinates.map((c: number[]) => [c[1], c[0]] as [number, number]);
          setRoutePath(coords);
          setMapBounds(L.latLngBounds([start.lat, start.lon], [end.lat, end.lon]));
        }
      } catch (e) {
        console.error("Routing error", e);
      }
    }
  };

  const MapUpdater = ({ bounds }: { bounds: L.LatLngBoundsExpression | null }) => {
    const map = useMap();
    useEffect(() => {
      if (bounds) map.fitBounds(bounds, { padding: [50, 50] });
    }, [bounds, map]);
    return null;
  };

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
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Left Column: Input Fields */}
            <div className="flex flex-col space-y-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="from" className="text-gray-700 dark:text-gray-300">From</Label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#00C853]" />
                    <Input
                      id="from"
                      placeholder="Pickup location"
                      value={searchParams.from}
                      onChange={(e) => setSearchParams({ ...searchParams, from: e.target.value })}
                      onBlur={calculateRoute}
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
                      onBlur={calculateRoute}
                      className="pl-10 h-12 dark:bg-gray-900 dark:border-gray-700 dark:text-white"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
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

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="seats" className="text-gray-700 dark:text-gray-300">Seats needed</Label>
                    <div className="relative">
                      <Users className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                      <Input
                        id="seats"
                        type="number"
                        min="1"
                        max="6"
                        value={searchParams.seats}
                        onChange={(e) => setSearchParams({ ...searchParams, seats: parseInt(e.target.value) || 1 })}
                        className="pl-10 h-12 dark:bg-gray-900 dark:border-gray-700 dark:text-white"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="estimatedDistance" className="text-gray-700 dark:text-gray-300">
                      Est. distance (km)
                    </Label>
                    <Input
                      id="estimatedDistance"
                      type="number"
                      min="0.1"
                      step="any"
                      value={passengerDistanceKm ?? ''}
                      readOnly
                      className="h-12 dark:bg-gray-900 dark:border-gray-700 dark:text-white bg-gray-100 dark:bg-gray-800 cursor-not-allowed"
                      placeholder="Auto calculated"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-2">
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                  Distance is used to calculate wallet points for each ride you book.
                </p>
                <Button
                  type="button"
                  onClick={searchRides}
                  disabled={loading || hasValidProfile === false}
                  className="w-full h-12 bg-gradient-to-r from-[#00C853] to-emerald-600 hover:from-emerald-600 hover:to-[#00C853] text-white"
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

            {/* Right Column: Map */}
            <div className="flex flex-col space-y-4 min-h-[320px] lg:min-h-[400px]">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <MapPin className="w-5 h-5 text-[#00C853]" />
                Map Overview
              </h2>
              <div className="flex-1 w-full rounded-xl overflow-hidden z-0 relative border border-gray-200 dark:border-gray-700">
                <MapContainer center={[20.5937, 78.9629]} zoom={5} scrollWheelZoom={false} className="absolute inset-0 h-full w-full">
                  <TileLayer
                    attribution="© OpenStreetMap contributors"
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />
                  {rides.map((ride) =>
                    ride.from_lat && ride.from_lng ? (
                      <CircleMarker key={ride.id} center={[ride.from_lat, ride.from_lng]} radius={8} fillOpacity={0.5} color="#00C853">
                        <Popup>
                          {ride.from_location} to {ride.to_location}
                        </Popup>
                      </CircleMarker>
                    ) : null
                  )}
                  {routePath.length > 0 && <Polyline positions={routePath} color="#3b82f6" weight={5} />}
                  {routePath.length > 0 && (
                    <CircleMarker center={routePath[0]} radius={6} color="blue" fillOpacity={1} />
                  )}
                  {routePath.length > 0 && (
                    <CircleMarker center={routePath[routePath.length - 1]} radius={6} color="red" fillOpacity={1} />
                  )}
                  <MapUpdater bounds={mapBounds} />
                </MapContainer>
              </div>
            </div>
          </div>
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
            key={ride.id}
            className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-md transition-shadow"
          >
            {/* Driver Info */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <DriverAvatar path={ride.driver?.avatar_path ?? null} name={ride.driver?.full_name ?? 'D'} />
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
                    {ride.driver?.gender ? (
                      <Badge variant="secondary" className="capitalize text-xs font-normal bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-0">
                        {ride.driver.gender}
                      </Badge>
                    ) : null}
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      • {ride.total_seats - ride.vacant_seats}/{ride.total_seats} seats filled
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex flex-col items-end gap-1">
                {!ride.driver?.is_smoker && (
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

            {/* Route & Ride Details */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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

              <div className="flex flex-col gap-1.5 h-full">
                <div className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-300">
                  <Clock className="w-4 h-4" />
                  <span>
                    <span className="inline-block w-10">Dep:</span> {new Date(ride.departure_time).toLocaleDateString('en-GB')} at{' '}
                    {new Date(ride.departure_time).toLocaleTimeString('en-GB', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
                {ride.arrival_time && (
                  <div className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-300">
                    <Clock className="w-4 h-4 opacity-0" />
                    <span>
                      <span className="inline-block w-10">Arr:</span> {new Date(ride.arrival_time).toLocaleDateString('en-GB')} at{' '}
                      {new Date(ride.arrival_time).toLocaleTimeString('en-GB', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                )}
                <div className="flex items-center gap-4 mt-1 text-sm text-gray-600 dark:text-gray-300">
                  <span className="flex items-center gap-1 font-medium">
                    <Users className="w-4 h-4" />
                    {ride.vacant_seats} seats available
                  </span>
                </div>

                <div className="flex items-center justify-between gap-4 mt-auto pt-4 border-t border-gray-100 dark:border-gray-700/50">
                  <div className="text-left">
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Points needed (for {searchParams.seats} seat{searchParams.seats > 1 ? 's' : ''})
                    </p>
                    <p className="text-2xl font-bold text-[#00C853]">
                      {pointsNeeded !== null ? pointsNeeded : '—'}
                    </p>
                  </div>
                  <Button
                    className="bg-[#00C853] hover:bg-emerald-600 text-white px-8"
                    onClick={() => handleBook(ride)}
                    disabled={pointsNeeded === null || loading || hasValidProfile === false}
                  >
                    Book
                  </Button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
