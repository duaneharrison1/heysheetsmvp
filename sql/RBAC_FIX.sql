-- ================================================
-- RBAC Rollback & Diagnostic Script
-- ================================================
-- Run this if users can't log in after RBAC_SETUP.sql

-- Step 1: Check the trigger and re-create it properly
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users CASCADE;
DROP FUNCTION IF EXISTS public.handle_new_user();

-- Recreate the trigger function with better error handling
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_profiles (id, email, role)
  VALUES (NEW.id, NEW.email, 'user')
  ON CONFLICT (id) DO UPDATE 
  SET email = EXCLUDED.email;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate the trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Step 2: Drop problematic RLS policies on user_profiles
DROP POLICY IF EXISTS "Super admins can view all profiles" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can view their own profile" ON public.user_profiles;

-- Step 3: Recreate simpler, working RLS policies
CREATE POLICY "Users can view and update their own profile"
  ON public.user_profiles
  FOR ALL
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Step 4: Disable RLS temporarily to allow everyone to see user_profiles (for debugging)
-- Remove this later after confirming it works
ALTER TABLE public.user_profiles DISABLE ROW LEVEL SECURITY;

-- Step 5: Manually create profiles for existing auth users who don't have them
INSERT INTO public.user_profiles (id, email, role)
SELECT id, email, 'user'
FROM auth.users
ON CONFLICT (id) DO NOTHING;

-- Step 6: Verify the setup
SELECT 'User profiles created:' as check_name;
SELECT id, email, role FROM public.user_profiles LIMIT 5;

-- Step 7: Check auth.users
SELECT 'Auth users count:' as check_name;
SELECT COUNT(*) as total_users FROM auth.users;

-- ================================================
-- If you still can't log in:
-- 1. Check browser console for errors
-- 2. Run: SELECT * FROM auth.users;
-- 3. Verify email verification status
-- ================================================
