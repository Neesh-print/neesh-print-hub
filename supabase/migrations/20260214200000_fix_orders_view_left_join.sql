-- Fix order_details_with_pricing view to use LEFT JOIN on magazines
-- This ensures orders remain visible even if a magazine is deactivated after purchase.
-- Previously used INNER JOIN which would silently drop orders for inactive magazines
-- when queried by non-admin users (due to security_invoker = true + magazines RLS).

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
LEFT JOIN public.magazines m ON o.magazine_id = m.id
LEFT JOIN public.publishers p ON m.publisher_id = p.id
LEFT JOIN public.users u_pub ON p.user_id = u_pub.id
LEFT JOIN public.retailers r ON o.retailer_id = r.user_id
LEFT JOIN public.users u_ret ON o.retailer_id = u_ret.id;

COMMENT ON VIEW public.order_details_with_pricing IS 'Comprehensive view of orders with magazine, publisher, and retailer details, including shipping info. Uses LEFT JOINs to ensure orders are always visible even if related data is restricted by RLS. Respects RLS of underlying tables via security_invoker.';

GRANT SELECT ON public.order_details_with_pricing TO authenticated;
