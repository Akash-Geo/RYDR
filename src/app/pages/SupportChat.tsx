import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Send, ArrowLeft, MessageCircle, Lock, CheckCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';

interface Message {
  id: string;
  chat_id: string;
  sender_id: string;
  content: string;
  created_at: string;
}

interface SupportChat {
  id: string;
  status: 'open' | 'closed';
  user_id: string;
  admin_id: string;
}

export default function SupportChat() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [chat, setChat] = useState<SupportChat | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUserRole, setCurrentUserRole] = useState<string | null>(null);
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

      const { data: chatData, error: chatError } = await supabase
        .from('support_chats')
        .select('*')
        .eq('id', id)
        .single();

      if (chatError) {
        console.error(chatError);
      } else if (mounted) {
        setChat(chatData);
      }

      const { data: msgs, error: msgsError } = await supabase
        .from('support_messages')
        .select('*')
        .eq('chat_id', id)
        .order('created_at', { ascending: true });

      if (msgsError) console.error(msgsError);
      if (mounted && msgs) setMessages(msgs);
      if (mounted) setLoading(false);
    }

    load();

    if (!id) return;

    const channel = supabase
      .channel(`support_chat:${id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'support_messages', filter: `chat_id=eq.${id}` },
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
        { event: 'UPDATE', schema: 'public', table: 'support_chats', filter: `id=eq.${id}` },
        (payload) => {
          const updated = payload.new as SupportChat;
          setChat(updated);
        }
      )
      .subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(channel);
    };
  }, [id]);

  const handleSend = async () => {
    if (!newMessage.trim() || !id || !currentUserId || chat?.status === 'closed') return;

    const msgContent = newMessage.trim();
    setNewMessage('');

    const { error } = await supabase.from('support_messages').insert({
      chat_id: id,
      sender_id: currentUserId,
      content: msgContent,
    });

    if (error) {
      console.error(error);
      alert('Failed to send message');
    }
    
    // Notification logic
    if (!error && currentUserRole === 'admin' && chat) {
      const { error: notifError } = await supabase.from('notifications').insert({
        user_id: chat.user_id,
        type: 'support_message',
        title: 'New message from Admin',
        body: 'You have a new message from support.',
      });
      if (notifError) console.error('Failed to send notification:', notifError);
    }
  };

  const handleEndChat = async () => {
    if (!id || !confirm('Are you sure you want to end this chat? The user will no longer be able to reply.')) return;
    
    const { error } = await supabase
      .from('support_chats')
      .update({ status: 'closed' })
      .eq('id', id);

    if (error) {
      console.error(error);
      alert('Failed to end chat');
    } else if (currentUserRole === 'admin' && chat) {
      await supabase.from('notifications').insert({
        user_id: chat.user_id,
        type: 'support_message',
        title: 'Support Chat Ended',
        body: 'The admin has ended this support chat.',
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
              <MessageCircle className="w-5 h-5 text-blue-500" />
              Support Chat
            </h1>
            <p className="text-xs text-gray-500 dark:text-gray-400">ID: {id?.slice(0, 8)}...</p>
          </div>
        </div>
        {chat?.status === 'closed' ? (
          <div className="flex items-center gap-2 text-gray-500 bg-gray-100 dark:bg-gray-700 px-3 py-1 rounded-full text-sm font-medium">
            <Lock className="w-4 h-4" />
            Chat Ended
          </div>
        ) : currentUserRole === 'admin' ? (
          <Button onClick={handleEndChat} variant="destructive" size="sm">
            End Chat
          </Button>
        ) : (
          <div className="flex items-center gap-2 text-green-600 bg-green-50 dark:bg-green-900/20 px-3 py-1 rounded-full text-sm font-medium">
            <CheckCircle className="w-4 h-4" />
            Active
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg) => {
          const isMe = msg.sender_id === currentUserId;
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
        {chat?.status === 'closed' ? (
          <div className="text-center text-gray-500 dark:text-gray-400 text-sm flex items-center justify-center gap-2">
            <Lock className="w-4 h-4" />
            This chat has been ended by the admin.
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