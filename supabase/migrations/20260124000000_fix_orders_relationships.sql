-- Ensure foreign key constraints exist for the orders table to enable PostgREST joins
-- This fixes the 400 Bad Request error when fetching orders with embedded retailers and magazines

DO $$ 
BEGIN
  -- Check and add retailer_id foreign key if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'orders_retailer_id_fkey'
  ) THEN
    ALTER TABLE public.orders 
    ADD CONSTRAINT orders_retailer_id_fkey 
    FOREIGN KEY (retailer_id) REFERENCES public.retailers(id);
  END IF;

  -- Check and add magazine_id foreign key if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'orders_magazine_id_fkey'
  ) THEN
    ALTER TABLE public.orders 
    ADD CONSTRAINT orders_magazine_id_fkey 
    FOREIGN KEY (magazine_id) REFERENCES public.magazines(id);
  END IF;
END $$;
