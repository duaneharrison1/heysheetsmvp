-- Create stores table with user ownership
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

-- Create index on user_id for faster queries
CREATE INDEX IF NOT EXISTS stores_user_id_idx ON public.stores(user_id);
CREATE INDEX IF NOT EXISTS stores_sheet_id_idx ON public.stores(sheet_id);

-- Enable Row Level Security
ALTER TABLE public.stores ENABLE ROW LEVEL SECURITY;

-- Create policies
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

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_stores_updated_at
  BEFORE UPDATE ON public.stores
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- Grant access
GRANT ALL ON public.stores TO authenticated;
GRANT ALL ON public.stores TO service_role;
