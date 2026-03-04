import { useMemo, useState } from 'react';
import { MapPin, Calendar, Clock, Users, Coins, ArrowUpDown, Car } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { supabase } from '../../../lib/supabase';

export default function DriverPostRide() {
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
    distanceKm: 10,
    vehicleRegistration: '',
    vehicleCompany: '',
    vehicleModel: '',
    vehicleColor: '',
    womenOnly: false,
    nonSmokerOnly: false,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleChange = (field: string, value: string | number) => {
    setFormData({ ...formData, [field]: value });
  };

  const handleSwapLocations = () => {
    setFormData({
      ...formData,
      from: formData.to,
      to: formData.from,
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void submitRide();
  };

  const submitRide = async () => {
    setError(null);
    setSuccess(null);
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
        formData.mileage > 0
          ? Math.floor((formData.fuelPrice * formData.distanceKm) / formData.mileage)
          : null;

      const { error: insertError } = await supabase.from('rides').insert({
        driver_id: user.id,
        from_location: formData.from,
        to_location: formData.to,
        departure_time: departureIso,
        arrival_time: arrivalIso,
        total_seats: formData.seats,
        vacant_seats: formData.seats,
        distance_km: formData.distanceKm,
        fuel_price: formData.fuelPrice,
        mileage_kmpl: formData.mileage,
        estimated_total_points: estimatedTotalPoints,
        vehicle_registration: formData.vehicleRegistration || null,
        vehicle_company: formData.vehicleCompany || null,
        vehicle_model: formData.vehicleModel || null,
        vehicle_color: formData.vehicleColor || null,
        women_only: formData.womenOnly,
        non_smoker_only: formData.nonSmokerOnly,
      });

      if (insertError) throw insertError;

      setSuccess('Ride published successfully.');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to publish ride.';
      setError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const estimatedTotalPoints = useMemo(() => {
    if (!formData.fuelPrice || !formData.distanceKm || !formData.mileage) return 0;
    return Math.max(0, Math.floor((formData.fuelPrice * formData.distanceKm) / formData.mileage));
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
            {/* Route Section */}
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <MapPin className="w-5 h-5 text-[#00C853]" />
                Route
              </h2>

              <div className="relative">
                <div className="space-y-4">
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
                        className="pl-10 h-12 text-base dark:bg-gray-900 dark:border-gray-700 dark:text-white"
                        required
                      />
                    </div>
                  </div>

                  {/* Swap Button */}
                  <div className="flex justify-center">
                    <button
                      type="button"
                      onClick={handleSwapLocations}
                      className="w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-700 hover:bg-emerald-100 dark:hover:bg-emerald-900/30 flex items-center justify-center transition-colors group"
                    >
                      <ArrowUpDown className="w-5 h-5 text-gray-600 dark:text-gray-300 group-hover:text-[#00C853] dark:group-hover:text-emerald-400" />
                    </button>
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
                        className="pl-10 h-12 text-base dark:bg-gray-900 dark:border-gray-700 dark:text-white"
                        required
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Map & route preview disabled */}
              {/* Users can manually enter distance below */}

              <div className="space-y-2 p-4 bg-gray-50 dark:bg-gray-900/50 rounded-xl border border-gray-200 dark:border-gray-700 mt-4">
                <Label htmlFor="distanceKm" className="text-sm text-gray-700 dark:text-gray-300">
                  Estimated Distance (km)
                </Label>
                <Input
                  id="distanceKm"
                  type="number"
                  min="0.1"
                  step="0.1"
                  value={formData.distanceKm || ''}
                  onChange={(e) => handleChange('distanceKm', parseFloat(e.target.value) || 0)}
                  placeholder="Enter distance in km"
                  className="h-12 dark:bg-gray-900 dark:border-gray-700 dark:text-white"
                  required
                />
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

            {/* Capacity & Pricing Section */}
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <Users className="w-5 h-5 text-[#00C853]" />
                Capacity & Fuel
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Number of Seats */}
                <div className="space-y-2">
                  <Label className="text-gray-700 dark:text-gray-300">
                    Number of Vacant Seats
                  </Label>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={decrementSeats}
                      disabled={formData.seats <= 1}
                      className="w-12 h-12 rounded-xl bg-gray-100 dark:bg-gray-700 hover:bg-emerald-100 dark:hover:bg-emerald-900/30 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center transition-colors"
                    >
                      <span className="text-2xl text-gray-700 dark:text-gray-300">−</span>
                    </button>
                    
                    <div className="flex-1 h-12 rounded-xl bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 flex items-center justify-center">
                      <span className="text-2xl font-bold text-gray-900 dark:text-white">{formData.seats}</span>
                    </div>

                    <button
                      type="button"
                      onClick={incrementSeats}
                      disabled={formData.seats >= 6}
                      className="w-12 h-12 rounded-xl bg-gray-100 dark:bg-gray-700 hover:bg-emerald-100 dark:hover:bg-emerald-900/30 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center transition-colors"
                    >
                      <span className="text-2xl text-gray-700 dark:text-gray-300">+</span>
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Maximum 6 seats available</p>
                </div>

                {/* Fuel & Distance */}
                <div className="space-y-2">
                  <Label className="text-gray-700 dark:text-gray-300">
                    Fuel price, distance & mileage
                  </Label>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="relative">
                      <Coins className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-amber-500" />
                      <Input
                        type="number"
                        min="1"
                        step="1"
                        value={formData.fuelPrice}
                        onChange={(e) => handleChange('fuelPrice', parseFloat(e.target.value) || 0)}
                        className="pl-10 h-12 text-base dark:bg-gray-900 dark:border-gray-700 dark:text-white"
                        placeholder="Fuel ₹/L"
                        required
                      />
                    </div>
                    <Input
                      type="number"
                      min="1"
                      step="1"
                      value={formData.distanceKm}
                      onChange={(e) => handleChange('distanceKm', parseFloat(e.target.value) || 0)}
                      className="h-12 text-base dark:bg-gray-900 dark:border-gray-700 dark:text-white"
                      placeholder="Distance km"
                      required
                    />
                    <Input
                      type="number"
                      min="1"
                      step="1"
                      value={formData.mileage}
                      onChange={(e) => handleChange('mileage', parseFloat(e.target.value) || 0)}
                      className="h-12 text-base dark:bg-gray-900 dark:border-gray-700 dark:text-white"
                      placeholder="Mileage km/L"
                      required
                    />
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Estimated total wallet points:{" "}
                    <span className="font-semibold text-[#00C853]">
                      {estimatedTotalPoints} points
                    </span>{" "}
                    (formula: (fuel price × distance) ÷ mileage)
                  </p>
                </div>
              </div>
            </div>

            {/* Vehicle details */}
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <Car className="w-5 h-5 text-[#00C853]" />
                Vehicle details
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="vehicleRegistration" className="text-gray-700 dark:text-gray-300">
                    Registration number
                  </Label>
                  <Input
                    id="vehicleRegistration"
                    value={formData.vehicleRegistration}
                    onChange={(e) => handleChange('vehicleRegistration', e.target.value)}
                    className="h-12 dark:bg-gray-900 dark:border-gray-700 dark:text-white"
                    placeholder="DL01AB1234"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="vehicleCompany" className="text-gray-700 dark:text-gray-300">
                    Company
                  </Label>
                  <Input
                    id="vehicleCompany"
                    value={formData.vehicleCompany}
                    onChange={(e) => handleChange('vehicleCompany', e.target.value)}
                    className="h-12 dark:bg-gray-900 dark:border-gray-700 dark:text-white"
                    placeholder="e.g. Honda"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="vehicleModel" className="text-gray-700 dark:text-gray-300">
                    Model
                  </Label>
                  <Input
                    id="vehicleModel"
                    value={formData.vehicleModel}
                    onChange={(e) => handleChange('vehicleModel', e.target.value)}
                    className="h-12 dark:bg-gray-900 dark:border-gray-700 dark:text-white"
                    placeholder="e.g. City"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="vehicleColor" className="text-gray-700 dark:text-gray-300">
                    Colour
                  </Label>
                  <Input
                    id="vehicleColor"
                    value={formData.vehicleColor}
                    onChange={(e) => handleChange('vehicleColor', e.target.value)}
                    className="h-12 dark:bg-gray-900 dark:border-gray-700 dark:text-white"
                    placeholder="e.g. White"
                  />
                </div>
              </div>
            </div>

            {/* Preferences */}
            <div className="space-y-2">
              <Label className="text-gray-700 dark:text-gray-300">Preferences</Label>
              <div className="flex flex-wrap gap-3 text-sm">
                <button
                  type="button"
                  onClick={() => handleChange('womenOnly', formData.womenOnly ? 0 : 1)}
                  className={`px-3 py-2 rounded-full border text-xs md:text-sm ${
                    formData.womenOnly
                      ? 'bg-pink-100 border-pink-300 text-pink-700 dark:bg-pink-900/30 dark:border-pink-700 dark:text-pink-300'
                      : 'border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300'
                  }`}
                >
                  Women only
                </button>
                <button
                  type="button"
                  onClick={() => handleChange('nonSmokerOnly', formData.nonSmokerOnly ? 0 : 1)}
                  className={`px-3 py-2 rounded-full border text-xs md:text-sm ${
                    formData.nonSmokerOnly
                      ? 'bg-emerald-100 border-emerald-300 text-emerald-700 dark:bg-emerald-900/30 dark:border-emerald-700 dark:text-emerald-300'
                      : 'border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300'
                  }`}
                >
                  Non-smokers only
                </button>
              </div>
            </div>

            {/* Summary Card */}
            <div className="p-4 bg-gradient-to-r from-emerald-50 to-green-50 dark:from-emerald-900/20 dark:to-green-900/20 rounded-xl border border-emerald-200 dark:border-emerald-800">
              <h3 className="font-semibold text-gray-900 dark:text-white mb-3">Ride Summary</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Route:</span>
                  <span className="font-medium text-gray-900 dark:text-white">
                    {formData.from && formData.to ? `${formData.from} → ${formData.to}` : 'Not set'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Departure:</span>
                  <span className="font-medium text-gray-900 dark:text-white">
                    {formData.departureDate && formData.departureTime
                      ? `${new Date(formData.departureDate).toLocaleDateString()} at ${formData.departureTime}`
                      : 'Not set'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Available seats:</span>
                  <span className="font-medium text-gray-900 dark:text-white">{formData.seats}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Estimated distance:</span>
                  <span className="font-medium text-gray-900 dark:text-white">
                    {formData.distanceKm} km
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Estimated total wallet points:</span>
                  <span className="font-medium text-[#00C853]">
                    {estimatedTotalPoints} points
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Submit Button - Fixed at Bottom */}
          <div className="sticky bottom-0 p-6 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 rounded-b-2xl">
            <Button
              type="submit"
              disabled={isSubmitting}
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
