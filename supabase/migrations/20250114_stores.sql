-- Stores table
CREATE TABLE IF NOT EXISTS stores (
  id TEXT PRIMARY KEY DEFAULT ('store-' || substr(md5(random()::text), 1, 8)),
  name TEXT NOT NULL,
  type TEXT DEFAULT 'general',
  logo TEXT,
  sheet_id TEXT,
  system_prompt TEXT,
  detected_tabs TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  is_demo BOOLEAN DEFAULT FALSE
);

ALTER TABLE stores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for now"
  ON stores FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_stores_sheet_id ON stores(sheet_id);
