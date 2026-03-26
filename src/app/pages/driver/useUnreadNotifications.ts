import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';

export function useUnreadNotifications() {
  const [hasUnread, setHasUnread] = useState(false);

  useEffect(() => {
    let mounted = true;
    let channel: any = null;

    const setup = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user || !mounted) return;

        const fetchUnreadStatus = async () => {
          const { count } = await supabase
            .from('notifications')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', user.id)
            .is('read_at', null);

          if (mounted) {
            setHasUnread(count !== null && count > 0);
          }
        };

        await fetchUnreadStatus();

        channel = supabase
          .channel(`notifications:${user.id}`)
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'notifications',
              filter: `user_id=eq.${user.id}`,
            },
            () => {
              fetchUnreadStatus();
            }
          )
          .subscribe();
      } catch (error) {
        console.error('Error checking notifications:', error);
      }
    };

    setup();

    return () => {
      mounted = false;
      if (channel) supabase.removeChannel(channel);
    };
  }, []);

  const markAllAsRead = async () => {
    // Optimistic update
    setHasUnread(false);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from('notifications')
        .update({ read_at: new Date().toISOString() })
        .eq('user_id', user.id)
        .is('read_at', null);

      if (error) {
        console.error('Error marking notifications as read:', error);
      }
    } catch (error) {
      console.error('Error in markAllAsRead:', error);
    }
  };

  return { hasUnread, markAllAsRead };
}