-- ================================================
-- EMERGENCY: Restore Original Stores RLS
-- ================================================
-- Run this to restore access to stores

-- Drop the broken policy
DROP POLICY IF EXISTS "Users can view their own stores or super admin views all" ON public.stores;

-- Restore the original policy that just checks user_id
CREATE POLICY "Users can view their own stores"
  ON public.stores
  FOR SELECT
  USING (auth.uid() = user_id);

-- Verify it's restored
SELECT * FROM pg_policies WHERE tablename = 'stores' AND policyname LIKE '%view%';
