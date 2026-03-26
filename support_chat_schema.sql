-- Create the support_chats table
CREATE TABLE IF NOT EXISTS public.support_chats (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    admin_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create the support_messages table
CREATE TABLE IF NOT EXISTS public.support_messages (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    chat_id UUID NOT NULL REFERENCES public.support_chats(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable Row Level Security
ALTER TABLE public.support_chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;

-- Policies for support_chats

-- Admins can view all chats
CREATE POLICY "Admins can view all chats" ON public.support_chats
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
        )
    );

-- Users can view their own chats
CREATE POLICY "Users can view their own chats" ON public.support_chats
    FOR SELECT
    USING (auth.uid() = user_id);

-- Only Admins can create chats (as per requirement)
CREATE POLICY "Admins can create chats" ON public.support_chats
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
        )
    );

-- Admins can update chats (e.g., to close them)
CREATE POLICY "Admins can update chats" ON public.support_chats
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
        )
    );

-- Policies for support_messages

-- Admins can view all messages
CREATE POLICY "Admins can view all messages" ON public.support_messages
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
        )
    );

-- Users can view messages in their own chats
CREATE POLICY "Users can view messages in their own chats" ON public.support_messages
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.support_chats
            WHERE support_chats.id = support_messages.chat_id
            AND support_chats.user_id = auth.uid()
        )
    );

-- Admins can send messages
CREATE POLICY "Admins can send messages" ON public.support_messages
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
        )
    );

-- Users can send messages only if the chat belongs to them and is open
CREATE POLICY "Users can send messages in open chats" ON public.support_messages
    FOR INSERT
    WITH CHECK (
        auth.uid() = sender_id AND
        EXISTS (
            SELECT 1 FROM public.support_chats
            WHERE support_chats.id = chat_id
            AND support_chats.user_id = auth.uid()
            AND support_chats.status = 'open'
        )
    );

-- Enable realtime for these tables
alter publication supabase_realtime add table public.support_chats;
alter publication supabase_realtime add table public.support_messages;