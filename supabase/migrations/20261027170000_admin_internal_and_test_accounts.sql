-- Admin portal fixes (Oct 27, 2026 spec).
--
-- 1) Internal orders: NWM Collections is Neesh's own buying account (copies
--    for content and a full-flow test). Its orders are real and still go
--    through fulfillment and payouts, but Analytics and the dashboard need a
--    way to exclude them. is_internal marks the account; the admin screens
--    have an "Exclude internal" toggle that is off by default.
--
-- 2) Test accounts: hidden from admin lists and counts with is_test. Nothing
--    is deleted.
--
-- 3) order_details_with_pricing gets updated_at appended (same columns and
--    order, plus one at the end) so the Fulfillment tab can tell which
--    orders were marked shipped today.

-- 1) Internal accounts ----------------------------------------------------------
ALTER TABLE public.retailers ADD COLUMN IF NOT EXISTS is_internal boolean NOT NULL DEFAULT false;

UPDATE public.retailers SET is_internal = true WHERE shop_name = 'NWM Collections';

-- 2) Test accounts --------------------------------------------------------------
ALTER TABLE public.retailers ADD COLUMN IF NOT EXISTS is_test boolean NOT NULL DEFAULT false;
ALTER TABLE public.publishers ADD COLUMN IF NOT EXISTS is_test boolean NOT NULL DEFAULT false;

UPDATE public.retailers SET is_test = true WHERE shop_name = 'Test Store - Form Fill';

UPDATE public.publishers p SET is_test = true
FROM public.users u
WHERE u.id = p.user_id
  AND u.email IN ('publisher@test.com', 'admin@test.com', 'testuser1@utopiancreations.one');

-- 3) Expose updated_at to the order screens ------------------------------------
CREATE OR REPLACE VIEW public.order_details_with_pricing
WITH (security_invoker = true) AS
SELECT o.id,
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
    m.id AS magazine_id,
    m.title AS magazine_title,
    m.cover_image_url,
    m.wholesale_price,
    m.publisher_id,
    p.company_name AS publisher_name,
    u_pub.email AS publisher_email,
    r.shop_name AS retailer_shop_name,
    u_ret.email AS retailer_email,
    o.payment_status,
    o.updated_at
   FROM orders o
     LEFT JOIN magazines m ON o.magazine_id = m.id
     LEFT JOIN publishers p ON m.publisher_id = p.id
     LEFT JOIN users u_pub ON p.user_id = u_pub.id
     LEFT JOIN retailers r ON o.retailer_id = r.user_id
     LEFT JOIN users u_ret ON o.retailer_id = u_ret.id;
