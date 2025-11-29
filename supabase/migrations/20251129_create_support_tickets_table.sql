-- Create support_tickets table for storing user support requests from the Help page
-- Used for tracking and managing support requests

CREATE TABLE IF NOT EXISTS public.support_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  category TEXT NOT NULL CHECK (category IN ('feedback', 'bug', 'question', 'other')),
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  contact_email TEXT,
  priority TEXT CHECK (priority IS NULL OR priority IN ('low', 'medium', 'high', 'critical')),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for efficient querying by user
CREATE INDEX idx_support_tickets_user_id ON public.support_tickets(user_id);

-- Index for filtering by category
CREATE INDEX idx_support_tickets_category ON public.support_tickets(category);

-- Index for filtering by status
CREATE INDEX idx_support_tickets_status ON public.support_tickets(status);

-- Index for filtering by priority
CREATE INDEX idx_support_tickets_priority ON public.support_tickets(priority);

-- Index for time-based queries
CREATE INDEX idx_support_tickets_created_at ON public.support_tickets(created_at DESC);

-- Enable RLS
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to insert tickets
CREATE POLICY "Authenticated users can insert support tickets"
  ON public.support_tickets
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- Allow anonymous users to insert tickets (for users not logged in)
CREATE POLICY "Anyone can insert support tickets"
  ON public.support_tickets
  FOR INSERT
  WITH CHECK (true);

-- Users can view their own tickets
CREATE POLICY "Users can view their own tickets"
  ON public.support_tickets
  FOR SELECT
  USING (user_id = auth.uid());

-- Super admins can view all tickets
CREATE POLICY "Super admins can view all tickets"
  ON public.support_tickets
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'super_admin'
    )
  );

-- Super admins can update tickets (for priority/status assignment)
CREATE POLICY "Super admins can update tickets"
  ON public.support_tickets
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'super_admin'
    )
  );

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_support_ticket_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
CREATE TRIGGER support_tickets_updated_at
  BEFORE UPDATE ON public.support_tickets
  FOR EACH ROW
  EXECUTE FUNCTION update_support_ticket_updated_at();

-- Comment on table
COMMENT ON TABLE public.support_tickets IS 'Stores user support tickets submitted from the Help page';
