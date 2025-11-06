-- User-stores junction
CREATE TABLE IF NOT EXISTS user_stores (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL,
  store_id TEXT NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'owner',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, store_id)
);

ALTER TABLE user_stores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own associations"
  ON user_stores FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own associations"
  ON user_stores FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users delete own associations"
  ON user_stores FOR DELETE
  USING (auth.uid() = user_id);

CREATE INDEX idx_user_stores_user_id ON user_stores(user_id);
CREATE INDEX idx_user_stores_store_id ON user_stores(store_id);
