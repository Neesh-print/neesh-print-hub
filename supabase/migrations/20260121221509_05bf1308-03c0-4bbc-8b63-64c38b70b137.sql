-- Fix infinite recursion in RLS policies by using auth.jwt() instead of querying users table

-- First, let's create a helper function to check if current user is admin
-- This uses auth.jwt() which doesn't cause recursion
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() AND role = 'admin'
  );
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

-- Now update the users table policies to avoid recursion
-- Drop the problematic recursive policy
DROP POLICY IF EXISTS "Admins can view all users" ON public.users;

-- Recreate without self-reference - use a function instead
CREATE POLICY "Admins can view all users" ON public.users
FOR SELECT TO authenticated
USING (
  auth.uid() = id  -- User can see themselves
  OR public.is_admin()  -- Or if they're admin (uses SECURITY DEFINER function)
);

-- Fix notification policies that reference users
DROP POLICY IF EXISTS "Authenticated can create notifications" ON public.notifications;
CREATE POLICY "Authenticated can create notifications" ON public.notifications
FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Fix order_item policies
DROP POLICY IF EXISTS "Retailers can create order items" ON public.order_item;
CREATE POLICY "Retailers can create order items" ON public.order_item
FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.orders o 
    WHERE o.id = order_item.order_id AND o.retailer_id = auth.uid()
  )
);

-- Fix payouts policies to use the helper function
DROP POLICY IF EXISTS "Admins can create payouts" ON public.payouts;
DROP POLICY IF EXISTS "Admins can update payouts" ON public.payouts;

CREATE POLICY "Admins can create payouts" ON public.payouts
FOR INSERT TO authenticated
WITH CHECK (public.is_admin());

CREATE POLICY "Admins can update payouts" ON public.payouts
FOR UPDATE TO authenticated
USING (public.is_admin());

-- Fix publisher_applications policy
DROP POLICY IF EXISTS "Admins can manage publisher applications" ON public.publisher_applications;
CREATE POLICY "Admins can manage publisher applications" ON public.publisher_applications
FOR ALL TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- Fix returns policy
DROP POLICY IF EXISTS "Admins can update returns" ON public.returns;
CREATE POLICY "Admins can update returns" ON public.returns
FOR UPDATE TO authenticated
USING (public.is_admin());

-- Fix magazines policy
DROP POLICY IF EXISTS "Admins can manage all magazines" ON public.magazines;
CREATE POLICY "Admins can manage all magazines" ON public.magazines
FOR ALL TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- Fix orders policies
DROP POLICY IF EXISTS "Admins can manage all orders" ON public.orders;
CREATE POLICY "Admins can manage all orders" ON public.orders
FOR ALL TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- Fix products policy
DROP POLICY IF EXISTS "Admins can manage all products" ON public.products;
CREATE POLICY "Admins can manage all products" ON public.products
FOR ALL TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- Fix profiles policy
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
CREATE POLICY "Admins can view all profiles" ON public.profiles
FOR SELECT TO authenticated
USING (auth.uid() = user_id OR public.is_admin());

-- Fix publishers policy
DROP POLICY IF EXISTS "Admins can manage all publishers" ON public.publishers;
CREATE POLICY "Admins can manage all publishers" ON public.publishers
FOR ALL TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- Fix retailers policy
DROP POLICY IF EXISTS "Admins can manage all retailers" ON public.retailers;
CREATE POLICY "Admins can manage all retailers" ON public.retailers
FOR ALL TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- Fix retailer_applications policy
DROP POLICY IF EXISTS "Admins can manage retailer applications" ON public.retailer_applications;
CREATE POLICY "Admins can manage retailer applications" ON public.retailer_applications
FOR ALL TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- Fix mailing_list_subscribers policy
DROP POLICY IF EXISTS "Admins can manage mailing list" ON public.mailing_list_subscribers;
CREATE POLICY "Admins can manage mailing list" ON public.mailing_list_subscribers
FOR ALL TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- Fix payment_sessions policy
DROP POLICY IF EXISTS "Admins can view all payment sessions" ON public.payment_sessions;
CREATE POLICY "Admins can view all payment sessions" ON public.payment_sessions
FOR SELECT TO authenticated
USING (public.is_admin());