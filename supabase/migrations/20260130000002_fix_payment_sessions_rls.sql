-- Allow authenticated users to create payment sessions
-- This is necessary for the checkout flow to track sessions before redirecting to Stripe
CREATE POLICY "Authenticated users can insert payment sessions" 
ON public.payment_sessions
FOR INSERT 
TO authenticated
WITH CHECK (user_id = auth.uid());
