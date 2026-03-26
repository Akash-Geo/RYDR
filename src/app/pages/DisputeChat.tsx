import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Send, CheckCircle, ArrowLeft, ShieldAlert, Lock } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';

interface Message {
  id: string;
  dispute_id: string;
  sender_id: string | null; // null for system messages
  content: string;
  created_at: string;
}

interface Dispute {
  id: string;
  status: 'open' | 'resolved';
  ride_id: string;
  raised_by: string;
}

export default function DisputeChat() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [dispute, setDispute] = useState<Dispute | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentUserRole, setCurrentUserRole] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    let mounted = true;

    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      if (mounted) setCurrentUserId(user.id);

      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();
      if (mounted && profile) setCurrentUserRole(profile.role);

      if (!id) return;

      const { data: disputeData, error: disputeError } = await supabase
        .from('disputes')
        .select('*')
        .eq('id', id)
        .single();

      if (disputeError) {
        console.error(disputeError);
      } else if (mounted) {
        setDispute(disputeData);
      }

      const { data: msgs, error: msgsError } = await supabase
        .from('dispute_messages')
        .select('*')
        .eq('dispute_id', id)
        .order('created_at', { ascending: true });

      if (msgsError) console.error(msgsError);
      if (mounted && msgs) setMessages(msgs);
      if (mounted) setLoading(false);
    }

    load();

    if (!id) return;

    const channel = supabase
      .channel(`dispute:${id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'dispute_messages', filter: `dispute_id=eq.${id}` },
        (payload) => {
          const newMsg = payload.new as Message;
          setMessages((prev) => {
            if (prev.some((msg) => msg.id === newMsg.id)) return prev;
            return [...prev, newMsg];
          });
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'disputes', filter: `id=eq.${id}` },
        (payload) => {
          const updated = payload.new as Dispute;
          setDispute(updated);
        }
      )
      .subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(channel);
    };
  }, [id]);

  const handleSend = async () => {
    if (!newMessage.trim() || !id || !currentUserId) return;

    const msgContent = newMessage.trim();
    setNewMessage('');

    const { data, error } = await supabase.from('dispute_messages').insert({
      dispute_id: id,
      sender_id: currentUserId,
      content: msgContent,
    }).select().single();

    if (error) {
      console.error(error);
    } else if (data) {
      setMessages((prev) => {
        if (prev.some((msg) => msg.id === data.id)) return prev;
        return [...prev, data];
      });

      console.log('Message sent. Checking notification logic:', { role: currentUserRole, hasDispute: !!dispute });
      if (currentUserRole === 'admin' && dispute) {
        const { error: notifError } = await supabase.from('notifications').insert({
          user_id: dispute.raised_by,
          type: 'dispute_reply',
          title: 'New message from Admin',
          body: 'Admin has replied to your dispute.',
          related_ride_id: dispute.ride_id,
        });
        if (notifError) console.error('Failed to send notification DB error:', notifError);
        else console.log('Notification sent successfully');
      }
    }
  };

  const handleResolve = async () => {
    if (!id) return;
    const { error } = await supabase.from('disputes').update({ status: 'resolved' }).eq('id', id);

    if (error) {
      console.error(error);
    } else if (currentUserRole === 'admin' && dispute) {
      await supabase.from('notifications').insert({
        user_id: dispute.raised_by,
        type: 'dispute_reply',
        title: 'Dispute Resolved',
        body: 'Your dispute has been marked as resolved.',
        related_ride_id: dispute.ride_id,
      });
    }
  };

  if (loading) return <div className="p-8 text-center">Loading chat...</div>;

  return (
    <div className="flex flex-col h-screen bg-gray-50 dark:bg-gray-900">
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-4 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="font-semibold text-lg text-gray-900 dark:text-white flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-red-500" />
              Dispute Resolution
            </h1>
            <p className="text-xs text-gray-500 dark:text-gray-400">ID: {id?.slice(0, 8)}...</p>
          </div>
        </div>
        {dispute?.status === 'resolved' ? (
          <div className="flex items-center gap-2 text-green-600 bg-green-50 dark:bg-green-900/20 px-3 py-1 rounded-full text-sm font-medium">
            <CheckCircle className="w-4 h-4" />
            Resolved
          </div>
        ) : currentUserRole === 'admin' ? (
          <Button onClick={handleResolve} className="bg-green-600 hover:bg-green-700 text-white">
            Mark Resolved
          </Button>
        ) : (
          <div className="flex items-center gap-2 text-amber-600 bg-amber-50 dark:bg-amber-900/20 px-3 py-1 rounded-full text-sm font-medium">
            Open
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg) => {
          const isSystem = !msg.sender_id || msg.content.startsWith('System:');
          const isMe = msg.sender_id === currentUserId && !isSystem;
          
          if (isSystem) {
            return (
              <div key={msg.id} className="flex justify-center my-4">
                <div className="bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-xs px-4 py-2 rounded-full max-w-[80%] text-center whitespace-pre-wrap">
                  {msg.content}
                </div>
              </div>
            );
          }

          return (
            <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] rounded-2xl px-4 py-3 ${isMe ? 'bg-blue-600 text-white rounded-tr-none' : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white rounded-tl-none'}`}>
                <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                <p className={`text-[10px] mt-1 ${isMe ? 'text-blue-100' : 'text-gray-400'}`}>
                  {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-4 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
        {dispute?.status === 'resolved' ? (
          <div className="text-center text-gray-500 dark:text-gray-400 text-sm flex items-center justify-center gap-2">
            <Lock className="w-4 h-4" />
            This dispute has been resolved. Chat is closed.
          </div>
        ) : (
          <div className="flex gap-2">
            <Input
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder="Type your message..."
              className="flex-1"
            />
            <Button onClick={handleSend} size="icon" className="bg-blue-600 hover:bg-blue-700 text-white">
              <Send className="w-5 h-5" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}