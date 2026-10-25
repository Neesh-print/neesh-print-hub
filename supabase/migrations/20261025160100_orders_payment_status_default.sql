-- Apply AFTER deploying the stripe-webhook edge function from the same
-- change: it now sets payment_status = 'paid' itself. Before that deploy,
-- the webhook relied on this default, and paid card orders would be marked
-- unpaid.
--
-- An order that does not say how it was paid is not paid.
alter table public.orders alter column payment_status set default 'unpaid';
