-- Fix #2 & #3: Drop and recreate order_details_with_pricing view with SECURITY INVOKER
DROP VIEW IF EXISTS public.order_details_with_pricing;

CREATE VIEW public.order_details_with_pricing
WITH (security_invoker = on) AS
SELECT 
  o.id,
  o.created_at,
  r.shop_name as retailer_shop_name,
  r.id as retailer_id,
  u1.email as retailer_email,
  p.company_name as publisher_name,
  p.id as publisher_id,
  u2.email as publisher_email,
  m.id as magazine_id,
  m.title as magazine_title,
  m.cover_image_url,
  o.unit_price,
  o.quantity,
  o.total_price,
  m.wholesale_price,
  o.status
FROM orders o
JOIN retailers r ON o.retailer_id = r.user_id
JOIN users u1 ON r.user_id = u1.id
JOIN magazines m ON o.magazine_id = m.id
JOIN publishers p ON m.publisher_id = p.id
JOIN users u2 ON p.user_id = u2.id;

-- Fix #4: Strengthen users table RLS - block anonymous access and restrict inserts
-- Drop any existing insert policies that allow authenticated users to insert
DROP POLICY IF EXISTS "Users can insert own record" ON public.users;

-- Create policy to block authenticated user inserts (trigger handles this)
-- Create policy to block authenticated user inserts (trigger handles this)
DROP POLICY IF EXISTS "Block authenticated user inserts" ON public.users;
CREATE POLICY "Block authenticated user inserts"
ON public.users FOR INSERT
TO authenticated
WITH CHECK (false);

-- Ensure anonymous users cannot access users table at all
DROP POLICY IF EXISTS "Block anonymous access to users" ON public.users;
CREATE POLICY "Block anonymous access to users"
ON public.users FOR ALL
TO anon
USING (false)
WITH CHECK (false);

-- Fix #5: Strengthen orders table RLS - ensure no anonymous access
DROP POLICY IF EXISTS "Block anonymous access to orders" ON public.orders;
CREATE POLICY "Block anonymous access to orders"
ON public.orders FOR ALL
TO anon
USING (false)
WITH CHECK (false);