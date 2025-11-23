-- ================================================
-- Role-Based Access Control (RBAC) Setup
-- ================================================
-- Creates user roles and super admin access

-- 1. Create user_roles enum type
CREATE TYPE public.user_role AS ENUM ('user', 'super_admin');

-- 2. Create user_profiles table to store roles
CREATE TABLE IF NOT EXISTS public.user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE,
  role public.user_role DEFAULT 'user',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create index for role lookups
CREATE INDEX IF NOT EXISTS user_profiles_role_idx ON public.user_profiles(role);

-- Enable RLS on user_profiles
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can view their own profile
DROP POLICY IF EXISTS "Users can view their own profile" ON public.user_profiles;
CREATE POLICY "Users can view their own profile"
  ON public.user_profiles
  FOR SELECT
  USING (auth.uid() = id);

-- RLS Policy: Super admins can view all profiles
DROP POLICY IF EXISTS "Super admins can view all profiles" ON public.user_profiles;
CREATE POLICY "Super admins can view all profiles"
  ON public.user_profiles
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid() AND role = 'super_admin'
    )
  );

-- Grant permissions
GRANT SELECT ON public.user_profiles TO authenticated;
GRANT ALL ON public.user_profiles TO service_role;

-- 3. Update stores RLS to allow super_admin to view all stores
-- This replaces the existing "Users can view their own stores" policy
DROP POLICY IF EXISTS "Users can view their own stores" ON public.stores;
CREATE POLICY "Users can view their own stores or super admin views all"
  ON public.stores
  FOR SELECT
  USING (
    auth.uid() = user_id OR
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid() AND role = 'super_admin'
    )
  );

-- Note: The CREATE, UPDATE, DELETE policies from DATABASE_SETUP.sql remain unchanged
-- Regular users can only create/update/delete their own stores
-- Super admins don't need special permissions for CRUD - use service_role for admin operations

-- 4. Create trigger to auto-create user profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_profiles (id, email, role)
  VALUES (NEW.id, NEW.email, 'user')
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- 5. Create trigger for updated_at on user_profiles
CREATE OR REPLACE FUNCTION public.handle_user_profiles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_user_profiles_updated_at ON public.user_profiles;
CREATE TRIGGER set_user_profiles_updated_at
  BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_user_profiles_updated_at();

-- ================================================
-- CREATE DEFAULT SUPER ADMIN ACCOUNT
-- ================================================
-- IMPORTANT: Create the auth user via Supabase Dashboard first!
-- Steps:
-- 1. Go to Supabase Dashboard > Authentication > Users
-- 2. Click "Create new user"
-- 3. Email: admin@heysheets.com
-- 4. Password: HeySheets2025Admin!
-- 5. Copy the generated UUID
-- 6. Replace '11111111-2222-3333-4444-555555555555' with that UUID in the query below
-- 7. Run this query

-- After creating the auth user, create the user profile with super_admin role
-- Make sure to replace the UUID with your actual admin user's ID
INSERT INTO public.user_profiles (id, email, role, is_active)
VALUES ('d7f40e57-ffa8-49dd-ae55-7fdb11e7be0d', 'admin@heysheets.com', 'super_admin', true)
ON CONFLICT (id) DO UPDATE SET role = 'super_admin';

-- Verify the admin was created
-- SELECT id, email, role FROM public.user_profiles WHERE role = 'super_admin';

-- ================================================
-- IMPORTANT: NEXT STEPS
-- ================================================
-- 1. Create the admin user via Supabase Dashboard:
--    - Go to Authentication > Users > Create new user
--    - Email: admin@heysheets.com
--    - Password: HeySheets2025Admin!
-- 2. Copy the generated User ID
-- 3. Replace '11111111-2222-3333-4444-555555555555' with the User ID in the SQL above
-- 4. Run the INSERT query to assign the super_admin role
-- 5. CHANGE THE PASSWORD IMMEDIATELY IN PRODUCTION!
-- ================================================
