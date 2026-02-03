-- Fix search_path for notify_publisher_application function
CREATE OR REPLACE FUNCTION public.notify_publisher_application()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
BEGIN
  -- Only send notification for new applications (INSERT)
  IF TG_OP = 'INSERT' THEN
    PERFORM
      net.http_post(
        url := 'https://smfzrubkyxejzkblrrjr.supabase.co/functions/v1/publisher-notify',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNtZnpydWJreXhlanprYmxycmpyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI3Nzc1MTcsImV4cCI6MjA2ODM1MzUxN30.1DF1Gtz3rIH0ifyeu0IUSKZmIy4LFnA1ddEtYjLSO0w'
        ),
        body := jsonb_build_object('record', row_to_json(NEW))
      );
  END IF;
  RETURN NEW;
END;
$function$;

-- Fix search_path for notify_retailer_application function
CREATE OR REPLACE FUNCTION public.notify_retailer_application()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
BEGIN
  -- Only send notification for new applications (INSERT)
  IF TG_OP = 'INSERT' THEN
    PERFORM
      net.http_post(
        url := 'https://smfzrubkyxejzkblrrjr.supabase.co/functions/v1/retailer-notify',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNtZnpydWJreXhlanprYmxycmpyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI3Nzc1MTcsImV4cCI6MjA2ODM1MzUxN30.1DF1Gtz3rIH0ifyeu0IUSKZmIy4LFnA1ddEtYjLSO0w'
        ),
        body := jsonb_build_object('record', row_to_json(NEW))
      );
  END IF;
  RETURN NEW;
END;
$function$;

-- Fix search_path for update_updated_at_column function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path = public
AS $function$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$function$;

-- Drop overly permissive RLS policies and replace with properly scoped ones

-- 1. mailing_list_subscribers: Anyone can subscribe but needs proper constraint
-- This is intentionally public for mailing list signup - keeping as-is but documenting

-- 2. notifications: Replace system insert with authenticated user constraint
DROP POLICY IF EXISTS "System can create notifications" ON public.notifications;
DROP POLICY IF EXISTS "Authenticated can create notifications" ON public.notifications;
CREATE POLICY "Authenticated can create notifications" ON public.notifications
FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

-- 3. order_item: Replace with authenticated insert linked to user's orders
DROP POLICY IF EXISTS "System can create order items" ON public.order_item;
DROP POLICY IF EXISTS "Retailers can create order items" ON public.order_item;
CREATE POLICY "Retailers can create order items" ON public.order_item
FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.orders o 
    WHERE o.id = order_id AND o.retailer_id = auth.uid()
  )
);

-- 4. payouts: These should be admin-only operations
DROP POLICY IF EXISTS "System can create payouts" ON public.payouts;
DROP POLICY IF EXISTS "System can update payouts" ON public.payouts;
DROP POLICY IF EXISTS "Admins can create payouts" ON public.payouts;
CREATE POLICY "Admins can create payouts" ON public.payouts
FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
);

DROP POLICY IF EXISTS "Admins can update payouts" ON public.payouts;
CREATE POLICY "Admins can update payouts" ON public.payouts
FOR UPDATE TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
);

-- 5. publisher_applications: Replace overly permissive service_role policy
DROP POLICY IF EXISTS "service_role_all_publisher_applications" ON public.publisher_applications;
-- Keep existing more restrictive policies that should already exist
-- Add admin-only policy for full access
DROP POLICY IF EXISTS "Admins can manage publisher applications" ON public.publisher_applications;
CREATE POLICY "Admins can manage publisher applications" ON public.publisher_applications
FOR ALL TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
)
WITH CHECK (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
);

-- 6. returns: Replace with admin-only update
DROP POLICY IF EXISTS "System can update returns" ON public.returns;
DROP POLICY IF EXISTS "Admins can update returns" ON public.returns;
CREATE POLICY "Admins can update returns" ON public.returns
FOR UPDATE TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
);