-- =============================================================
-- Drop overly restrictive description CHECK constraint
-- on publisher_applications table.
-- This constraint was added via the dashboard and blocks
-- publishers from submitting applications with longer descriptions.
-- Replace with a generous 5000 character limit.
-- =============================================================

ALTER TABLE public.publisher_applications
DROP CONSTRAINT IF EXISTS publisher_applications_description_check;
-- Add a generous limit to prevent abuse while allowing real descriptions
ALTER TABLE public.publisher_applications
ADD CONSTRAINT publisher_applications_description_check
CHECK (description IS NULL OR length(description) <= 5000);
