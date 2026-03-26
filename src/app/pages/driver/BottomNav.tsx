import { NavLink } from 'react-router-dom';
import { Home, PlusCircle, Bell, User } from 'lucide-react';
import { useUnreadNotifications } from './useUnreadNotifications';

export default function BottomNav({ userType }: { userType?: string }) {
  const { hasUnread, markAllAsRead } = useUnreadNotifications();

  const navLinkClasses = ({ isActive }: { isActive: boolean }) =>
    `flex flex-col items-center justify-center gap-1 text-xs transition-colors ${
      isActive ? 'text-emerald-500' : 'text-gray-500 dark:text-gray-400 hover:text-emerald-500'
    }`;

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 shadow-t-lg z-50">
      <div className="max-w-screen-xl mx-auto grid grid-cols-4 h-16">
        <NavLink to="/passenger/find-ride" className={navLinkClasses}>
          <Home className="w-6 h-6" />
          <span>Home</span>
        </NavLink>

        <NavLink to="/driver/post-ride" className={navLinkClasses}>
          <PlusCircle className="w-6 h-6" />
          <span>Post Ride</span>
        </NavLink>

        <NavLink to="/alerts" className={navLinkClasses} onClick={markAllAsRead}>
          <div className="relative">
            <Bell className="w-6 h-6" />
            {/* Alerts indicator */}
            {hasUnread && (
              <span className="absolute top-0 right-0 block w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white dark:border-gray-900" />
            )}
          </div>
          <span>Alerts</span>
        </NavLink>

        <NavLink to="/account" className={navLinkClasses}>
          <div className="relative">
            <User className="w-6 h-6" />
          </div>
          <span>Account</span>
        </NavLink>
      </div>
    </nav>
  );
}