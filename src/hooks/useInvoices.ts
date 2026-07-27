import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export type InvoiceStatus = 'draft' | 'open' | 'paid' | 'overdue' | 'void' | 'uncollectible';

export interface Invoice {
  id: string;
  retailer_id: string;
  stripe_invoice_id: string | null;
  hosted_invoice_url: string | null;
  invoice_pdf_url: string | null;
  terms_days: number;
  subtotal: number;
  tax: number;
  total: number;
  amount_paid: number;
  amount_due: number;
  status: InvoiceStatus;
  issued_at: string | null;
  due_at: string | null;
  paid_at: string | null;
  created_at: string;
  // Admin-only joined field
  shop_name?: string | null;
}

function mapInvoice(row: Record<string, unknown>): Invoice {
  return {
    id: row.id as string,
    retailer_id: row.retailer_id as string,
    stripe_invoice_id: (row.stripe_invoice_id as string) ?? null,
    hosted_invoice_url: (row.hosted_invoice_url as string) ?? null,
    invoice_pdf_url: (row.invoice_pdf_url as string) ?? null,
    terms_days: Number(row.terms_days ?? 0),
    subtotal: Number(row.subtotal ?? 0),
    tax: Number(row.tax ?? 0),
    total: Number(row.total ?? 0),
    amount_paid: Number(row.amount_paid ?? 0),
    amount_due: Number(row.amount_due ?? 0),
    status: (row.status as InvoiceStatus) ?? 'draft',
    issued_at: (row.issued_at as string) ?? null,
    due_at: (row.due_at as string) ?? null,
    paid_at: (row.paid_at as string) ?? null,
    created_at: row.created_at as string,
  };
}

interface UseInvoicesOptions {
  /** 'mine' (default) = current retailer; 'all' = admin view of every invoice */
  scope?: 'mine' | 'all';
}

/**
 * Invoices for the current retailer, or (scope: 'all') every invoice for admins.
 * The 'invoices' table is not yet in the generated Supabase types, so rows are
 * mapped manually (same convention as usePublisherTransfers).
 */
export function useInvoices(options: UseInvoicesOptions = {}) {
  const scope = options.scope ?? 'mine';
  const { user } = useAuth();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchInvoices = useCallback(async () => {
    if (scope === 'mine' && !user) {
      setInvoices([]);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      let query = supabase
        .from('invoices')
        .select('*')
        .order('created_at', { ascending: false });

      if (scope === 'mine') {
        query = query.eq('retailer_id', user!.id);
      }

      const { data, error: fetchError } = await query;
      if (fetchError) {
        setError(fetchError.message);
        return;
      }

      const mapped = ((data as Record<string, unknown>[]) || []).map(mapInvoice);

      // For the admin view, decorate with retailer shop names.
      if (scope === 'all' && mapped.length > 0) {
        const retailerIds = Array.from(new Set(mapped.map((i) => i.retailer_id)));
        const { data: retailers } = await supabase
          .from('retailers')
          .select('user_id, shop_name')
          .in('user_id', retailerIds);
        const nameByUser = new Map(
          ((retailers as Record<string, unknown>[]) || []).map((r) => [
            r.user_id as string,
            (r.shop_name as string) ?? null,
          ])
        );
        mapped.forEach((i) => {
          i.shop_name = nameByUser.get(i.retailer_id) ?? null;
        });
      }

      setInvoices(mapped);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  }, [scope, user]);

  useEffect(() => {
    fetchInvoices();
  }, [fetchInvoices]);

  const openTotal = invoices
    .filter((i) => i.status === 'open' || i.status === 'overdue')
    .reduce((sum, i) => sum + i.amount_due, 0);

  return { invoices, isLoading, error, openTotal, refetch: fetchInvoices };
}
