-- Migration: create debug_requests table
-- Stores debug info from Debug Chat / QA runs
-- Run with supabase migrations or psql against your DB

CREATE TABLE IF NOT EXISTS public.debug_requests (
  id uuid PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  -- `stores.id` in this project is a text column, not uuid, so store_id is stored as text
  -- (avoid FK constraint because column types are incompatible)
  store_id text,
  model text NOT NULL,
  user_message text,
  response_text text,
  status text,
  timings jsonb,
  function_calls jsonb,
  steps jsonb,
  tokens jsonb,
  cost jsonb,
  reasoning text,
  reasoning_details jsonb,
  metadata jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_debug_requests_store_id ON public.debug_requests(store_id);
CREATE INDEX IF NOT EXISTS idx_debug_requests_user_id ON public.debug_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_debug_requests_created_at ON public.debug_requests(created_at DESC);
