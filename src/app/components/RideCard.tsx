import { Link } from 'react-router';
import { MapPin, Clock, Users, Star, Leaf, ShieldCheck } from 'lucide-react';
import { Button } from './ui/button';
import { Progress } from './ui/progress';
import { Badge } from './ui/badge';

interface RideCardProps {
  ride: {
    id: string;
    driver: {
      name: string;
      avatar: string;
      rating: number;
      isVerified: boolean;
    };
    from: string;
    to: string;
    departureTime: string;
    arrivalTime: string;
    totalSeats: number;
    availableSeats: number;
    price: number;
    isEcoFriendly: boolean;
    womenOnly?: boolean;
    nonSmoking?: boolean;
  };
}

export function RideCard({ ride }: RideCardProps) {
  const seatsOccupied = ((ride.totalSeats - ride.availableSeats) / ride.totalSeats) * 100;

  return (
    <div className="group relative bg-white/80 dark:bg-gray-800/80 backdrop-blur-md rounded-2xl p-6 border border-gray-200/50 dark:border-gray-700/50 shadow-sm hover:shadow-xl hover:scale-[1.02] transition-all duration-300">
      {/* Glassmorphism overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-white/50 dark:from-gray-700/30 to-transparent rounded-2xl pointer-events-none" />
      
      <div className="relative space-y-4">
        {/* Driver Info */}
        <div className="flex items-center gap-3">
          <div className="w-14 h-14 md:w-16 md:h-16 rounded-full bg-gradient-to-br from-emerald-400 to-[#00C853] flex items-center justify-center text-white font-semibold overflow-hidden text-lg md:text-xl">
            {ride.driver.avatar ? (
              <img src={ride.driver.avatar} alt={ride.driver.name} className="w-full h-full object-cover" />
            ) : (
              ride.driver.name.charAt(0)
            )}
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-semibold text-gray-900 dark:text-white text-base md:text-lg">{ride.driver.name}</h3>
              {ride.driver.isVerified && (
                <Badge variant="secondary" className="bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-0">
                  <ShieldCheck className="w-3 h-3 mr-1" />
                  Verified
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-1 text-sm">
              <Star className="w-4 h-4 md:w-5 md:h-5 fill-amber-400 text-amber-400" />
              <span className="font-medium text-gray-900 dark:text-white">{ride.driver.rating}</span>
              <span className="text-gray-400 dark:text-gray-500">/5</span>
            </div>
          </div>
          {ride.isEcoFriendly && (
            <Badge className="bg-emerald-100 dark:bg-emerald-900/30 text-[#00C853] dark:text-emerald-400 border-0 hover:bg-emerald-100">
              <Leaf className="w-3 h-3 md:w-4 md:h-4 mr-1" />
              Eco
            </Badge>
          )}
        </div>

        {/* Route Info */}
        <div className="space-y-3">
          <div className="flex items-start gap-3">
            <MapPin className="w-5 h-5 text-[#00C853] mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm text-gray-500 dark:text-gray-400">From</p>
              <p className="font-medium text-gray-900 dark:text-white text-sm md:text-base">{ride.from}</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <MapPin className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm text-gray-500 dark:text-gray-400">To</p>
              <p className="font-medium text-gray-900 dark:text-white text-sm md:text-base">{ride.to}</p>
            </div>
          </div>
        </div>

        {/* Time & Seats */}
        <div className="flex items-center gap-4 pt-2 border-t border-gray-100 dark:border-gray-700">
          <div className="flex items-center gap-2 text-sm md:text-base text-gray-600 dark:text-gray-300">
            <Clock className="w-5 h-5" />
            <span>{ride.departureTime} - {ride.arrivalTime}</span>
          </div>
        </div>

        {/* Seat Availability */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm md:text-base">
            <span className="text-gray-600 dark:text-gray-300 flex items-center gap-2">
              <Users className="w-5 h-5" />
              Seats Available
            </span>
            <span className="font-medium text-gray-900 dark:text-white">
              {ride.availableSeats}/{ride.totalSeats}
            </span>
          </div>
          <Progress value={seatsOccupied} className="h-2.5" />
        </div>

        {/* Tags */}
        {(ride.womenOnly || ride.nonSmoking) && (
          <div className="flex gap-2 flex-wrap">
            {ride.womenOnly && (
              <Badge variant="outline" className="text-xs md:text-sm dark:border-gray-600 dark:text-gray-300">Women Only</Badge>
            )}
            {ride.nonSmoking && (
              <Badge variant="outline" className="text-xs md:text-sm dark:border-gray-600 dark:text-gray-300">Non-smoking</Badge>
            )}
          </div>
        )}

        {/* Price & Action */}
        <div className="flex items-center justify-between pt-3 border-t border-gray-100 dark:border-gray-700">
          <div>
            <p className="text-3xl md:text-4xl font-bold text-[#00C853]">{ride.price}</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">Points</p>
          </div>
          <Link to={`/rides/${ride.id}`}>
            <Button className="bg-[#00C853] hover:bg-emerald-600 text-white shadow-lg shadow-emerald-200 dark:shadow-emerald-900/30 h-11 md:h-12 px-6 text-base">
              Book Ride
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}