-- Create user wishlists table
CREATE TABLE IF NOT EXISTS public.user_wishlists (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, product_id)
);

-- Enable Row Level Security
ALTER TABLE public.user_wishlists ENABLE ROW LEVEL SECURITY;

-- Users can view their own wishlist items
DROP POLICY IF EXISTS "Users can view their own wishlist" ON public.user_wishlists;
CREATE POLICY "Users can view their own wishlist"
ON public.user_wishlists
FOR SELECT
USING (auth.uid() = user_id);

-- Users can add to their own wishlist
DROP POLICY IF EXISTS "Users can add to their own wishlist" ON public.user_wishlists;
CREATE POLICY "Users can add to their own wishlist"
ON public.user_wishlists
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can remove from their own wishlist
DROP POLICY IF EXISTS "Users can delete from their own wishlist" ON public.user_wishlists;
CREATE POLICY "Users can delete from their own wishlist"
ON public.user_wishlists
FOR DELETE
USING (auth.uid() = user_id);

-- Create index for faster queries
DROP INDEX IF EXISTS idx_user_wishlists_user_id;
CREATE INDEX idx_user_wishlists_user_id ON public.user_wishlists(user_id);

DROP INDEX IF EXISTS idx_user_wishlists_product_id;
CREATE INDEX idx_user_wishlists_product_id ON public.user_wishlists(product_id);