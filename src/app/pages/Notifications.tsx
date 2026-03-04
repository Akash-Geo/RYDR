import { useEffect, useState } from 'react';
import { Bell, CheckCircle2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Button } from '../components/ui/button';

interface Notification {
  id: string;
  type: string;
  title: string;
  body: string;
  created_at: string;
  read_at: string | null;
}

export default function NotificationsPage() {
  const [items, setItems] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const { data: authData, error: authError } = await supabase.auth.getUser();
        if (authError) throw authError;
        const user = authData.user;
        if (!user) return;

        const { data, error } = await supabase
          .from('notifications')
          .select('id, type, title, body, created_at, read_at')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(50);

        if (error) throw error;
        if (!cancelled) setItems(data ?? []);
      } catch (err) {
        console.error('Failed to load notifications', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const markAllRead = async () => {
    try {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      const user = authData.user;
      if (!user) return;

      const { error } = await supabase
        .from('notifications')
        .update({ read_at: new Date().toISOString() })
        .eq('user_id', user.id)
        .is('read_at', null);

      if (error) throw error;

      setItems((prev) => prev.map((n) => ({ ...n, read_at: n.read_at ?? new Date().toISOString() })));
    } catch (err) {
      console.error('Failed to mark notifications read', err);
    }
  };

  return (
    <div className="min-h-screen">
      <div className="bg-gradient-to-r from-[#00C853] to-emerald-600 px-4 pt-6 pb-8">
        <div className="max-w-screen-xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-white mb-1">Notifications</h1>
            <p className="text-emerald-100">Updates about your rides and verification</p>
          </div>
          <Bell className="w-8 h-8 text-white/80" />
        </div>
      </div>

      <div className="max-w-screen-xl mx-auto px-4 -mt-4 pb-24">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              {loading ? 'Loading…' : 'Recent notifications'}
            </h2>
            {items.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={markAllRead}
                className="h-9 px-3 text-xs md:text-sm dark:border-gray-700 dark:text-gray-300"
              >
                <CheckCircle2 className="w-4 h-4 mr-1" />
                Mark all read
              </Button>
            )}
          </div>

          {items.length === 0 && !loading && (
            <div className="py-10 text-center text-gray-600 dark:text-gray-400">
              No notifications yet.
            </div>
          )}

          <div className="space-y-3">
            {items.map((n) => (
              <div
                key={n.id}
                className={`p-4 rounded-xl border text-sm ${
                  n.read_at
                    ? 'bg-gray-50 dark:bg-gray-900/40 border-gray-200 dark:border-gray-700'
                    : 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-700'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <p className="font-semibold text-gray-900 dark:text-white">{n.title}</p>
                  <span className="text-[11px] text-gray-500 dark:text-gray-400">
                    {new Date(n.created_at).toLocaleString()}
                  </span>
                </div>
                <p className="text-gray-700 dark:text-gray-300">{n.body}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

