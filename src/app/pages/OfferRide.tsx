import { useState } from 'react';
import { MapPin, Navigation, DollarSign, Users, TrendingUp, Calculator } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Slider } from '../components/ui/slider';
import { Textarea } from '../components/ui/textarea';

export default function OfferRide() {
  const [formData, setFormData] = useState({
    from: '',
    to: '',
    date: '',
    time: '',
    mileage: 50,
    fuelCost: 0,
    seatCapacity: 3,
    notes: '',
  });

  const calculateEarnings = () => {
    const baseFare = formData.mileage * 5;
    const bonus = formData.seatCapacity * 20;
    return Math.round(baseFare + bonus);
  };

  const calculateFuelCost = () => {
    // Average fuel efficiency: 30 MPG, Gas price: $4/gallon
    return Math.round((formData.mileage / 30) * 4 * 100) / 100;
  };

  return (
    <div className="min-h-screen py-6 md:py-8 dark:bg-gray-900">
      <div className="container mx-auto px-4 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-6 md:gap-8">
          {/* Form Section */}
          <div>
            <div className="mb-6 md:mb-8">
              <h1 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-2">Offer a Ride</h1>
              <p className="text-gray-600 dark:text-gray-400 text-base md:text-lg">Share your journey and earn points while helping the environment</p>
            </div>

            <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-md rounded-2xl p-6 lg:p-8 border border-gray-200 dark:border-gray-700 shadow-lg space-y-6">
              {/* Route Information */}
              <div className="space-y-4">
                <h3 className="text-lg md:text-xl font-semibold flex items-center gap-2 dark:text-white">
                  <Navigation className="w-6 h-6 text-[#00C853]" />
                  Route Information
                </h3>

                <div className="space-y-2">
                  <Label htmlFor="offer-from" className="dark:text-gray-300 text-base">Pickup Location</Label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#00C853]" />
                    <Input
                      id="offer-from"
                      placeholder="Enter pickup location"
                      value={formData.from}
                      onChange={(e) => setFormData({ ...formData, from: e.target.value })}
                      className="pl-10 bg-white dark:bg-gray-900/50 dark:border-gray-700 h-12 text-base"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="offer-to" className="dark:text-gray-300 text-base">Destination</Label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-red-500" />
                    <Input
                      id="offer-to"
                      placeholder="Enter destination"
                      value={formData.to}
                      onChange={(e) => setFormData({ ...formData, to: e.target.value })}
                      className="pl-10 bg-white dark:bg-gray-900/50 dark:border-gray-700 h-12 text-base"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="offer-date" className="dark:text-gray-300 text-base">Date</Label>
                    <Input
                      id="offer-date"
                      type="date"
                      value={formData.date}
                      onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                      className="bg-white dark:bg-gray-900/50 dark:border-gray-700 h-12 text-base"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="offer-time" className="dark:text-gray-300 text-base">Time</Label>
                    <Input
                      id="offer-time"
                      type="time"
                      value={formData.time}
                      onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                      className="bg-white dark:bg-gray-900/50 dark:border-gray-700 h-12 text-base"
                    />
                  </div>
                </div>
              </div>

              {/* Trip Details */}
              <div className="space-y-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                <h3 className="text-lg md:text-xl font-semibold flex items-center gap-2 dark:text-white">
                  <Calculator className="w-6 h-6 text-[#00C853]" />
                  Trip Details
                </h3>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="dark:text-gray-300 text-base">Route Mileage: {formData.mileage} miles</Label>
                    <span className="text-sm text-gray-500 dark:text-gray-400">Estimated fuel: ${calculateFuelCost()}</span>
                  </div>
                  <Slider
                    value={[formData.mileage]}
                    onValueChange={(value) => setFormData({ ...formData, mileage: value[0] })}
                    max={200}
                    min={1}
                    step={1}
                    className="py-4"
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="dark:text-gray-300 text-base">Available Seats: {formData.seatCapacity}</Label>
                    <Users className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                  </div>
                  <Slider
                    value={[formData.seatCapacity]}
                    onValueChange={(value) => setFormData({ ...formData, seatCapacity: value[0] })}
                    max={7}
                    min={1}
                    step={1}
                    className="py-4"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="notes" className="dark:text-gray-300 text-base">Additional Notes (Optional)</Label>
                  <Textarea
                    id="notes"
                    placeholder="Add any special instructions or preferences..."
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    className="bg-white dark:bg-gray-900/50 dark:border-gray-700 min-h-[100px] text-base"
                  />
                </div>
              </div>

              <Button className="w-full bg-gradient-to-r from-[#00C853] to-emerald-600 hover:from-emerald-600 hover:to-[#00C853] text-white shadow-lg shadow-emerald-200 dark:shadow-emerald-900/30 h-14 text-lg">
                Publish Ride
              </Button>
            </div>
          </div>

          {/* Map & Earnings Section */}
          <div className="space-y-6">
            {/* Earnings Widget */}
            <div className="bg-gradient-to-br from-[#00C853] to-emerald-600 rounded-2xl p-6 lg:p-8 text-white shadow-xl">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-14 h-14 md:w-16 md:h-16 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
                  <TrendingUp className="w-7 h-7 md:w-8 md:h-8" />
                </div>
                <div>
                  <p className="text-sm md:text-base text-emerald-100">Potential Earnings</p>
                  <h2 className="text-3xl md:text-4xl font-bold">{calculateEarnings()} Points</h2>
                </div>
              </div>
              <div className="space-y-3 pt-4 border-t border-white/20">
                <div className="flex justify-between text-sm md:text-base">
                  <span className="text-emerald-100">Base Fare ({formData.mileage} miles × 5 pts)</span>
                  <span className="font-semibold">{formData.mileage * 5} pts</span>
                </div>
                <div className="flex justify-between text-sm md:text-base">
                  <span className="text-emerald-100">Seat Bonus ({formData.seatCapacity} seats × 20 pts)</span>
                  <span className="font-semibold">{formData.seatCapacity * 20} pts</span>
                </div>
                <div className="flex justify-between text-sm md:text-base pt-2 border-t border-white/20">
                  <span className="text-emerald-100">Eco Impact</span>
                  <span className="font-semibold">{Math.round(formData.mileage * 0.4)} kg CO₂ saved</span>
                </div>
              </div>
            </div>

            {/* Map Placeholder */}
            <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-md rounded-2xl border border-gray-200 dark:border-gray-700 shadow-lg overflow-hidden">
              <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-white/50 dark:bg-gray-800/50">
                <h3 className="font-semibold flex items-center gap-2 dark:text-white text-base md:text-lg">
                  <MapPin className="w-5 h-5 md:w-6 md:h-6 text-[#00C853]" />
                  Route Preview
                </h3>
              </div>
              <div className="aspect-[4/3] bg-gradient-to-br from-emerald-50 to-blue-50 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center relative overflow-hidden">
                {/* Decorative map elements */}
                <div className="absolute inset-0 opacity-20">
                  <div className="absolute top-1/4 left-1/4 w-32 h-32 border-4 border-[#00C853] rounded-full" />
                  <div className="absolute bottom-1/4 right-1/4 w-24 h-24 border-4 border-emerald-400 rounded-full" />
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1 h-32 bg-[#00C853] rotate-45" />
                </div>
                <div className="text-center space-y-2 relative z-10">
                  <MapPin className="w-12 h-12 md:w-16 md:h-16 text-[#00C853] mx-auto" />
                  <p className="text-gray-600 dark:text-gray-400 text-base md:text-lg">Interactive map preview</p>
                  <p className="text-sm md:text-base text-gray-500 dark:text-gray-500">Route will be displayed here</p>
                </div>
              </div>
            </div>

            {/* Tips Card */}
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-2xl p-6">
              <h4 className="font-semibold text-blue-900 dark:text-blue-300 mb-3 text-base md:text-lg">Tips for Offering Rides</h4>
              <ul className="space-y-2 text-sm md:text-base text-blue-800 dark:text-blue-300">
                <li className="flex gap-2">
                  <span className="text-blue-500">•</span>
                  <span>Be punctual and communicate with your passengers</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-blue-500">•</span>
                  <span>Keep your vehicle clean and well-maintained</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-blue-500">•</span>
                  <span>Verify passenger details before starting the trip</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-blue-500">•</span>
                  <span>Drive safely and follow all traffic rules</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}