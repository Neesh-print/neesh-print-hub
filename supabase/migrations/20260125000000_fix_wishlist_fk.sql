-- Fix foreign key constraint on user_wishlists
DO $$
BEGIN
  -- First drop the old constraint if it exists (but strictly speaking we want to modify it)
  -- If we just want to ensure it references the correct table, we can drop and recreate
  IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'user_wishlists_product_id_fkey' AND table_name = 'user_wishlists') THEN
    ALTER TABLE public.user_wishlists DROP CONSTRAINT user_wishlists_product_id_fkey;
  END IF;

  -- Add the new constraint
  ALTER TABLE public.user_wishlists
  ADD CONSTRAINT user_wishlists_product_id_fkey
  FOREIGN KEY (product_id)
  REFERENCES public.magazines(id)
  ON DELETE CASCADE;
END $$;
