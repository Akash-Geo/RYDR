import { useState, useEffect } from 'react';
import { Search, MapPin, Calendar, Clock, Filter, Leaf, Cigarette } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Switch } from '../components/ui/switch';
import { Label } from '../components/ui/label';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';

export default function Home() {
  const navigate = useNavigate();
  const [womenOnly, setWomenOnly] = useState(false);
  const [nonSmoking, setNonSmoking] = useState(false);
  const [searchParams, setSearchParams] = useState({
    from: '',
    to: '',
    date: '',
    time: ''
  });
  const [hasGender, setHasGender] = useState<boolean | null>(null);

  useEffect(() => {
    async function checkProfile() {
      const { data: authData } = await supabase.auth.getUser();
      if (authData.user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('gender')
          .eq('id', authData.user.id)
          .single();
        setHasGender(!!profile?.gender);
      }
    }
    void checkProfile();
  }, []);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (hasGender === false) {
      alert('You must fill in your gender in the Account section before finding or booking a ride.');
      navigate('/account');
      return;
    }
    
    navigate('/rides');
  };

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <div className="relative overflow-hidden bg-gradient-to-br from-emerald-50 via-white to-emerald-50/30 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
        {/* Decorative circles */}
        <div className="absolute top-20 left-10 w-72 h-72 bg-[#00C853]/5 dark:bg-[#00C853]/10 rounded-full blur-3xl" />
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-emerald-400/10 dark:bg-emerald-400/5 rounded-full blur-3xl" />
        
        <div className="relative container mx-auto px-4 lg:px-8 py-12 md:py-20 lg:py-32">
          <div className="max-w-4xl mx-auto text-center space-y-6 md:space-y-8">
            {/* Eco Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-2.5 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-full border border-emerald-200 dark:border-emerald-800 shadow-sm">
              <Leaf className="w-5 h-5 text-[#00C853]" />
              <span className="text-sm md:text-base font-medium text-gray-700 dark:text-gray-300">Eco-Friendly Car Pooling Platform</span>
            </div>

            {/* Hero Text */}
            <h1 className="text-4xl md:text-5xl lg:text-7xl font-bold text-gray-900 dark:text-white leading-tight px-4">
              Share your journey,
              <span className="block bg-gradient-to-r from-[#00C853] to-emerald-600 bg-clip-text text-transparent">
                earn points.
              </span>
            </h1>
            
            <p className="text-lg md:text-xl text-gray-600 dark:text-gray-300 max-w-2xl mx-auto px-4">
              Join the sustainable transportation revolution. Save money, reduce emissions, and connect with your community.
            </p>

            {/* Search Card with Glassmorphism */}
            <div className="relative mt-8 md:mt-12">
              <div className="absolute inset-0 bg-gradient-to-r from-[#00C853]/20 to-emerald-400/20 rounded-3xl blur-xl" />
              
              <form onSubmit={handleSearch} className="relative bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl rounded-3xl p-6 lg:p-8 border border-white/50 dark:border-gray-700/50 shadow-2xl">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                  {/* Pickup Location */}
                  <div className="space-y-2">
                    <Label htmlFor="from" className="text-sm md:text-base text-gray-700 dark:text-gray-300 flex items-center gap-2">
                      <MapPin className="w-5 h-5 text-[#00C853]" />
                      Pickup Location
                    </Label>
                    <Input
                      id="from"
                      placeholder="Enter pickup location"
                      value={searchParams.from}
                      onChange={(e) => setSearchParams({ ...searchParams, from: e.target.value })}
                      className="bg-white dark:bg-gray-900/50 border-gray-200 dark:border-gray-700 focus:border-[#00C853] focus:ring-[#00C853] h-12 text-base"
                    />
                  </div>

                  {/* Drop-off Location */}
                  <div className="space-y-2">
                    <Label htmlFor="to" className="text-sm md:text-base text-gray-700 dark:text-gray-300 flex items-center gap-2">
                      <MapPin className="w-5 h-5 text-red-500" />
                      Drop-off Location
                    </Label>
                    <Input
                      id="to"
                      placeholder="Enter destination"
                      value={searchParams.to}
                      onChange={(e) => setSearchParams({ ...searchParams, to: e.target.value })}
                      className="bg-white dark:bg-gray-900/50 border-gray-200 dark:border-gray-700 focus:border-[#00C853] focus:ring-[#00C853] h-12 text-base"
                    />
                  </div>

                  {/* Date */}
                  <div className="space-y-2">
                    <Label htmlFor="date" className="text-sm md:text-base text-gray-700 dark:text-gray-300 flex items-center gap-2">
                      <Calendar className="w-5 h-5 text-[#00C853]" />
                      Date
                    </Label>
                    <Input
                      id="date"
                      type="date"
                      value={searchParams.date}
                      onChange={(e) => setSearchParams({ ...searchParams, date: e.target.value })}
                      className="bg-white dark:bg-gray-900/50 border-gray-200 dark:border-gray-700 focus:border-[#00C853] focus:ring-[#00C853] h-12 text-base"
                    />
                  </div>

                  {/* Time */}
                  <div className="space-y-2">
                    <Label htmlFor="time" className="text-sm md:text-base text-gray-700 dark:text-gray-300 flex items-center gap-2">
                      <Clock className="w-5 h-5 text-[#00C853]" />
                      Time
                    </Label>
                    <Input
                      id="time"
                      type="time"
                      value={searchParams.time}
                      onChange={(e) => setSearchParams({ ...searchParams, time: e.target.value })}
                      className="bg-white dark:bg-gray-900/50 border-gray-200 dark:border-gray-700 focus:border-[#00C853] focus:ring-[#00C853] h-12 text-base"
                    />
                  </div>
                </div>

                {/* Filters */}
                <div className="flex flex-wrap items-center gap-4 md:gap-6 mb-6 pb-6 border-b border-gray-200 dark:border-gray-700">
                  <div className="flex items-center gap-3">
                    <Switch
                      id="women-only"
                      checked={womenOnly}
                      onCheckedChange={setWomenOnly}
                      className="data-[state=checked]:bg-[#00C853]"
                    />
                    <Label htmlFor="women-only" className="text-sm md:text-base font-medium cursor-pointer dark:text-gray-300">
                      Women Only
                    </Label>
                  </div>
                  <div className="flex items-center gap-3">
                    <Switch
                      id="non-smoking"
                      checked={nonSmoking}
                      onCheckedChange={setNonSmoking}
                      className="data-[state=checked]:bg-[#00C853]"
                    />
                    <Label htmlFor="non-smoking" className="text-sm md:text-base font-medium cursor-pointer flex items-center gap-1 dark:text-gray-300">
                      <Cigarette className="w-5 h-5 line-through" />
                      Non-smoking
                    </Label>
                  </div>
                </div>

                {/* Search Button */}
                <Button
                  type="submit"
                  size="lg"
                  className="w-full bg-gradient-to-r from-[#00C853] to-emerald-600 hover:from-emerald-600 hover:to-[#00C853] text-white shadow-lg shadow-emerald-200 dark:shadow-emerald-900/30 text-lg h-14 md:h-16 text-base md:text-lg"
                >
                  <Search className="w-6 h-6 mr-2" />
                  Search Rides
                </Button>
              </form>
            </div>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div className="container mx-auto px-4 lg:px-8 py-16 md:py-20 dark:bg-gray-900">
        <div className="grid md:grid-cols-3 gap-8">
          <div className="text-center space-y-4 p-6">
            <div className="w-16 h-16 md:w-20 md:h-20 mx-auto bg-emerald-100 dark:bg-emerald-900/30 rounded-2xl flex items-center justify-center">
              <Leaf className="w-8 h-8 md:w-10 md:h-10 text-[#00C853] dark:text-emerald-400" />
            </div>
            <h3 className="text-xl md:text-2xl font-semibold dark:text-white">Eco-Friendly</h3>
            <p className="text-gray-600 dark:text-gray-400 text-base md:text-lg">Reduce carbon emissions by sharing rides with fellow commuters</p>
          </div>
          
          <div className="text-center space-y-4 p-6">
            <div className="w-16 h-16 md:w-20 md:h-20 mx-auto bg-amber-100 dark:bg-amber-900/30 rounded-2xl flex items-center justify-center">
              <svg className="w-8 h-8 md:w-10 md:h-10 text-amber-600 dark:text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="text-xl md:text-2xl font-semibold dark:text-white">Earn Points</h3>
            <p className="text-gray-600 dark:text-gray-400 text-base md:text-lg">Get rewarded with points for every ride you share or take</p>
          </div>
          
          <div className="text-center space-y-4 p-6">
            <div className="w-16 h-16 md:w-20 md:h-20 mx-auto bg-blue-100 dark:bg-blue-900/30 rounded-2xl flex items-center justify-center">
              <svg className="w-8 h-8 md:w-10 md:h-10 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <h3 className="text-xl md:text-2xl font-semibold dark:text-white">Safe Community</h3>
            <p className="text-gray-600 dark:text-gray-400 text-base md:text-lg">All drivers are verified and rated by our community</p>
          </div>
        </div>
      </div>
    </div>
  );
}