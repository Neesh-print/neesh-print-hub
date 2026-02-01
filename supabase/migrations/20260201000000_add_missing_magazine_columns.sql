-- Add missing columns to magzines table for full edit support
-- Based on the PublisherEditTitle form fields

ALTER TABLE public.magazines
ADD COLUMN IF NOT EXISTS warehouse_location TEXT,
ADD COLUMN IF NOT EXISTS restock_timeline TEXT,
ADD COLUMN IF NOT EXISTS print_run TEXT, -- keeping as text to allow flexible input like "25,000 copies" or approx
ADD COLUMN IF NOT EXISTS page_count INTEGER,
ADD COLUMN IF NOT EXISTS metadata TEXT, -- for SEO/Keywords
ADD COLUMN IF NOT EXISTS discount_structure TEXT,
ADD COLUMN IF NOT EXISTS payment_terms TEXT;

-- Add comments for documentation
COMMENT ON COLUMN public.magazines.warehouse_location IS 'Physical location of the inventory';
COMMENT ON COLUMN public.magazines.restock_timeline IS 'Estimated time to restock inventory';
COMMENT ON COLUMN public.magazines.print_run IS 'Total number of copies printed';
COMMENT ON COLUMN public.magazines.page_count IS 'Number of pages in the magazine';
COMMENT ON COLUMN public.magazines.metadata IS 'Keywords, ISBN, ISSN, etc.';
COMMENT ON COLUMN public.magazines.discount_structure IS 'Wholesale discount tiers';
COMMENT ON COLUMN public.magazines.payment_terms IS 'Payment terms for retailers (e.g. Net 30)';
