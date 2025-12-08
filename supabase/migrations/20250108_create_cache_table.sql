-- Create cache table for storing Google Sheets data
CREATE TABLE IF NOT EXISTS cache (
  key TEXT PRIMARY KEY,
  data JSONB NOT NULL,
  expiresAt TIMESTAMP NOT NULL,
  cachedAt TIMESTAMP DEFAULT now()
);

-- Index for efficient expiry queries
CREATE INDEX IF NOT EXISTS idx_cache_expires ON cache(expiresAt);

-- Enable RLS
ALTER TABLE cache ENABLE ROW LEVEL SECURITY;

-- Allow service role to access (for backend functions)
CREATE POLICY "Service role full access" ON cache
  FOR ALL
  USING (true)
  WITH CHECK (true);
