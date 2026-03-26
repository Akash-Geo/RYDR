-- Enable Realtime broadcasting for disputes and dispute_messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.disputes;
ALTER PUBLICATION supabase_realtime ADD TABLE public.dispute_messages;
