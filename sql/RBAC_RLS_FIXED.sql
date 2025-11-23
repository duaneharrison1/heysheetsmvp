-- ================================================
-- RBAC RLS - Fixed (Only Super Admins see all profiles)
-- ================================================

-- Create a function to check if current user is super admin
DROP FUNCTION IF EXISTS public.is_super_admin() CASCADE;
CREATE FUNCTION public.is_super_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS(
    SELECT 1 FROM public.user_profiles
    WHERE id = auth.uid() AND role = 'super_admin'
  )
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Re-enable RLS
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- Drop old policies
DROP POLICY IF EXISTS "Users can view all profiles" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.user_profiles;

-- New policy: User can view own profile OR super admin can view all
CREATE POLICY "Users can view own profile or super admins see all"
  ON public.user_profiles
  FOR SELECT
  USING (auth.uid() = id OR public.is_super_admin());

-- Users can only update their own profile
CREATE POLICY "Users can update their own profile"
  ON public.user_profiles
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Grant execute on function
GRANT EXECUTE ON FUNCTION public.is_super_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_super_admin() TO service_role;
