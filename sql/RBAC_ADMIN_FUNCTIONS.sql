-- ================================================
-- Admin Query Functions (Bypass RLS for Performance)
-- ================================================
-- These functions have SECURITY DEFINER to bypass RLS
-- Use for admin queries that fetch all records

-- Get all user profiles (fast, bypasses RLS)
DROP FUNCTION IF EXISTS public.get_all_user_profiles(INT) CASCADE;
CREATE FUNCTION public.get_all_user_profiles(limit_count INT DEFAULT 500)
RETURNS TABLE (
  id UUID,
  email TEXT,
  role public.user_role,
  is_active BOOLEAN,
  created_at TIMESTAMP WITH TIME ZONE
) AS $$
  SELECT 
    up.id,
    up.email,
    up.role,
    up.is_active,
    up.created_at
  FROM public.user_profiles up
  ORDER BY up.created_at DESC
  LIMIT limit_count
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Get all stores (fast, bypasses RLS)
DROP FUNCTION IF EXISTS public.get_all_stores(INT) CASCADE;
CREATE FUNCTION public.get_all_stores(limit_count INT DEFAULT 500)
RETURNS TABLE (
  id TEXT,
  name TEXT,
  type TEXT,
  is_active BOOLEAN,
  user_id UUID,
  created_at TIMESTAMP WITH TIME ZONE
) AS $$
  SELECT 
    s.id,
    s.name,
    s.type,
    s.is_active,
    s.user_id,
    s.created_at
  FROM public.stores s
  ORDER BY s.created_at DESC
  LIMIT limit_count
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Grant access only to authenticated users (app layer checks super_admin)
GRANT EXECUTE ON FUNCTION public.get_all_user_profiles(INT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_all_stores(INT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_all_user_profiles(INT) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_all_stores(INT) TO service_role;
