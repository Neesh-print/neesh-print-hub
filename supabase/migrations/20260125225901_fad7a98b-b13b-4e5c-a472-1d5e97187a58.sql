-- Add publication_date column to magazines table
-- Stores first of month (e.g., 2025-12-01 for December 2025)
ALTER TABLE public.magazines 
ADD COLUMN publication_date DATE DEFAULT NULL;

-- Add index for sorting by publication date (newest first, nulls last)
CREATE INDEX idx_magazines_publication_date 
ON public.magazines(publication_date DESC NULLS LAST);

-- Add comment for documentation
COMMENT ON COLUMN public.magazines.publication_date IS 'Publication date stored as first of month (e.g., 2025-12-01 for December 2025)';