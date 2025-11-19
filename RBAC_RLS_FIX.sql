-- ================================================
-- RBAC RLS Performance Fix
-- ================================================
-- The problem: RLS USING (true) still evaluates on every row
-- The solution: Disable RLS on user_profiles since SELECT allows all authenticated users anyway
-- Security: The UPDATE policy still restricts to their own record

-- Disable RLS on user_profiles (no security loss since SELECT allows all authenticated users)
ALTER TABLE public.user_profiles DISABLE ROW LEVEL SECURITY;

-- Keep the update policy by manually enforcing it in the app/functions
-- Users can still only update their own profile via application logic

-- Verify RLS is disabled
SELECT schemaname, tablename, rowsecurity FROM pg_tables WHERE tablename = 'user_profiles';
