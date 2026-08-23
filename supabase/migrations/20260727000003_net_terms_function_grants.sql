-- Harden net-terms SECURITY DEFINER functions: remove the implicit PUBLIC (anon)
-- EXECUTE grant that Postgres adds by default. Without this, anon could call
-- due_invoice_reminders() (which returns retailer emails + amounts) over PostgREST.

-- Internal cron-only helpers: service_role only.
REVOKE EXECUTE ON FUNCTION public.due_invoice_reminders() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.mark_overdue_invoices() FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.due_invoice_reminders() TO service_role;
GRANT  EXECUTE ON FUNCTION public.mark_overdue_invoices() TO service_role;

-- Balance lookup: used by the retailer hook (authenticated) and edge fn (service_role).
REVOKE EXECUTE ON FUNCTION public.retailer_outstanding_balance(uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.retailer_outstanding_balance(uuid) TO authenticated, service_role;
