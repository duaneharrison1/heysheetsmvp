-- ================================================
-- RBAC Performance Optimization
-- ================================================
-- Add missing indexes for admin queries

-- Index for created_at sorting (used in AdminUsers and AdminDashboard)
CREATE INDEX IF NOT EXISTS user_profiles_created_at_idx ON public.user_profiles(created_at DESC);

-- Composite index for role + is_active (used for filtering super admins)
CREATE INDEX IF NOT EXISTS user_profiles_role_is_active_idx ON public.user_profiles(role, is_active);

-- Index on email (used for lookups)
CREATE INDEX IF NOT EXISTS user_profiles_email_idx ON public.user_profiles(email);

-- For stores table, add missing indexes
CREATE INDEX IF NOT EXISTS stores_created_at_idx ON public.stores(created_at DESC);
CREATE INDEX IF NOT EXISTS stores_user_id_created_at_idx ON public.stores(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS stores_is_active_idx ON public.stores(is_active);
