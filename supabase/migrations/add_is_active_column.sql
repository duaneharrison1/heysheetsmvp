-- Add is_active column to stores table
-- Run this in Supabase SQL Editor if the column doesn't exist

ALTER TABLE public.stores
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- Add index for faster queries
CREATE INDEX IF NOT EXISTS stores_is_active_idx ON public.stores(is_active);
