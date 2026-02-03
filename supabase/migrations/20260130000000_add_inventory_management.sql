-- Add inventory management and fulfillment tracking to magazines table
-- This enables:
-- 1. Distinction between Neesh-handled vs Publisher-handled fulfillment
-- 2. Minimum order quantity enforcement
-- 3. Proper inventory tracking for publisher-managed stock

-- Add fulfillment method tracking
ALTER TABLE public.magazines 
ADD COLUMN IF NOT EXISTS fulfillment_method VARCHAR(20) 
DEFAULT 'publisher_handled'
CHECK (fulfillment_method IN ('neesh_handled', 'publisher_handled'));

-- Add minimum order quantity
ALTER TABLE public.magazines 
ADD COLUMN IF NOT EXISTS minimum_order_quantity INTEGER 
DEFAULT 1
CHECK (minimum_order_quantity > 0);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_magazines_fulfillment 
ON public.magazines(fulfillment_method);

CREATE INDEX IF NOT EXISTS idx_magazines_low_inventory 
ON public.magazines(inventory_count) 
WHERE fulfillment_method = 'publisher_handled' AND inventory_count < 25;

-- Comments for documentation
COMMENT ON COLUMN public.magazines.fulfillment_method IS 'How magazine is fulfilled: neesh_handled (stored in Neesh warehouse) or publisher_handled (publisher manages own shipping)';
COMMENT ON COLUMN public.magazines.minimum_order_quantity IS 'Minimum number of copies that must be purchased in a single order';

-- Set reasonable defaults for existing magazines
-- Publisher-handled titles get initial inventory so they appear in stock
UPDATE public.magazines 
SET 
  inventory_count = 50,
  fulfillment_method = 'publisher_handled'
WHERE (inventory_count IS NULL OR inventory_count = 0)
AND is_active = true;

-- Create atomic inventory decrease function to prevent race conditions
CREATE OR REPLACE FUNCTION decrease_inventory(
  p_magazine_id UUID,
  p_quantity INTEGER
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE magazines
  SET 
    inventory_count = inventory_count - p_quantity,
    sold_count = COALESCE(sold_count, 0) + p_quantity,
    updated_at = NOW()
  WHERE id = p_magazine_id
  AND inventory_count >= p_quantity; -- Prevent negative inventory
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Insufficient inventory for magazine %', p_magazine_id;
  END IF;
END;
$$;

COMMENT ON FUNCTION decrease_inventory IS 'Atomically decreases magazine inventory and increases sold count, preventing over-selling';
