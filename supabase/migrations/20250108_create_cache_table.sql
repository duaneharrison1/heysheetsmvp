-- Drop existing cache table if it exists with wrong schema
DROP TABLE IF EXISTS cache CASCADE;

-- Create cache table for storing Google Sheets data
CREATE TABLE cache (
  key TEXT PRIMARY KEY,
  data JSONB NOT NULL,
  "expiresAt" TIMESTAMP NOT NULL,
  "cachedAt" TIMESTAMP DEFAULT now()
);

-- Index for efficient expiry queries
CREATE INDEX idx_cache_expires ON cache("expiresAt");

-- Enable RLS
ALTER TABLE cache ENABLE ROW LEVEL SECURITY;

-- Allow service role to access (for backend functions)
CREATE POLICY "Service role full access" ON cache
  FOR ALL
  USING (true)
  WITH CHECK (true);
