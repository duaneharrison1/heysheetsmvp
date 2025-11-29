-- Add store_id column to support_tickets table to track which store the ticket is associated with

ALTER TABLE public.support_tickets 
ADD COLUMN IF NOT EXISTS store_id UUID REFERENCES public.stores(id) ON DELETE SET NULL;

-- Index for efficient querying by store
CREATE INDEX IF NOT EXISTS idx_support_tickets_store_id ON public.support_tickets(store_id);

-- Super admins can delete tickets
CREATE POLICY "Super admins can delete tickets"
  ON public.support_tickets
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'super_admin'
    )
  );

COMMENT ON COLUMN public.support_tickets.store_id IS 'Optional reference to the store associated with this support ticket';
