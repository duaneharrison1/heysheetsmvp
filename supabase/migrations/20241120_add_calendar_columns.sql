-- Add calendar columns to stores table for Google Calendar booking integration
-- Migration: 20241120_add_calendar_columns
-- Date: 2024-11-20

-- Add calendar_mappings column (maps calendar IDs to service IDs)
ALTER TABLE stores
ADD COLUMN IF NOT EXISTS calendar_mappings JSONB DEFAULT '{}'::jsonb;

-- Add invite_calendar_id column (calendar for customer booking invites)
ALTER TABLE stores
ADD COLUMN IF NOT EXISTS invite_calendar_id TEXT;

-- Add comments for clarity
COMMENT ON COLUMN stores.calendar_mappings IS
'Maps Google Calendar IDs to service IDs. Format: {"calendar_id": "service_id", ...}. Multiple services can share a calendar.';

COMMENT ON COLUMN stores.invite_calendar_id IS
'Google Calendar ID for customer booking invites. System-managed, shared with owner (write access).';

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_stores_calendar_mappings
  ON stores USING GIN (calendar_mappings)
  WHERE calendar_mappings IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_stores_invite_calendar
  ON stores(invite_calendar_id)
  WHERE invite_calendar_id IS NOT NULL;
