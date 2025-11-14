-- Add detected_schema column to stores table
-- This column stores the full schema of all detected tabs including:
-- - Column headers for each tab
-- - Sample data (first 3 rows) for better AI context

ALTER TABLE public.stores
ADD COLUMN IF NOT EXISTS detected_schema JSONB;

-- Add comment explaining the column structure
COMMENT ON COLUMN public.stores.detected_schema IS
'Detailed schema of detected tabs including column headers and sample data. Format: {"TabName": {"columns": ["col1", "col2"], "sample_rows": [{...}]}}';
