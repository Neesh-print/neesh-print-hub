-- Refunds and disputes didn't show on orders.
--
-- stripe-webhook set orders.status to 'refunded', 'partially_refunded' or
-- 'disputed', none of which orders_status_check allows, and ignored the
-- error, so refunded and disputed orders kept showing as paid. The webhook
-- now records the payment side in payment_status instead ('refunded' already
-- exists; 'disputed' is added here) and only changes status to 'cancelled'
-- when a fully refunded order hasn't shipped.
--
-- The order screens read order_details_with_pricing, which had no
-- payment_status, so they guessed it from status. The column is appended to
-- the view (same columns and order, plus one at the end).

-- 1) Allow 'disputed' as a payment status -------------------------------------
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_payment_status_check;
ALTER TABLE public.orders
  ADD CONSTRAINT orders_payment_status_check
  CHECK (payment_status IN ('unpaid', 'invoiced', 'paid', 'overdue', 'written_off', 'refunded', 'disputed'));

-- 2) Expose payment_status to the order screens --------------------------------
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
    o.payment_status
   FROM orders o
     LEFT JOIN magazines m ON o.magazine_id = m.id
     LEFT JOIN publishers p ON m.publisher_id = p.id
     LEFT JOIN users u_pub ON p.user_id = u_pub.id
     LEFT JOIN retailers r ON o.retailer_id = r.user_id
     LEFT JOIN users u_ret ON o.retailer_id = u_ret.id;
