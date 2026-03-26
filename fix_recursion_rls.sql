-- Fix for 500 Error (Infinite Recursion in RLS)

-- 1. Create a secure function to check admin status
-- SECURITY DEFINER ensures it runs with system privileges, bypassing RLS to avoid the infinite loop
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
    AND role = 'admin'
  );
END;
$$;

-- 2. Update Profiles Policies to use the new function
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
CREATE POLICY "Admins can view all profiles" ON public.profiles
FOR SELECT USING ( is_admin() );

DROP POLICY IF EXISTS "Admins can update any profile" ON public.profiles;
CREATE POLICY "Admins can update any profile" ON public.profiles
FOR UPDATE USING ( is_admin() );

-- 3. Update Support Chat Policies (to prevent recursion there too)
-- These policies also query the profiles table, so they need the fix as well.

DROP POLICY IF EXISTS "Admins can view all chats" ON public.support_chats;
CREATE POLICY "Admins can view all chats" ON public.support_chats
FOR SELECT USING ( is_admin() );

DROP POLICY IF EXISTS "Admins can create chats" ON public.support_chats;
CREATE POLICY "Admins can create chats" ON public.support_chats
FOR INSERT WITH CHECK ( is_admin() );

DROP POLICY IF EXISTS "Admins can update chats" ON public.support_chats;
CREATE POLICY "Admins can update chats" ON public.support_chats
FOR UPDATE USING ( is_admin() );

DROP POLICY IF EXISTS "Admins can view all messages" ON public.support_messages;
CREATE POLICY "Admins can view all messages" ON public.support_messages
FOR SELECT USING ( is_admin() );

DROP POLICY IF EXISTS "Admins can send messages" ON public.support_messages;
CREATE POLICY "Admins can send messages" ON public.support_messages
FOR INSERT WITH CHECK ( is_admin() );

-- 4. Allow authenticated users to view profiles (so passengers can see driver avatars and vice versa)
DROP POLICY IF EXISTS "Authenticated users can view profiles" ON public.profiles;
CREATE POLICY "Authenticated users can view profiles" ON public.profiles
FOR SELECT TO authenticated USING ( true );

-- 5. Allow authenticated users to view avatars in storage
DROP POLICY IF EXISTS "Authenticated users can view avatars" ON storage.objects;
CREATE POLICY "Authenticated users can view avatars" ON storage.objects
FOR SELECT TO authenticated USING ( bucket_id = 'avatars' );

-- 6. Allow users to insert notifications (needed for bookings, cancellations, admin messages)
DROP POLICY IF EXISTS "Users can insert notifications" ON public.notifications;
CREATE POLICY "Users can insert notifications" ON public.notifications
FOR INSERT TO authenticated WITH CHECK (true);

-- 7. Allow users to view their own notifications
DROP POLICY IF EXISTS "Users can view own notifications" ON public.notifications;
CREATE POLICY "Users can view own notifications" ON public.notifications
FOR SELECT TO authenticated USING (user_id = auth.uid());

-- 8. Allow users to update (mark as read) their own notifications
DROP POLICY IF EXISTS "Users can update own notifications" ON public.notifications;
CREATE POLICY "Users can update own notifications" ON public.notifications
FOR UPDATE TO authenticated USING (user_id = auth.uid());

-- 9. Allow Admins to view and manage disputes
DROP POLICY IF EXISTS "Admins can view all disputes" ON public.disputes;
CREATE POLICY "Admins can view all disputes" ON public.disputes
FOR SELECT USING ( is_admin() );

DROP POLICY IF EXISTS "Admins can update disputes" ON public.disputes;
CREATE POLICY "Admins can update disputes" ON public.disputes
FOR UPDATE USING ( is_admin() );

-- 10. Allow Admins to view and send dispute messages
DROP POLICY IF EXISTS "Admins can view dispute messages" ON public.dispute_messages;
CREATE POLICY "Admins can view dispute messages" ON public.dispute_messages
FOR SELECT USING ( is_admin() );

DROP POLICY IF EXISTS "Admins can insert dispute messages" ON public.dispute_messages;
CREATE POLICY "Admins can insert dispute messages" ON public.dispute_messages
FOR INSERT WITH CHECK ( is_admin() );

-- 11. Add missing notification types to the enum
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'support_message';
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'dispute_reply';
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'booking_created';
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'ride_cancelled_passenger';
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'ride_cancelled_driver';
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'booking_cancelled_driver';