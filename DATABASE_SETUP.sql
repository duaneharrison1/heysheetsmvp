-- ================================================
-- HeySheets MVP Database Setup
-- ================================================
-- Run this script in Supabase SQL Editor:
-- https://supabase.com/dashboard/project/iyzpedfkgzkxyciephgi/sql
--
-- This creates the stores table with RLS policies
-- ================================================

-- Drop existing table if you want to start fresh (CAUTION: deletes data!)
-- DROP TABLE IF EXISTS public.stores CASCADE;

-- Create stores table
CREATE TABLE IF NOT EXISTS public.stores (
  id TEXT PRIMARY KEY DEFAULT ('store-' || substr(md5(random()::text), 1, 8)),
  name TEXT NOT NULL,
  type TEXT DEFAULT 'general',
  logo TEXT,
  sheet_id TEXT,
  system_prompt TEXT,
  detected_tabs JSONB DEFAULT '[]'::jsonb,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS stores_user_id_idx ON public.stores(user_id);
CREATE INDEX IF NOT EXISTS stores_sheet_id_idx ON public.stores(sheet_id);

-- Enable Row Level Security (RLS)
ALTER TABLE public.stores ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view their own stores" ON public.stores;
DROP POLICY IF EXISTS "Users can create their own stores" ON public.stores;
DROP POLICY IF EXISTS "Users can update their own stores" ON public.stores;
DROP POLICY IF EXISTS "Users can delete their own stores" ON public.stores;

-- Create RLS policies
CREATE POLICY "Users can view their own stores"
  ON public.stores
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own stores"
  ON public.stores
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own stores"
  ON public.stores
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own stores"
  ON public.stores
  FOR DELETE
  USING (auth.uid() = user_id);

-- Create or replace the updated_at trigger function
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS set_stores_updated_at ON public.stores;

-- Create the updated_at trigger
CREATE TRIGGER set_stores_updated_at
  BEFORE UPDATE ON public.stores
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- Grant necessary permissions
GRANT ALL ON public.stores TO authenticated;
GRANT ALL ON public.stores TO service_role;

-- ================================================
-- Verification Queries (optional - run separately)
-- ================================================

-- Check that the table was created
-- SELECT * FROM public.stores LIMIT 5;

-- Check that RLS is enabled
-- SELECT tablename, rowsecurity FROM pg_tables WHERE tablename = 'stores';

-- Check policies
-- SELECT * FROM pg_policies WHERE tablename = 'stores';

-- ================================================
-- Success!
-- ================================================
-- Your database is now ready!
--
-- Next steps:
-- 1. Test by creating a store in your app
-- 2. Verify it appears in the database
-- 3. Deploy edge functions if you haven't already
-- ================================================
