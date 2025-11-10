-- Enable public read access for stores
-- This allows unauthenticated users to view store pages

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view their own stores" ON public.stores;
DROP POLICY IF EXISTS "Allow all for now" ON public.stores;

-- Create public read policy
CREATE POLICY "Public can view all stores"
  ON public.stores
  FOR SELECT
  USING (true);

-- Keep write access restricted to authenticated users
CREATE POLICY "Authenticated users can create stores"
  ON public.stores
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Users can update their own stores"
  ON public.stores
  FOR UPDATE
  USING (
    auth.uid() IN (
      SELECT user_id FROM user_stores WHERE store_id = stores.id
    )
  );

CREATE POLICY "Users can delete their own stores"
  ON public.stores
  FOR DELETE
  USING (
    auth.uid() IN (
      SELECT user_id FROM user_stores WHERE store_id = stores.id
    )
  );

-- Grant SELECT to anon users
GRANT SELECT ON public.stores TO anon;
