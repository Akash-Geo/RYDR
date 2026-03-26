import { createBrowserRouter } from 'react-router-dom';
import RootLayout from './RootLayout';
import Login from './pages/Login';
import SignUp from './pages/SignUp';
import ForgotPassword from './pages/ForgotPassword';

// Passenger routes
import PassengerLayout from './pages/passenger/PassengerLayout';
import PassengerFindRide from './pages/passenger/FindRide';
import PassengerYourRide from './pages/passenger/YourRide';
import PassengerWallet from './pages/passenger/Wallet';

// Driver routes
import DriverLayout from './pages/driver/DriverLayout';
import DriverPostRide from './pages/driver/PostRide';
import DriverYourRide from './pages/driver/YourRide';

// Admin routes (keep existing)
import AdminLayout from './pages/admin/AdminLayout';
import AdminDashboard from './pages/admin/Dashboard';
import AdminDisputes from './pages/admin/Disputes';
import AdminVerification from './pages/admin/Verification';
import AdminUsers from './pages/admin/Users';
import NotificationsPage from './pages/Notifications';
import DisputeChat from './pages/DisputeChat';
import SupportChat from './pages/SupportChat';

// Reverting to original shared account interface
import PassengerAccount from './pages/passenger/Account';

export const router = createBrowserRouter([
  {
    Component: RootLayout,
    children: [
      // Auth routes
      {
        path: '/login',
        Component: Login,
      },
      {
        path: '/signup',
        Component: SignUp,
      },
      {
        path: '/forgot-password',
        Component: ForgotPassword,
      },

      // Shared Dispute Chat
      {
        path: '/dispute/:id',
        Component: DisputeChat,
      },
      {
        path: '/support-chat/:id',
        Component: SupportChat,
      },

      // Passenger routes
      {
        path: '/passenger',
        Component: PassengerLayout,
        children: [
          {
            path: 'find-ride',
            Component: PassengerFindRide,
          },
          {
            path: 'your-ride',
            Component: PassengerYourRide,
          },
          {
            path: 'account',
            Component: PassengerAccount,
          },
          {
            path: 'notifications',
            Component: NotificationsPage,
          },
          {
            path: 'wallet',
            Component: PassengerWallet,
          },
        ],
      },

      // Driver routes
      {
        path: '/driver',
        Component: DriverLayout,
        children: [
          {
            path: 'post-ride',
            Component: DriverPostRide,
          },
          {
            path: 'find-ride',
            Component: PassengerFindRide, // Reuse passenger find ride
          },
          {
            path: 'your-ride',
            Component: DriverYourRide,
          },
          {
            path: 'account',
            Component: PassengerAccount,
          },
          {
            path: 'wallet',
            Component: PassengerWallet, // Reuse
          },
          {
            path: 'notifications',
            Component: NotificationsPage,
          },
        ],
      },

      // Admin routes
      {
        path: '/admin',
        Component: AdminLayout,
        children: [
          {
            path: 'dashboard',
            Component: AdminDashboard,
          },
          {
            path: 'post-ride',
            Component: DriverPostRide, // reuse driver flow
          },
          {
            path: 'find-ride',
            Component: PassengerFindRide, // reuse passenger find ride
          },
          {
            path: 'your-ride',
            Component: DriverYourRide, // reuse driver your ride
          },
          {
            path: 'wallet',
            Component: PassengerWallet, // reuse wallet
          },
          {
            path: 'disputes',
            Component: AdminDisputes,
          },
          {
            path: 'verification',
            Component: AdminVerification,
          },
          {
            path: 'users',
            Component: AdminUsers,
          },
          {
            path: 'account',
            Component: PassengerAccount,
          },
          {
            path: 'notifications',
            Component: NotificationsPage,
          },
        ],
      },

      // Redirect root to login
      {
        path: '/',
        Component: Login,
      },
    ],
  },
]);