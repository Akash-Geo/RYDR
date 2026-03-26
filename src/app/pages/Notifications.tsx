import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, CheckCircle2, MessageCircle } from 'lucide-react';
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
  const navigate = useNavigate();
  const [items, setItems] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let channel: any;

    async function load() {
      setLoading(true);
      try {
        const { data: authData, error: authError } = await supabase.auth.getUser();
        if (authError || !authData.user) return;
        const user = authData.user;

        // Check for active support chat
        const { data: chatData } = await supabase
          .from('support_chats')
          .select('id')
          .eq('user_id', user.id)
          .eq('status', 'open')
          .maybeSingle();

        if (!cancelled && chatData) {
          setActiveChatId(chatData.id);
        }

        const { data, error } = await supabase
          .from('notifications')
          .select('id, type, title, body, created_at, read_at')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(50);

        if (error) throw error;
        if (!cancelled) setItems(data ?? []);

        // subscribe so new notifications appear immediately
        channel = supabase
          .channel('notifications_user')
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` },
            (payload) => {
              if (payload.eventType === 'INSERT' && payload.new) {
                setItems((prev) => [payload.new as Notification, ...prev]);
              } else if (payload.eventType === 'UPDATE' && payload.new) {
                setItems((prev) =>
                  prev.map((n) => (n.id === (payload.new as Notification).id ? (payload.new as Notification) : n)),
                );
              }
            },
          )
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'support_chats', filter: `user_id=eq.${user.id}` },
            (payload) => {
              const record = payload.new as { id: string; status: string } | null;
              if (record?.status === 'open') {
                setActiveChatId(record.id);
              } else if (record?.status === 'closed') {
                setActiveChatId((current) => (current === record.id ? null : current));
              }
            }
          )
          .subscribe();
      } catch (err) {
        console.error('Failed to load notifications', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
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

  const hasUnread = items.some((n) => !n.read_at);

  return (
    <div className="min-h-screen">
      <div className="bg-gradient-to-r from-[#00C853] to-emerald-600 px-4 pt-6 pb-8">
        <div className="max-w-screen-xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-white mb-1">Notifications</h1>
            <p className="text-emerald-100">Updates about your rides and verification</p>
          </div>
          <div className="flex items-center gap-4">
            {activeChatId && (
              <Button
                className="bg-emerald-500 text-white hover:bg-emerald-400 relative w-14 h-14 rounded-full shadow-lg border-0"
                onClick={() => navigate(`/support-chat/${activeChatId}`)}
                title="Message Admin"
              >
                <MessageCircle className="w-8 h-8" />
                <span className="absolute top-1 right-1 block h-3.5 w-3.5 rounded-full bg-red-500 border-2 border-emerald-500" />
              </Button>
            )}
            <Bell className="w-8 h-8 text-white/80" />
          </div>
        </div>
      </div>

      <div className="max-w-screen-xl mx-auto px-4 -mt-4 pb-24">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              {loading ? 'Loading…' : 'Recent notifications'}
            </h2>
            {hasUnread && (
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
                    {new Date(n.created_at).toLocaleString('en-GB')}
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
