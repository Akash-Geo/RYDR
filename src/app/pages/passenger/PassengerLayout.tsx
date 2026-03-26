import { Outlet } from 'react-router-dom';
import { BottomNav } from '../../components/BottomNav';
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../context/AuthContext';

export default function PassengerLayout() {
  const navigate = useNavigate();
  const { sessionKey } = useAuth();

  useEffect(() => {
    let cancelled = false;
    async function checkRole() {
      const { data: authData } = await supabase.auth.getUser();
      const user = authData.user;
      if (!user) {
        navigate('/login', { replace: true });
        return;
      }
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .maybeSingle();
      if (cancelled) return;
      if (profile && profile.role !== 'passenger') {
        const target = profile.role === 'admin' ? '/admin/account' : `/${profile.role}/account`;
        navigate(target, { replace: true });
      }
    }

    void checkRole();
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-blue-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 pb-20">
      <Outlet key={sessionKey} />
      <BottomNav userType="passenger" />
    </div>
  );
}