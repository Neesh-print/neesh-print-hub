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
-- Create messages table for communication between publishers and retailers
CREATE TABLE IF NOT EXISTS public.messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES public.users(id),
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    read_at TIMESTAMP WITH TIME ZONE
);

-- Helper index for fetching messages by order
CREATE INDEX IF NOT EXISTS idx_messages_order_id ON public.messages(order_id);

-- Enable RLS
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Policies for messages
-- Publisher policy: can view/send messages for orders of their magazines
CREATE POLICY "Publishers can view messages for their orders"
ON public.messages FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.orders o
        JOIN public.magazines m ON o.magazine_id = m.id
        JOIN public.publishers p ON m.publisher_id = p.id
        WHERE o.id = messages.order_id
        AND p.user_id = auth.uid()
    )
);

CREATE POLICY "Publishers can send messages for their orders"
ON public.messages FOR INSERT
WITH CHECK (
    auth.uid() = sender_id AND
    EXISTS (
        SELECT 1 FROM public.orders o
        JOIN public.magazines m ON o.magazine_id = m.id
        JOIN public.publishers p ON m.publisher_id = p.id
        WHERE o.id = order_id
        AND p.user_id = auth.uid()
    )
);

-- Retailer policy: can view/send messages for their own orders
CREATE POLICY "Retailers can view messages for their orders"
ON public.messages FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.orders o
        WHERE o.id = messages.order_id
        AND o.retailer_id = auth.uid()
    )
);

CREATE POLICY "Retailers can send messages for their orders"
ON public.messages FOR INSERT
WITH CHECK (
    auth.uid() = sender_id AND
    EXISTS (
        SELECT 1 FROM public.orders o
        WHERE o.id = order_id
        AND o.retailer_id = auth.uid()
    )
);

-- Admin policy
CREATE POLICY "Admins can view all messages"
ON public.messages FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.users
        WHERE id = auth.uid()
        AND role = 'admin'
    )
);
