import { useState } from 'react';
import { Filter, SlidersHorizontal } from 'lucide-react';
import { RideCard } from '../components/RideCard';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';

// Mock data
const mockRides = [
  {
    id: '1',
    driver: {
      name: 'Sarah Johnson',
      avatar: '',
      rating: 4.8,
      isVerified: true,
    },
    from: 'Downtown San Francisco',
    to: 'San Jose Tech Campus',
    departureTime: '08:00 AM',
    arrivalTime: '09:30 AM',
    totalSeats: 4,
    availableSeats: 2,
    price: 320,
    isEcoFriendly: true,
    womenOnly: true,
    nonSmoking: true,
  },
  {
    id: '2',
    driver: {
      name: 'Michael Chen',
      avatar: '',
      rating: 4.9,
      isVerified: true,
    },
    from: 'Oakland Station',
    to: 'Berkeley University',
    departureTime: '07:30 AM',
    arrivalTime: '08:15 AM',
    totalSeats: 3,
    availableSeats: 1,
    price: 180,
    isEcoFriendly: true,
    nonSmoking: true,
  },
  {
    id: '3',
    driver: {
      name: 'Emily Martinez',
      avatar: '',
      rating: 4.7,
      isVerified: true,
    },
    from: 'Palo Alto',
    to: 'San Francisco Financial District',
    departureTime: '06:45 AM',
    arrivalTime: '07:45 AM',
    totalSeats: 4,
    availableSeats: 3,
    price: 280,
    isEcoFriendly: true,
    womenOnly: true,
  },
  {
    id: '4',
    driver: {
      name: 'David Kim',
      avatar: '',
      rating: 4.6,
      isVerified: false,
    },
    from: 'Mountain View',
    to: 'San Jose Airport',
    departureTime: '10:00 AM',
    arrivalTime: '10:45 AM',
    totalSeats: 4,
    availableSeats: 4,
    price: 220,
    isEcoFriendly: false,
    nonSmoking: true,
  },
  {
    id: '5',
    driver: {
      name: 'Jessica Wong',
      avatar: '',
      rating: 4.9,
      isVerified: true,
    },
    from: 'Fremont BART',
    to: 'Stanford University',
    departureTime: '09:15 AM',
    arrivalTime: '10:00 AM',
    totalSeats: 3,
    availableSeats: 2,
    price: 260,
    isEcoFriendly: true,
    womenOnly: true,
    nonSmoking: true,
  },
  {
    id: '6',
    driver: {
      name: 'Robert Taylor',
      avatar: '',
      rating: 4.5,
      isVerified: true,
    },
    from: 'San Mateo',
    to: 'SFO Airport',
    departureTime: '11:30 AM',
    arrivalTime: '12:00 PM',
    totalSeats: 4,
    availableSeats: 3,
    price: 190,
    isEcoFriendly: true,
    nonSmoking: true,
  },
];

export default function RideListings() {
  const [priceFilter, setPriceFilter] = useState<'all' | 'low' | 'high'>('all');
  const [ecoOnly, setEcoOnly] = useState(false);

  const filteredRides = mockRides.filter(ride => {
    if (ecoOnly && !ride.isEcoFriendly) return false;
    return true;
  });

  return (
    <div className="min-h-screen py-6 md:py-8 dark:bg-gray-900">
      <div className="container mx-auto px-4 lg:px-8">
        {/* Header */}
        <div className="mb-6 md:mb-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-4">
            <div>
              <h1 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-2">Available Rides</h1>
              <p className="text-gray-600 dark:text-gray-400 text-base md:text-lg">Found {filteredRides.length} rides matching your search</p>
            </div>
            <Button variant="outline" className="gap-2 h-12 md:h-14 text-base md:text-lg w-full md:w-auto dark:border-gray-700 dark:text-gray-300">
              <SlidersHorizontal className="w-5 h-5" />
              More Filters
            </Button>
          </div>

          {/* Quick Filters */}
          <div className="flex flex-wrap gap-3">
            <Button
              variant={ecoOnly ? "default" : "outline"}
              onClick={() => setEcoOnly(!ecoOnly)}
              className={`${ecoOnly ? "bg-[#00C853] hover:bg-emerald-600" : "dark:border-gray-700 dark:text-gray-300"} h-11 md:h-12 text-base px-4 md:px-6`}
            >
              Eco-Friendly Only
            </Button>
            <Button
              variant={priceFilter === 'low' ? "default" : "outline"}
              onClick={() => setPriceFilter(priceFilter === 'low' ? 'all' : 'low')}
              className={`${priceFilter === 'low' ? "bg-[#00C853] hover:bg-emerald-600" : "dark:border-gray-700 dark:text-gray-300"} h-11 md:h-12 text-base px-4 md:px-6`}
            >
              Low Price
            </Button>
            <Button
              variant={priceFilter === 'high' ? "default" : "outline"}
              onClick={() => setPriceFilter(priceFilter === 'high' ? 'all' : 'high')}
              className={`${priceFilter === 'high' ? "bg-[#00C853] hover:bg-emerald-600" : "dark:border-gray-700 dark:text-gray-300"} h-11 md:h-12 text-base px-4 md:px-6`}
            >
              High Rating
            </Button>
          </div>
        </div>

        {/* Results Grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredRides.map((ride) => (
            <RideCard key={ride.id} ride={ride} />
          ))}
        </div>

        {/* No Results */}
        {filteredRides.length === 0 && (
          <div className="text-center py-20">
            <div className="w-20 h-20 mx-auto mb-4 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center">
              <Filter className="w-10 h-10 text-gray-400 dark:text-gray-600" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">No rides found</h3>
            <p className="text-gray-600 dark:text-gray-400">Try adjusting your filters or search criteria</p>
          </div>
        )}
      </div>
    </div>
  );
}