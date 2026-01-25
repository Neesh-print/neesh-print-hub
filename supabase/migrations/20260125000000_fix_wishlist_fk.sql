-- Fix foreign key constraint on user_wishlists
ALTER TABLE public.user_wishlists
DROP CONSTRAINT user_wishlists_product_id_fkey;

ALTER TABLE public.user_wishlists
ADD CONSTRAINT user_wishlists_product_id_fkey
FOREIGN KEY (product_id)
REFERENCES public.magazines(id)
ON DELETE CASCADE;
