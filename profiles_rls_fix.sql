-- This script sets up the necessary Row Level Security (RLS) policies for the `profiles` table.
-- The error "Update failed: User not found or permission denied" is almost always caused by
-- a missing or incorrect RLS policy for admins trying to update other users' records.

-- Run this entire script in your Supabase SQL Editor to fix the issue.

-- ----------------------------------------------------------------
-- 1. ENABLE RLS on the profiles table (if not already enabled)
-- ----------------------------------------------------------------
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;


-- ----------------------------------------------------------------
-- 2. DROP existing policies to avoid conflicts
-- It's safer to drop and recreate them to ensure they are correct.
-- ----------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can update any profile" ON public.profiles;
-- A public read policy might exist, let's remove it to be secure.
DROP POLICY IF EXISTS "Public profiles are viewable by everyone." ON public.profiles;


-- ----------------------------------------------------------------
-- 3. CREATE new SELECT policies
-- ----------------------------------------------------------------

-- Users can view their own profile.
CREATE POLICY "Users can view their own profile"
ON public.profiles FOR SELECT
USING ( auth.uid() = id );

-- Admins can view all profiles.
CREATE POLICY "Admins can view all profiles"
ON public.profiles FOR SELECT
USING ( (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin' );


-- ----------------------------------------------------------------
-- 4. CREATE new UPDATE policies
-- ----------------------------------------------------------------

-- Users can update their own profile (needed for account management).
CREATE POLICY "Users can update their own profile"
ON public.profiles FOR UPDATE
USING ( auth.uid() = id ) WITH CHECK ( auth.uid() = id );

-- **THIS IS THE FIX**: Admins can update any profile.
CREATE POLICY "Admins can update any profile"
ON public.profiles FOR UPDATE
USING ( (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin' );