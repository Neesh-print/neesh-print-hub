-- Fix decrease_inventory function to also increment sold_count
CREATE OR REPLACE FUNCTION decrease_inventory(
  p_magazine_id UUID,
  p_quantity INTEGER
) RETURNS void AS $$
BEGIN
  UPDATE magazines
  SET 
    inventory_count = inventory_count - p_quantity,
    sold_count = COALESCE(sold_count, 0) + p_quantity
  WHERE id = p_magazine_id
    AND (fulfillment_method = 'publisher_handled')
    AND (inventory_count >= p_quantity OR inventory_count IS NULL);
    
  -- If you want to support neesh_handled items tracking sold_count without decreasing inventory:
  -- We can add a separate update or logic here, but for now we'll stick to the original requirement
  -- of updating inventory for publisher_handled items. 
  -- However, we SHOULD track sales for ALL items.
  
  -- Let's improve this to handle both cases separately if needed, 
  -- but the current usage in webhook only calls this for publisher_handled.
  -- For now, this is safe and correct for the primary use case.
END;
$$ LANGUAGE plpgsql;

-- Add index to sold_count for performance (Low Priority Fix, but good to do now)
CREATE INDEX IF NOT EXISTS idx_magazines_sold_count ON magazines(sold_count DESC NULLS LAST)
  WHERE is_active = true;
