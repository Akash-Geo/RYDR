import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapPin, Calendar, Clock, Users, Coins } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { supabase } from '../../../lib/supabase';
import { MapContainer, TileLayer, Polyline, CircleMarker, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

export default function DriverPostRide() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    from: '',
    to: '',
    departureDate: '',
    departureTime: '',
    arrivalDate: '',
    arrivalTime: '',
    seats: 2,
    fuelPrice: 100,
    mileage: 15,
    distanceKm: 10 as number | string,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [routePath, setRoutePath] = useState<[number, number][]>([]);
  const [mapBounds, setMapBounds] = useState<L.LatLngBoundsExpression | null>(null);
  const [hasValidProfile, setHasValidProfile] = useState<boolean | null>(null);
  const [driverProfile, setDriverProfile] = useState<any>(null);

  useEffect(() => {
    async function checkProfile() {
      const { data: authData } = await supabase.auth.getUser();
      if (!authData.user) return;
      
      const { data } = await supabase
        .from('profiles')
        .select('gender, vehicle_registration, vehicle_company, vehicle_model, vehicle_color')
        .eq('id', authData.user.id)
        .single();
        
      if (!data?.gender || !data?.vehicle_registration || !data?.vehicle_company || !data?.vehicle_model || !data?.vehicle_color) {
        setHasValidProfile(false);
        setError('You must complete your profile (gender and vehicle details) in the Account section before posting a ride.');
      } else {
        setHasValidProfile(true);
        setDriverProfile(data);
      }
    }
    void checkProfile();
  }, []);

  const handleChange = (field: string, value: string | number) => {
    setFormData({ ...formData, [field]: value });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void submitRide();
  };

  const submitRide = async () => {
    setError(null);
    setSuccess(null);

    if (!hasValidProfile || !driverProfile) {
      setError('You must complete your profile (gender and vehicle details) in the Account section before posting a ride.');
      return;
    }

    setIsSubmitting(true);
    try {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      const user = authData.user;
      if (!user) throw new Error('You must be logged in to post a ride.');

      // Validate seats
      if (!formData.seats || formData.seats < 1) {
        throw new Error('Seats must be at least 1.');
      }

      const departureIso = new Date(
        `${formData.departureDate}T${formData.departureTime}:00`,
      ).toISOString();
      const arrivalIso =
        formData.arrivalDate && formData.arrivalTime
          ? new Date(`${formData.arrivalDate}T${formData.arrivalTime}:00`).toISOString()
          : null;

      const estimatedTotalPoints =
        Number(formData.mileage) > 0
          ? Math.floor((Number(formData.fuelPrice) * Number(formData.distanceKm)) / Number(formData.mileage))
          : null;

      const { data: rideData, error: insertError } = await supabase
        .from('rides')
        .insert({
          driver_id: user.id,
          from_location: formData.from,
          to_location: formData.to,
          departure_time: departureIso,
          arrival_time: arrivalIso,
          total_seats: formData.seats,
          vacant_seats: formData.seats,
          distance_km: Number(formData.distanceKm),
          fuel_price: Number(formData.fuelPrice),
          mileage_kmpl: Number(formData.mileage),
          estimated_total_points: estimatedTotalPoints,
          vehicle_registration: driverProfile.vehicle_registration,
          vehicle_company: driverProfile.vehicle_company,
          vehicle_model: driverProfile.vehicle_model,
          vehicle_color: driverProfile.vehicle_color,
          women_only: false,
          non_smoker_only: false,
        })
        .select('id')
        .single();

      if (insertError) throw insertError;

      setSuccess('Ride published successfully.');

      if (rideData?.id) {
        const { error: notifError } = await supabase.from('notifications').insert({
          user_id: user.id,
          type: 'ride_created', // existing enum value
          title: 'Ride published',
          body: 'Your new ride is now live and ready for bookings.',
          related_ride_id: rideData.id,
        });
        if (notifError) {
          // log for debugging; we don't want to block the user's flow
          // eslint-disable-next-line no-console
          console.error('failed to insert ride_created notification', notifError);
        }
      }
      navigate('/driver/your-ride');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to publish ride.';
      setError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const estimatedTotalPoints = useMemo(() => {
    if (!formData.fuelPrice || !formData.distanceKm || !formData.mileage) return 0;
    return Math.max(0, Math.floor((Number(formData.fuelPrice) * Number(formData.distanceKm)) / Number(formData.mileage)));
  }, [formData.fuelPrice, formData.distanceKm, formData.mileage]);

  const incrementSeats = () => {
    if (formData.seats < 6) {
      handleChange('seats', formData.seats + 1);
    }
  };

  const decrementSeats = () => {
    if (formData.seats > 1) {
      handleChange('seats', formData.seats - 1);
    }
  };

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
    if (!formData.from || !formData.to) return;
    
    const start = await fetchCoordinates(formData.from);
    const end = await fetchCoordinates(formData.to);
    
    if (start && end) {
      try {
        const res = await fetch(`https://router.project-osrm.org/route/v1/driving/${start.lon},${start.lat};${end.lon},${end.lat}?overview=full&geometries=geojson`);
        const data = await res.json();
        if (data.routes && data.routes.length > 0) {
          const route = data.routes[0];
          const distKm = parseFloat((route.distance / 1000).toFixed(1));
          setFormData(prev => ({ ...prev, distanceKm: distKm }));
          
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
    <div className="min-h-screen pb-24">
      {/* Header */}
      <div className="bg-gradient-to-r from-[#00C853] to-emerald-600 px-4 pt-6 pb-8">
        <div className="max-w-screen-xl mx-auto">
          <h1 className="text-2xl md:text-3xl font-bold text-white mb-2">Post a Ride</h1>
          <p className="text-emerald-100">Share your journey and earn points</p>
        </div>
      </div>

      {/* Form */}
      <div className="max-w-screen-xl mx-auto px-4 -mt-4">
        <form onSubmit={handleSubmit} className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700">
          <div className="p-6 space-y-6">
            {error && (
              <div className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 px-4 py-3 text-sm text-red-700 dark:text-red-300">
                {error}
              </div>
            )}
            {success && (
              <div className="rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/20 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-300">
                {success}
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Left Column: Route & Schedule */}
              <div className="space-y-8">
                {/* Route Section */}
                <div className="space-y-4">
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                    <MapPin className="w-5 h-5 text-[#00C853]" />
                    Route Details
                  </h2>

                  <div className="relative">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* From */}
                  <div className="space-y-2">
                    <Label htmlFor="from" className="text-gray-700 dark:text-gray-300">
                      Leaving from
                    </Label>
                    <div className="relative">
                      <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#00C853]" />
                      <Input
                        id="from"
                        placeholder="Enter pickup location"
                        value={formData.from}
                        onChange={(e) => handleChange('from', e.target.value)}
                        onBlur={calculateRoute}
                        className="pl-10 h-12 text-base dark:bg-gray-900 dark:border-gray-700 dark:text-white"
                        required
                      />
                    </div>
                  </div>

                  {/* To */}
                  <div className="space-y-2">
                    <Label htmlFor="to" className="text-gray-700 dark:text-gray-300">
                      Going to
                    </Label>
                    <div className="relative">
                      <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-red-500" />
                      <Input
                        id="to"
                        placeholder="Enter destination"
                        value={formData.to}
                        onChange={(e) => handleChange('to', e.target.value)}
                        onBlur={calculateRoute}
                        className="pl-10 h-12 text-base dark:bg-gray-900 dark:border-gray-700 dark:text-white"
                        required
                      />
                    </div>
                  </div>
                </div>
              </div>

            </div>

            {/* Schedule Section */}
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <Clock className="w-5 h-5 text-[#00C853]" />
                Schedule
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Departure */}
                <div className="space-y-4 p-4 bg-gray-50 dark:bg-gray-900/50 rounded-xl border border-gray-200 dark:border-gray-700">
                  <h3 className="font-medium text-gray-900 dark:text-white">Departure</h3>
                  
                  <div className="space-y-2">
                    <Label htmlFor="departureDate" className="text-sm text-gray-700 dark:text-gray-300">
                      Date
                    </Label>
                    <div className="relative">
                      <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <Input
                        id="departureDate"
                        type="date"
                        value={formData.departureDate}
                        onChange={(e) => handleChange('departureDate', e.target.value)}
                        className="pl-10 h-12 dark:bg-gray-900 dark:border-gray-700 dark:text-white"
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="departureTime" className="text-sm text-gray-700 dark:text-gray-300">
                      Time
                    </Label>
                    <div className="relative">
                      <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <Input
                        id="departureTime"
                        type="time"
                        value={formData.departureTime}
                        onChange={(e) => handleChange('departureTime', e.target.value)}
                        className="pl-10 h-12 dark:bg-gray-900 dark:border-gray-700 dark:text-white"
                        required
                      />
                    </div>
                  </div>
                </div>

                {/* Arrival */}
                <div className="space-y-4 p-4 bg-gray-50 dark:bg-gray-900/50 rounded-xl border border-gray-200 dark:border-gray-700">
                  <h3 className="font-medium text-gray-900 dark:text-white">Estimated Arrival</h3>
                  
                  <div className="space-y-2">
                    <Label htmlFor="arrivalDate" className="text-sm text-gray-700 dark:text-gray-300">
                      Date
                    </Label>
                    <div className="relative">
                      <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <Input
                        id="arrivalDate"
                        type="date"
                        value={formData.arrivalDate}
                        onChange={(e) => handleChange('arrivalDate', e.target.value)}
                        className="pl-10 h-12 dark:bg-gray-900 dark:border-gray-700 dark:text-white"
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="arrivalTime" className="text-sm text-gray-700 dark:text-gray-300">
                      Time
                    </Label>
                    <div className="relative">
                      <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <Input
                        id="arrivalTime"
                        type="time"
                        value={formData.arrivalTime}
                        onChange={(e) => handleChange('arrivalTime', e.target.value)}
                        className="pl-10 h-12 dark:bg-gray-900 dark:border-gray-700 dark:text-white"
                        required
                      />
                    </div>
                  </div>
                </div>
              </div>
              </div>
            </div>

              {/* Right Column: Map */}
              <div className="flex flex-col space-y-4">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-[#00C853]" />
                  Map Overview
                </h2>
                <div className="h-[320px] md:h-[400px] w-full rounded-xl overflow-hidden z-0 relative border border-gray-200 dark:border-gray-700">
                  <MapContainer center={[20.5937, 78.9629]} zoom={5} scrollWheelZoom={false} className="h-full w-full z-0">
                    <TileLayer
                      attribution="© OpenStreetMap contributors"
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />
                    {routePath.length > 0 && <Polyline positions={routePath} color="#00C853" weight={5} />}
                    {routePath.length > 0 && (
                      <CircleMarker center={routePath[0]} radius={6} color="green" fillOpacity={1} />
                    )}
                    {routePath.length > 0 && (
                      <CircleMarker center={routePath[routePath.length - 1]} radius={6} color="red" fillOpacity={1} />
                    )}
                    <MapUpdater bounds={mapBounds} />
                  </MapContainer>
                </div>
              </div>
            </div>

            {/* Capacity & Fuel Section (Full Width) */}
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <Users className="w-5 h-5 text-[#00C853]" />
                Capacity & Fuel
              </h2>

              <div className="p-4 bg-gray-50 dark:bg-gray-900/50 rounded-xl border border-gray-200 dark:border-gray-700 space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {/* Number of Seats */}
                  <div className="space-y-1">
                    <Label className="text-xs text-gray-700 dark:text-gray-300">
                      Vacant Seats
                    </Label>
                    <div className="flex items-center gap-2 h-12">
                      <button
                        type="button"
                        onClick={decrementSeats}
                        disabled={formData.seats <= 1}
                        className="flex-1 h-full rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center transition-colors"
                      >
                        <span className="text-xl text-gray-700 dark:text-gray-300">−</span>
                      </button>
                      
                      <div className="flex-1 h-full rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 flex items-center justify-center">
                        <span className="text-lg font-bold text-gray-900 dark:text-white">{formData.seats}</span>
                      </div>

                      <button
                        type="button"
                        onClick={incrementSeats}
                        disabled={formData.seats >= 6}
                        className="flex-1 h-full rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center transition-colors"
                      >
                        <span className="text-xl text-gray-700 dark:text-gray-300">+</span>
                      </button>
                    </div>
                  </div>

                  {/* Fuel */}
                  <div className="space-y-1">
                    <Label className="text-xs text-gray-700 dark:text-gray-300">Fuel (₹/L)</Label>
                    <div className="relative">
                      <Coins className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-amber-500" />
                      <Input
                        type="number"
                        min="1"
                        step="any"
                        value={formData.fuelPrice}
                        onChange={(e) => handleChange('fuelPrice', e.target.value)}
                        className="pl-8 h-12 text-sm md:text-base bg-white dark:bg-gray-900 dark:border-gray-700 dark:text-white"
                        placeholder="100"
                        required
                      />
                    </div>
                  </div>

                  {/* Distance */}
                  <div className="space-y-1">
                    <Label className="text-xs text-gray-700 dark:text-gray-300">Dist. (km)</Label>
                    <Input
                      type="number"
                      min="0.1"
                      step="any"
                      value={formData.distanceKm}
                      readOnly
                      className="h-12 text-sm md:text-base dark:bg-gray-900 dark:border-gray-700 dark:text-white bg-gray-100 dark:bg-gray-800 cursor-not-allowed"
                      placeholder="Auto"
                      required
                    />
                  </div>

                  {/* Mileage */}
                  <div className="space-y-1">
                    <Label className="text-xs text-gray-700 dark:text-gray-300">Mileage (km/L)</Label>
                    <Input
                      type="number"
                      min="1"
                      step="any"
                      value={formData.mileage}
                      onChange={(e) => handleChange('mileage', e.target.value)}
                      className="h-12 text-sm md:text-base bg-white dark:bg-gray-900 dark:border-gray-700 dark:text-white"
                      placeholder="15"
                      required
                    />
                  </div>
                </div>

                <div className="pt-3 border-t border-gray-200 dark:border-gray-700">
                  <p className="text-xs text-gray-500 dark:text-gray-400">Maximum 6 seats available</p>
                </div>
              </div>
            </div>
          </div>

          {/* Submit Button - Fixed at Bottom */}
          <div className="sticky bottom-0 p-6 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 rounded-b-2xl">
            <Button
              type="submit"
              disabled={isSubmitting || hasValidProfile === false}
              className="w-full h-14 bg-gradient-to-r from-[#00C853] to-emerald-600 hover:from-emerald-600 hover:to-[#00C853] text-white text-lg font-semibold shadow-lg disabled:opacity-60"
            >
              {isSubmitting ? 'Publishing…' : 'Publish Ride'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
