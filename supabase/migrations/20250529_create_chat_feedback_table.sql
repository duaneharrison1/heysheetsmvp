-- Create chat_feedback table for storing user feedback on AI responses
-- Used for review and improvement of AI quality

CREATE TABLE IF NOT EXISTS public.chat_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id TEXT NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  store_url TEXT,
  message_id TEXT NOT NULL,
  message_content TEXT NOT NULL,
  feedback_type TEXT NOT NULL CHECK (feedback_type IN ('like', 'dislike')),
  conversation_history JSONB,
  priority TEXT CHECK (priority IS NULL OR priority IN ('low', 'medium', 'high', 'critical')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for efficient querying by store
CREATE INDEX idx_chat_feedback_store_id ON public.chat_feedback(store_id);

-- Index for filtering by feedback type
CREATE INDEX idx_chat_feedback_type ON public.chat_feedback(feedback_type);

-- Index for time-based queries
CREATE INDEX idx_chat_feedback_created_at ON public.chat_feedback(created_at DESC);

-- Index for priority filtering
CREATE INDEX idx_chat_feedback_priority ON public.chat_feedback(priority);

-- Enable RLS
ALTER TABLE public.chat_feedback ENABLE ROW LEVEL SECURITY;

-- Allow anyone to insert feedback (public stores can receive feedback from anonymous users)
CREATE POLICY "Anyone can insert chat feedback"
  ON public.chat_feedback
  FOR INSERT
  WITH CHECK (true);

-- Only store owners can view feedback for their stores
CREATE POLICY "Store owners can view their feedback"
  ON public.chat_feedback
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.stores
      WHERE stores.id = chat_feedback.store_id
      AND stores.user_id = auth.uid()
    )
  );

-- Super admins can view all feedback
CREATE POLICY "Super admins can view all feedback"
  ON public.chat_feedback
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'super_admin'
    )
  );

-- Super admins can update feedback (for priority assignment)
CREATE POLICY "Super admins can update feedback"
  ON public.chat_feedback
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'super_admin'
    )
  );

-- Comment on table
COMMENT ON TABLE public.chat_feedback IS 'Stores user feedback (likes/dislikes) on AI chat responses for quality review';
