-- Add separate dimension and weight fields for shipping calculations
-- Also add ISBN and subcategory fields

ALTER TABLE public.magazines
ADD COLUMN IF NOT EXISTS width_mm NUMERIC,
ADD COLUMN IF NOT EXISTS height_mm NUMERIC,
ADD COLUMN IF NOT EXISTS weight_grams NUMERIC,
ADD COLUMN IF NOT EXISTS isbn TEXT,
ADD COLUMN IF NOT EXISTS subcategory TEXT;

-- Add comments for documentation
COMMENT ON COLUMN public.magazines.width_mm IS 'Magazine width in millimeters';
COMMENT ON COLUMN public.magazines.height_mm IS 'Magazine height in millimeters';
COMMENT ON COLUMN public.magazines.weight_grams IS 'Magazine weight in grams';
COMMENT ON COLUMN public.magazines.isbn IS 'International Standard Book Number';
COMMENT ON COLUMN public.magazines.subcategory IS 'Secondary category for cross-genre magazines';
