-- =============================================================
-- Fix Order Flow & Add Publisher Tools Schema
-- =============================================================

-- 1. Fix Order Insertion
-- Add shipping_address column to orders table (was causing insert failures)
ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS shipping_address JSONB;

-- Add columns for shipping tracking
ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS tracking_number TEXT;

ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS carrier TEXT;

-- 2. Inventory Management
-- Create function to decrease inventory atomically
CREATE OR REPLACE FUNCTION public.decrease_inventory(p_magazine_id UUID, p_quantity INTEGER)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  UPDATE public.magazines
  SET 
    inventory_count = CASE 
      WHEN inventory_count IS NOT NULL THEN GREATEST(0, inventory_count - p_quantity)
      ELSE NULL 
    END,
    sold_count = COALESCE(sold_count, 0) + p_quantity
  WHERE id = p_magazine_id;
END;
$$;

COMMENT ON FUNCTION public.decrease_inventory IS 'Atomically decreases magazine inventory and increases sold count';

-- 3. Messaging System
-- 3. Messaging System
-- The messages table already exists in the database with a different schema.
-- We will adhere to the existing schema and use the notifications table for order updates.
-- Conflicting CREATE TABLE and CREATE INDEX statements have been removed.
