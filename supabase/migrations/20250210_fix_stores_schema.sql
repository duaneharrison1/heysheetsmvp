-- Fix stores table schema to match application code
-- This migration aligns the database with what the code expects

-- Step 1: Add user_id column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'stores' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE public.stores ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

    -- Migrate existing stores: set user_id from owner_email if possible
    -- You'll need to manually set these or they'll be NULL
    UPDATE public.stores
    SET user_id = (
      SELECT id FROM auth.users
      WHERE email = stores.owner_email
      LIMIT 1
    )
    WHERE owner_email IS NOT NULL;
  END IF;
END $$;

-- Step 2: Fix the ID column to auto-generate store- prefix
-- First, create a function to generate store IDs
CREATE OR REPLACE FUNCTION generate_store_id()
RETURNS TEXT AS $$
BEGIN
  RETURN 'store-' || substr(md5(random()::text), 1, 8);
END;
$$ LANGUAGE plpgsql;

-- Set default for new inserts
ALTER TABLE public.stores
  ALTER COLUMN id SET DEFAULT generate_store_id();

-- Step 3: Add missing columns from migrations if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'stores' AND column_name = 'type'
  ) THEN
    ALTER TABLE public.stores ADD COLUMN type TEXT DEFAULT 'general';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'stores' AND column_name = 'logo'
  ) THEN
    ALTER TABLE public.stores ADD COLUMN logo TEXT;
  END IF;
END $$;

-- Step 4: Create index on user_id if it doesn't exist
CREATE INDEX IF NOT EXISTS stores_user_id_idx ON public.stores(user_id);

-- Step 5: Update RLS policies to work with both user_id and user_stores
-- Drop conflicting policies
DROP POLICY IF EXISTS "Users can view their own stores" ON public.stores;
DROP POLICY IF EXISTS "Users can create their own stores" ON public.stores;
DROP POLICY IF EXISTS "Users can update their own stores" ON public.stores;
DROP POLICY IF EXISTS "Users can delete their own stores" ON public.stores;
DROP POLICY IF EXISTS "Authenticated users can create stores" ON public.stores;

-- Public read access (already exists from previous migration)
DROP POLICY IF EXISTS "Public can view all stores" ON public.stores;
CREATE POLICY "Public can view all stores"
  ON public.stores
  FOR SELECT
  USING (true);

-- Write policies for authenticated users
CREATE POLICY "Authenticated users can create stores"
  ON public.stores
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = user_id);

CREATE POLICY "Users can update own stores"
  ON public.stores
  FOR UPDATE
  USING (
    auth.uid() = user_id OR
    auth.uid() IN (
      SELECT user_id FROM user_stores WHERE store_id = stores.id
    )
  );

CREATE POLICY "Users can delete own stores"
  ON public.stores
  FOR DELETE
  USING (
    auth.uid() = user_id OR
    auth.uid() IN (
      SELECT user_id FROM user_stores WHERE store_id = stores.id
    )
  );

-- Step 6: Ensure grants are correct
GRANT SELECT ON public.stores TO anon;
GRANT ALL ON public.stores TO authenticated;
GRANT ALL ON public.stores TO service_role;
