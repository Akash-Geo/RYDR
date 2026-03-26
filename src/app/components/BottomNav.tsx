import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Search, Car, User, Wallet, MapPin, ShieldCheck, Bell } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface BottomNavProps {
  userType: 'passenger' | 'driver' | 'admin';
}

export function BottomNav({ userType }: BottomNavProps) {
  const location = useLocation();
  const [unreadCount, setUnreadCount] = useState(0);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setUserId(user.id);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user?.id ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!userId) {
      setUnreadCount(0);
      return;
    }

    let mounted = true;
    const fetchCount = async () => {
      const { count } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .is('read_at', null);
      if (mounted) setUnreadCount(count || 0);
    };

    fetchCount();

    const channel = supabase
      .channel(`bottom_nav_alerts:${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
        () => fetchCount()
      )
      .subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(channel);
    };
  }, [userId]);

  // Refetch unread count when navigating to ensure UI is in sync
  useEffect(() => {
    if (!userId) return;
    const fetchCount = async () => {
      const { count } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .is('read_at', null);
      setUnreadCount(count || 0);
    };
    fetchCount();
  }, [location.pathname, userId]);

  const isActive = (path: string) => location.pathname.replace(/\/$/, '') === path.replace(/\/$/, '');

  const passengerLinks = [
    { path: `/passenger/find-ride`, label: 'Find Ride', icon: Search },
    { path: `/passenger/your-ride`, label: 'Your Rides', icon: Car },
    { path: `/passenger/notifications`, label: 'Alerts', icon: Bell },
    { path: `/passenger/wallet`, label: 'Wallet', icon: Wallet },
    { path: `/passenger/account`, label: 'Account', icon: User },
  ];

  const driverLinks = [
    { path: `/driver/post-ride`, label: 'Post Ride', icon: MapPin },
    { path: `/driver/find-ride`, label: 'Find Ride', icon: Search },
    { path: `/driver/your-ride`, label: 'Your Rides', icon: Car },
    { path: `/driver/notifications`, label: 'Alerts', icon: Bell },
    { path: `/driver/wallet`, label: 'Wallet', icon: Wallet },
    { path: `/driver/account`, label: 'Account', icon: User },
  ];

  const adminLinks = [
    { path: `/admin/dashboard`, label: 'Admin', icon: ShieldCheck },
    { path: `/admin/post-ride`, label: 'Post Ride', icon: MapPin },
    { path: `/admin/find-ride`, label: 'Find Ride', icon: Search },
    { path: `/admin/your-ride`, label: 'Your Rides', icon: Car },
    { path: `/admin/notifications`, label: 'Alerts', icon: Bell },
    { path: `/admin/wallet`, label: 'Wallet', icon: Wallet },
    { path: `/admin/account`, label: 'Account', icon: User },
  ];

  const links =
    userType === 'passenger' ? passengerLinks : userType === 'driver' ? driverLinks : adminLinks;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 shadow-lg">
      <div className="flex items-center justify-around max-w-screen-xl mx-auto">
        {links.map((link) => {
          const Icon = link.icon;
          const active = isActive(link.path);
          
          return (
            <Link
              key={link.path}
              to={link.path}
              className={`flex flex-col items-center justify-center py-3 px-4 min-w-[60px] transition-colors ${
                active
                  ? 'text-[#00C853] dark:text-emerald-400'
                  : 'text-gray-600 dark:text-gray-400 hover:text-[#00C853] dark:hover:text-emerald-400'
              }`}
            >
              <div className="relative">
                <Icon className={`w-6 h-6 mb-1 ${active ? 'scale-110' : ''} transition-transform`} />
                {/* Alerts indicator */}
                {link.label === 'Alerts' && unreadCount > 0 && !active && (
                  <span className="absolute top-0 right-0 block h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-white dark:ring-gray-900 transform translate-x-1/4 -translate-y-1/4" />
                )}
              </div>
              <span className={`text-xs font-medium ${active ? 'font-semibold' : ''}`}>
                {link.label}
              </span>
              {active && (
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-[#00C853] dark:bg-emerald-400 rounded-t-full" />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
