-- Enable RLS on orders table
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- 1. Retailer Policy: Can view orders they created
DROP POLICY IF EXISTS "Retailers can view their own orders" ON public.orders;

CREATE POLICY "Retailers can view their own orders"
ON public.orders
FOR SELECT
TO authenticated
USING (
  retailer_id = auth.uid()
);

-- 2. Publisher Policy: Can view orders containing their magazines
-- Note: This requires a join/subquery to magazines and publishers
DROP POLICY IF EXISTS "Publishers can view orders for their magazines" ON public.orders;

CREATE POLICY "Publishers can view orders for their magazines"
ON public.orders
FOR SELECT
TO authenticated
USING (
  magazine_id IN (
    SELECT id 
    FROM public.magazines 
    WHERE publisher_id IN (
      SELECT id 
      FROM public.publishers 
      WHERE user_id = auth.uid()
    )
  )
);

-- 3. Update the view to respect RLS (security_invoker = true)
-- We need to drop and recreate it to change the option
DROP VIEW IF EXISTS public.order_details_with_pricing;

CREATE OR REPLACE VIEW public.order_details_with_pricing WITH (security_invoker = true) AS
SELECT
  o.id,
  o.created_at,
  o.status,
  o.quantity,
  o.unit_price,
  o.total_price,
  o.stripe_session_id,
  o.payment_intent_id,
  o.retailer_id,
  o.shipping_address,
  o.tracking_number,
  o.carrier,
  m.id as magazine_id,
  m.title as magazine_title,
  m.cover_image_url,
  m.wholesale_price,
  m.publisher_id,
  p.company_name as publisher_name,
  u_pub.email as publisher_email,
  r.shop_name as retailer_shop_name,
  u_ret.email as retailer_email
FROM public.orders o
JOIN public.magazines m ON o.magazine_id = m.id
LEFT JOIN public.publishers p ON m.publisher_id = p.id
LEFT JOIN public.users u_pub ON p.user_id = u_pub.id
LEFT JOIN public.retailers r ON o.retailer_id = r.user_id
LEFT JOIN public.users u_ret ON o.retailer_id = u_ret.id;

COMMENT ON VIEW public.order_details_with_pricing IS 'Comprehensive view of orders with magazine, publisher, and retailer details, including shipping info. Respects RLS of underlying tables.';

GRANT SELECT ON public.order_details_with_pricing TO authenticated;
