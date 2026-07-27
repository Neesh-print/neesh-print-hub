# Net 14 / Net 30 Payment Terms — Implementation Plan (Model B: publisher waits)

**Scope:** Let approved retailers buy on Net 14 / Net 30. Retailer is invoiced via Stripe
Invoicing and pays later (card or ACH). The publisher is **not** paid until the retailer's
invoice is paid — this reuses the existing `publisher_transfers` hold-and-release ledger, so
Neesh carries **no** credit risk or float. Treated as a live pilot: admin manually grants
terms to a small allowlist of retailers.

This plan is written against the current code:
- `supabase/functions/create-checkout/index.ts` (pay-now path — unchanged)
- `supabase/functions/stripe-webhook/index.ts` (extended)
- `supabase/functions/release-publisher-transfer/index.ts` (guarded)
- `supabase/functions/send-profile-reminders/index.ts` + `20260721000001_schedule_profile_reminders.sql` (cloned for invoice reminders)
- `supabase/migrations/20260218100000_create_publisher_transfers.sql` (extended)

---

## 0. Architecture at a glance

```
Retailer (terms-approved, within credit limit)
   │  selects "Net 30" at checkout
   ▼
create-net-order (NEW edge fn)  ── validates cart + credit ──┐
   │  creates orders (payment_status='invoiced')             │
   │  creates invoices row (status='open')                   │
   │  creates publisher_transfers (pending, HELD)            │
   │  creates + finalizes + sends a Stripe Invoice           │
   ▼                                                         │
Retailer receives hosted Stripe invoice (card + ACH) ────────┘
   │  pays within 14/30 days
   ▼
Stripe fires invoice.paid → stripe-webhook (EXTENDED)
   │  marks invoice paid + orders paid
   │  AUTO-RELEASES held publisher_transfers (stripe.transfers.create)
   ▼
Publisher paid.  Neesh keeps 10%.

Daily cron → send-invoice-reminders (NEW) → marks overdue, emails retailers.
```

Pay-now checkout (`create-checkout` → `checkout.session.completed`) is **untouched**.

---

## 1. Database migrations

### 1a. `supabase/migrations/20260727000001_net_terms_schema.sql` (NEW)

```sql
-- ============================================================
-- Net 14 / Net 30 payment terms — Model B (publisher waits)
-- ============================================================

-- 1) Retailer credit / terms fields -----------------------------------------
ALTER TABLE public.retailers
  ADD COLUMN IF NOT EXISTS payment_terms_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS net_terms_days INTEGER NOT NULL DEFAULT 0
    CHECK (net_terms_days IN (0, 14, 30)),
  ADD COLUMN IF NOT EXISTS credit_limit NUMERIC(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS terms_status TEXT NOT NULL DEFAULT 'none'
    CHECK (terms_status IN ('none','pending','approved','suspended')),
  ADD COLUMN IF NOT EXISTS terms_approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS terms_approved_by UUID REFERENCES auth.users(id);

COMMENT ON COLUMN public.retailers.credit_limit IS
  'Max total outstanding (open+overdue) invoice balance allowed on net terms, USD.';

-- 2) Invoices table = the order header that groups line items ----------------
--    NOTE: retailer_id stores the AUTH USER ID, to match the existing
--    orders.retailer_id convention (orders.retailer_id = auth.uid()).
CREATE TABLE IF NOT EXISTS public.invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  retailer_id UUID NOT NULL,
  stripe_invoice_id TEXT UNIQUE,
  stripe_customer_id TEXT,
  hosted_invoice_url TEXT,
  invoice_pdf_url TEXT,
  terms_days INTEGER NOT NULL CHECK (terms_days IN (14, 30)),
  subtotal NUMERIC(10,2) NOT NULL DEFAULT 0,   -- sum(wholesale*1.10*qty)
  tax NUMERIC(10,2) NOT NULL DEFAULT 0,
  total NUMERIC(10,2) NOT NULL DEFAULT 0,
  amount_paid NUMERIC(10,2) NOT NULL DEFAULT 0,
  amount_due NUMERIC(10,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','open','paid','overdue','void','uncollectible')),
  issued_at TIMESTAMPTZ,
  due_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  last_reminder_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_invoices_retailer ON public.invoices(retailer_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status   ON public.invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_stripe   ON public.invoices(stripe_invoice_id);

CREATE TRIGGER set_invoices_updated_at
  BEFORE UPDATE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3) Split payment from fulfillment on orders --------------------------------
--    Existing rows are all pay-now/paid, so defaults backfill correctly.
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS payment_method TEXT NOT NULL DEFAULT 'pay_now'
    CHECK (payment_method IN ('pay_now','net14','net30')),
  ADD COLUMN IF NOT EXISTS payment_status TEXT NOT NULL DEFAULT 'paid'
    CHECK (payment_status IN ('unpaid','invoiced','paid','overdue','written_off','refunded')),
  ADD COLUMN IF NOT EXISTS invoice_id UUID REFERENCES public.invoices(id),
  ADD COLUMN IF NOT EXISTS due_date TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_orders_invoice        ON public.orders(invoice_id);
CREATE INDEX IF NOT EXISTS idx_orders_payment_status ON public.orders(payment_status);

-- 4) Hold flag on the existing payout ledger ---------------------------------
ALTER TABLE public.publisher_transfers
  ADD COLUMN IF NOT EXISTS hold_reason TEXT
    CHECK (hold_reason IS NULL OR hold_reason IN ('awaiting_invoice_payment')),
  ADD COLUMN IF NOT EXISTS invoice_id UUID REFERENCES public.invoices(id);

COMMENT ON COLUMN public.publisher_transfers.hold_reason IS
  'When set, transfer is held until the retailer pays the linked invoice (net terms). '
  'NULL = releasable now (pay-now order).';

-- 5) RLS for invoices --------------------------------------------------------
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Retailers can view their own invoices"
  ON public.invoices FOR SELECT TO authenticated
  USING (retailer_id = auth.uid());

CREATE POLICY "Admins can view all invoices"
  ON public.invoices FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admins can manage invoices"
  ON public.invoices FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'));
-- (Edge functions write via service role and bypass RLS.)

-- 6) Helper functions --------------------------------------------------------

-- Current outstanding balance for a retailer (open + overdue invoices).
CREATE OR REPLACE FUNCTION public.retailer_outstanding_balance(p_retailer_id UUID)
RETURNS NUMERIC
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(SUM(amount_due), 0)
  FROM public.invoices
  WHERE retailer_id = p_retailer_id
    AND status IN ('open','overdue');
$$;

-- Flip open invoices to overdue once past due (run daily by the cron).
CREATE OR REPLACE FUNCTION public.mark_overdue_invoices()
RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n INTEGER;
BEGIN
  WITH upd AS (
    UPDATE public.invoices
    SET status = 'overdue'
    WHERE status = 'open' AND due_at < now()
    RETURNING id
  )
  SELECT count(*) INTO n FROM upd;
  UPDATE public.orders SET payment_status = 'overdue'
    WHERE invoice_id IN (SELECT id FROM public.invoices WHERE status = 'overdue')
      AND payment_status = 'invoiced';
  RETURN n;
END;
$$;

-- Invoices needing a reminder email (due within 3 days or overdue, not
-- reminded in the last 3 days). Mirrors due_profile_reminders().
CREATE OR REPLACE FUNCTION public.due_invoice_reminders()
RETURNS TABLE (
  invoice_id UUID, retailer_id UUID, email TEXT, shop_name TEXT,
  total NUMERIC, amount_due NUMERIC, due_at TIMESTAMPTZ,
  hosted_invoice_url TEXT, reminder_kind TEXT
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT i.id, i.retailer_id, u.email, r.shop_name,
         i.total, i.amount_due, i.due_at, i.hosted_invoice_url,
         CASE WHEN i.due_at < now() THEN 'overdue' ELSE 'due_soon' END
  FROM public.invoices i
  JOIN public.users u       ON u.id = i.retailer_id
  LEFT JOIN public.retailers r ON r.user_id = i.retailer_id
  WHERE i.status IN ('open','overdue')
    AND (i.last_reminder_at IS NULL OR i.last_reminder_at < now() - interval '3 days')
    AND i.due_at < now() + interval '3 days';
$$;
```

> **FK caveat carried over:** the exploration flagged that `orders.retailer_id` is treated as
> `auth.uid()` in the webhook/RLS even though a migration once pointed the FK at `retailers.id`.
> This plan follows the *runtime* convention (`retailer_id = auth.uid()`). Verify the live FK
> before applying; if it genuinely references `retailers.id`, adjust `invoices.retailer_id` and
> the RLS `USING` clauses to join through `retailers`.

### 1b. `supabase/migrations/20260727000002_schedule_invoice_reminders.sql` (NEW)

Clone of `20260721000001_schedule_profile_reminders.sql`, reusing the **same** Vault secrets
(`project_url`, `reminder_secret`) — no new secrets needed.

```sql
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

SELECT cron.unschedule('send-invoice-reminders-daily')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'send-invoice-reminders-daily');

-- 16:00 UTC daily (1h after the profile-reminders job).
SELECT cron.schedule(
  'send-invoice-reminders-daily',
  '0 16 * * *',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'project_url')
           || '/functions/v1/send-invoice-reminders',
    headers := jsonb_build_object(
      'Content-Type','application/json',
      'x-reminder-secret',(SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'reminder_secret')
    ),
    body := '{}'::jsonb
  );
  $$
);
```

---

## 2. Edge functions

### 2a. `supabase/functions/create-net-order/index.ts` (NEW)

Sibling of `create-checkout`, but instead of a Checkout Session it creates orders + an invoice.
Reuses the exact same auth gate, CORS block, cart validation, price computation
(`wholesale * 1.10`), min-qty and inventory checks, and Stripe-customer handling from
`create-checkout/index.ts`. Deltas below.

**Request:** `{ cart_items: {magazine_id, quantity}[], terms_days: 14 | 30 }`

**Logic (after the shared cart validation):**

```ts
// --- Terms eligibility + credit gate (NEW) ---
const { data: retailerRow } = await supabaseClient
  .from('retailers')
  .select('id, payment_terms_enabled, net_terms_days, terms_status, credit_limit')
  .eq('user_id', user.id)
  .single()

if (!retailerRow?.payment_terms_enabled || retailerRow.terms_status !== 'approved') {
  return json(403, { error: 'Your account is not approved for payment terms.' })
}
// Retailer may pick any term up to what they're approved for.
const termsDays = checkoutRequest.terms_days
if (![14, 30].includes(termsDays) || termsDays > retailerRow.net_terms_days) {
  return json(400, { error: `Net ${termsDays} is not available on your account.` })
}

// totalAmount (cents) computed exactly as in create-checkout
const totalDollars = totalAmount / 100
const { data: outstanding } = await supabaseClient
  .rpc('retailer_outstanding_balance', { p_retailer_id: user.id })
if ((Number(outstanding) + totalDollars) > Number(retailerRow.credit_limit)) {
  return json(400, {
    error: 'This order exceeds your available credit. Pay an open invoice or pay now.',
    available_credit: Number(retailerRow.credit_limit) - Number(outstanding),
  })
}
```

Then, using the **service-role** client (create orders/invoices/transfers reliably; mirror the
webhook's `supabaseAdmin`):

```ts
// 1) Ensure a Stripe customer with an address (needed for Stripe Tax on invoices).
//    Reuse the create-checkout customer block; if none exists, create one from the
//    retailer's default shipping_address and persist profiles.stripe_customer_id.

// 2) Create the invoice header (draft) in our DB.
const dueAt = new Date(Date.now() + termsDays * 86400_000).toISOString()
const { data: inv } = await supabaseAdmin.from('invoices').insert({
  retailer_id: user.id,
  stripe_customer_id: stripeCustomerId,
  terms_days: termsDays,
  subtotal: totalDollars,
  total: totalDollars,          // tax filled in after Stripe finalizes
  amount_due: totalDollars,
  status: 'draft',
  due_at: dueAt,
}).select('id').single()

// 3) Create one order per line item (shipped-before-paid representation).
//    status='confirmed' (fulfillment), payment_status='invoiced'.
for (const item of cart) {
  const order = await supabaseAdmin.from('orders').insert({
    retailer_id: user.id,
    magazine_id: item.magazine_id,
    quantity: item.quantity,
    unit_price: retailerUnitPrice,
    total_price: retailerUnitPrice * item.quantity,
    status: 'confirmed',
    payment_method: `net${termsDays}`,
    payment_status: 'invoiced',
    invoice_id: inv.id,
    due_date: dueAt,
  }).select('id').single()
  await supabaseAdmin.rpc('decrease_inventory', {
    p_magazine_id: item.magazine_id, p_quantity: item.quantity })

  // 4) Held publisher transfer (reuses existing ledger; hold_reason set).
  await supabaseAdmin.from('publisher_transfers').upsert({
    publisher_id: magazine.publisher_id,
    order_id: order.id,
    invoice_id: inv.id,
    gross_amount: retailerUnitPrice * item.quantity,
    net_amount: wholesalePrice * item.quantity,
    platform_fee: (retailerUnitPrice - wholesalePrice) * item.quantity,
    status: 'pending',
    hold_reason: 'awaiting_invoice_payment',
  }, { onConflict: 'order_id', ignoreDuplicates: true })
}

// 5) Create + finalize + send the Stripe invoice.
const stripeInvoice = await stripe.invoices.create({
  customer: stripeCustomerId,
  collection_method: 'send_invoice',
  days_until_due: termsDays,
  auto_advance: true,
  automatic_tax: { enabled: true },
  payment_settings: { payment_method_types: ['card', 'us_bank_account'] }, // ACH
  metadata: { neesh_invoice_id: inv.id, retailer_id: user.id },
})
for (const item of cart) {
  await stripe.invoiceItems.create({
    customer: stripeCustomerId,
    invoice: stripeInvoice.id,
    currency: 'usd',
    unit_amount: retailerUnitPrice_cents,
    quantity: item.quantity,
    description: magazine.title,
  })
}
const finalized = await stripe.invoices.finalizeInvoice(stripeInvoice.id)
await stripe.invoices.sendInvoice(stripeInvoice.id) // emails the hosted invoice

// 6) Persist Stripe identifiers back to our invoice row.
await supabaseAdmin.from('invoices').update({
  stripe_invoice_id: finalized.id,
  hosted_invoice_url: finalized.hosted_invoice_url,
  invoice_pdf_url: finalized.invoice_pdf,
  status: 'open',
  issued_at: new Date().toISOString(),
  due_at: finalized.due_date ? new Date(finalized.due_date * 1000).toISOString() : dueAt,
  subtotal: (finalized.subtotal ?? 0) / 100,
  tax: (finalized.tax ?? 0) / 100,
  total: (finalized.total ?? 0) / 100,
  amount_due: (finalized.amount_due ?? 0) / 100,
}).eq('id', inv.id)

// 7) Notify publishers: new order, payout delayed until retailer pays (~term).
//    Reuse the webhook's sendOrderNotificationToPublisher, adding a terms note.

return json(200, { invoice_id: inv.id, hosted_invoice_url: finalized.hosted_invoice_url })
```

**Notes**
- **Idempotency:** guard against double-submit by checking for a very recent open invoice for
  the same retailer/cart, or accept a client `idempotency_key` and pass it to
  `stripe.invoices.create({}, { idempotencyKey })`.
- **Order of operations:** create DB orders *before* the Stripe invoice so a Stripe failure
  leaves recoverable local state; wrap steps 2–4 so a failure marks the invoice `void` and
  restores inventory.

### 2b. `supabase/functions/stripe-webhook/index.ts` (EXTEND)

Add these `case`s to the existing `switch (event.type)`. Invoices are created on the **platform
account**, so these events arrive on the existing `STRIPE_WEBHOOK_SECRET` endpoint — just add
the event types in the Stripe dashboard.

```ts
case 'invoice.paid': {
  const invoice = event.data.object as Stripe.Invoice
  const neeshInvoiceId = invoice.metadata?.neesh_invoice_id
  if (!neeshInvoiceId) break

  // Idempotency
  const { data: existing } = await supabaseAdmin
    .from('invoices').select('status').eq('id', neeshInvoiceId).single()
  if (existing?.status === 'paid') { break }

  await supabaseAdmin.from('invoices').update({
    status: 'paid',
    amount_paid: (invoice.amount_paid ?? 0) / 100,
    amount_due: (invoice.amount_remaining ?? 0) / 100,
    paid_at: new Date().toISOString(),
  }).eq('id', neeshInvoiceId)

  await supabaseAdmin.from('orders')
    .update({ payment_status: 'paid' }).eq('invoice_id', neeshInvoiceId)

  // AUTO-RELEASE held publisher transfers for this invoice.
  const { data: transfers } = await supabaseAdmin
    .from('publisher_transfers')
    .select('id, order_id, net_amount, status, publishers!inner(stripe_account_id, company_name)')
    .eq('invoice_id', neeshInvoiceId).eq('status', 'pending')

  for (const t of transfers ?? []) {
    const acct = (t.publishers as any)?.stripe_account_id
    if (!acct) {
      await supabaseAdmin.from('publisher_transfers').update({
        status: 'failed', failure_reason: 'Publisher has no connected Stripe account',
      }).eq('id', t.id)
      continue
    }
    try {
      const transfer = await stripe.transfers.create({
        amount: Math.round(t.net_amount * 100),
        currency: 'usd',
        destination: acct,
        transfer_group: t.order_id,
        // Tie to the invoice's charge so the transfer waits for funds to settle
        // (important for ACH — invoice.paid fires post-settlement, but this is belt-and-braces).
        source_transaction: (invoice.charge as string) || undefined,
        description: `Neesh payout for order ${t.order_id} (invoice ${invoice.number})`,
      })
      await supabaseAdmin.from('publisher_transfers').update({
        status: 'transferred', stripe_transfer_id: transfer.id,
        hold_reason: null, transferred_at: new Date().toISOString(),
        released_at: new Date().toISOString(),
      }).eq('id', t.id)
    } catch (err) {
      await supabaseAdmin.from('publisher_transfers').update({
        status: 'failed', failure_reason: err instanceof Error ? err.message : 'transfer error',
      }).eq('id', t.id)
    }
  }
  break
}

case 'invoice.payment_failed': {
  const invoice = event.data.object as Stripe.Invoice
  const id = invoice.metadata?.neesh_invoice_id
  if (id) {
    // send_invoice doesn't auto-charge, but handle for safety / future auto-charge.
    await sendSimpleAdminNotification(
      Deno.env.get('ADMIN_EMAIL') || 'hi@neesh.art',
      'Invoice payment failed',
      `Invoice ${invoice.number} payment attempt failed. Amount due $${((invoice.amount_remaining??0)/100).toFixed(2)}.`)
  }
  break
}

case 'invoice.marked_uncollectible': {
  const invoice = event.data.object as Stripe.Invoice
  const id = invoice.metadata?.neesh_invoice_id
  if (id) {
    await supabaseAdmin.from('invoices').update({ status: 'uncollectible' }).eq('id', id)
    await supabaseAdmin.from('orders').update({ payment_status: 'written_off' }).eq('invoice_id', id)
    // Held transfers are left pending (never released). Admin decides next step.
    await sendSimpleAdminNotification(
      Deno.env.get('ADMIN_EMAIL') || 'hi@neesh.art',
      'URGENT: Invoice uncollectible',
      `Invoice ${invoice.number} marked uncollectible. Publisher NOT paid — resolve manually.`)
  }
  break
}

case 'invoice.voided': {
  const invoice = event.data.object as Stripe.Invoice
  const id = invoice.metadata?.neesh_invoice_id
  if (id) {
    await supabaseAdmin.from('invoices').update({ status: 'void' }).eq('id', id)
    await supabaseAdmin.from('orders').update({ payment_status: 'unpaid', status: 'cancelled' }).eq('invoice_id', id)
    await supabaseAdmin.from('publisher_transfers')
      .update({ status: 'failed', failure_reason: 'Invoice voided' })
      .eq('invoice_id', id).eq('status', 'pending')
    // Optional: restore inventory via an increase_inventory RPC.
  }
  break
}
```

Also update the existing publisher-notification helper (`sendOrderNotificationToPublisher`) to
accept an optional terms note ("Payment terms: Net 30 — your payout releases after the retailer
pays, est. <date>") so both the pay-now webhook path and `create-net-order` can share it.

### 2c. `supabase/functions/send-invoice-reminders/index.ts` (NEW)

Near-verbatim clone of `send-profile-reminders/index.ts`: same `x-reminder-secret` gate, same
service-role client, same Resend loop, same "stamp only after confirmed send" pattern. Deltas:

```ts
// 1) flip overdue first
await supabase.rpc('mark_overdue_invoices')
// 2) who needs a reminder
const { data } = await supabase.rpc('due_invoice_reminders')
// 3) for each: Resend email with hosted_invoice_url as the "Pay now" CTA,
//    subject varies by reminder_kind ('due_soon' vs 'overdue').
// 4) on success: update invoices.last_reminder_at = now() (retry on failure).
```

### 2d. `supabase/functions/release-publisher-transfer/index.ts` (GUARD)

Prevent an admin from accidentally paying a publisher before the retailer has paid. After the
`status !== 'pending'` check (line 112), add:

```ts
if (transfer.hold_reason === 'awaiting_invoice_payment' && !force) {
  results.push({ id: transferId, success: false,
    error: 'Held until the retailer pays the linked invoice.' })
  continue
}
```
Add `const { transferIds, force = false } = await req.json()`. Also `select` `hold_reason` in
the transfer fetch. Auto-release on `invoice.paid` (2b) is the normal path; `force` is an
admin override for edge cases (e.g. offline payment reconciled manually).

### 2e. `supabase/functions/set-retailer-terms/index.ts` (NEW)

Admin-gated (copy the admin auth block from `release-publisher-transfer/index.ts`). Sets the
credit decision on a retailer:

```ts
// body: { retailer_user_id, payment_terms_enabled, net_terms_days, credit_limit, terms_status }
await supabaseAdmin.from('retailers').update({
  payment_terms_enabled, net_terms_days, credit_limit,
  terms_status, // 'approved' | 'suspended' | 'none'
  terms_approved_at: terms_status === 'approved' ? new Date().toISOString() : null,
  terms_approved_by: user.id,
}).eq('user_id', retailer_user_id)
```
(Alternatively skip this function and update `retailers` directly from the admin UI under the
existing "Admins can manage all" RLS — but an edge function keeps the audit fields honest.)

---

## 3. Frontend changes (file-by-file)

### Data / hooks
- **`src/integrations/supabase/types.ts`** — regenerate after migrations (`supabase gen types`),
  so `invoices`, new `orders`/`retailers` columns, and RPCs are typed.
- **`src/hooks/useRetailerCredit.ts`** (NEW) — returns `{ termsEnabled, netTermsDays, creditLimit,
  outstanding, available }`; reads `retailers` + `retailer_outstanding_balance` RPC.
- **`src/hooks/useInvoices.ts`** (NEW) — list current retailer's invoices; get one by id
  (for the invoice page). Admin variant lists all with aging.

### Retailer
- **`src/pages/retailer/RetailerCart.tsx`** and **`RetailerCheckout.tsx`** — add a payment-method
  selector shown **only** when `useRetailerCredit().termsEnabled`: *Pay now* (existing →
  `create-checkout` → Stripe redirect) vs *Net 14 / Net 30*. The Net path calls
  `supabase.functions.invoke('create-net-order', { cart_items, terms_days })`, then routes to the
  invoice/confirmation page (no Stripe redirect). Disable Net options and show remaining credit
  when `cartTotal > available`.
- **`src/pages/retailer/RetailerOrderInvoice.tsx`** — replace the `MOCK_ORDER` block with a real
  fetch by `invoice_id` (via `useInvoices`); render status, issued/due dates, line items, and a
  **"Pay now"** button linking to `hosted_invoice_url` for open/overdue invoices.
- **`src/pages/retailer/RetailerInvoices.tsx`** (NEW) + route in `src/App.tsx` + a nav entry —
  the retailer's AR list (open / overdue / paid) with pay links.
- **`src/components/retailer/OrderStatusTimeline.tsx`** — it only understands
  `pending|confirmed|shipped|delivered|cancelled`. Add a payment badge driven by the new
  `payment_status` (`invoiced`/`overdue`/`paid`) so a shipped-but-unpaid order reads correctly.

### Publisher
- **`src/hooks/usePublisherTransfers.ts`** + **`src/pages/publisher/*` earnings/transfers view** —
  surface a third bucket: **"Pending — awaiting retailer payment"** (rows where
  `hold_reason = 'awaiting_invoice_payment'`), distinct from ordinary pending and transferred.
  Update any "available balance" math to exclude held rows.
- **Publisher order list/detail** — audit filters that assume `status = 'paid'`; terms orders
  are `status = 'confirmed'`, `payment_status = 'invoiced'`. They must still appear as
  fulfillable. Add a "Net terms" indicator + expected-payout date.

### Admin
- **`src/pages/admin/AdminApplicationDetail.tsx`** (or a new **`AdminRetailerDetail`**) — controls
  to grant/adjust terms: `net_terms_days`, `credit_limit`, `terms_status` → calls
  `set-retailer-terms`.
- **`src/pages/admin/AdminInvoices.tsx`** (NEW) + route — AR aging (open/overdue/paid,
  days-outstanding), with actions to void / mark uncollectible / mark paid (offline payments)
  via Stripe + DB.
- **`src/pages/admin/AdminPublisherTransfers.tsx`** — add a "Held (awaiting payment)" filter/tab
  so held rows are visually separate from releasable ones; wire the `force` override for manual
  release.
- **Shared `StatusBadge`** (`src/components/neesh/`) — add color/label mappings for
  `invoiced`, `overdue`, `written_off`, and invoice statuses.

---

## 4. Stripe dashboard / config (no new app env vars)

1. **Enable ACH Direct Debit**: turn on `us_bank_account` + Financial Connections in Stripe so
   `payment_method_types: ['card','us_bank_account']` on invoices works. Steer retailers to ACH
   (0.8% capped ~$5 vs 2.9%+30¢ on card — protects the 10% margin).
2. **Webhook events**: add `invoice.paid`, `invoice.payment_failed`, `invoice.marked_uncollectible`,
   `invoice.voided` to the endpoint backed by `STRIPE_WEBHOOK_SECRET`.
3. **Stripe Tax**: confirm automatic tax is active for invoices (it's already on for Checkout);
   the customer needs an address (handled by the customer-creation block).
4. **Invoice reminders**: optionally enable Stripe's own reminder schedule as a backstop to our
   cron (belt-and-braces; avoid duplicate emails by picking one primary channel).
5. **Vault secrets**: the new cron reuses existing `project_url` + `reminder_secret` — nothing to add.
6. Reused env vars only: `STRIPE_SECRET_KEY`, `RESEND_API_KEY`, `REMINDER_SECRET`,
   `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_URL`.

---

## 5. Rollout sequence

1. Apply `20260727000001` + `20260727000002` (safe: additive columns w/ defaults, new table).
2. Deploy edge functions: `create-net-order`, `send-invoice-reminders`, `set-retailer-terms`;
   redeploy `stripe-webhook`, `release-publisher-transfer`.
3. Configure Stripe (ACH + webhook events).
4. `supabase gen types` → ship frontend.
5. In Stripe **test mode**, run the full path (below) end to end.
6. Approve 1–2 pilot retailers via the admin terms control. Go live.

---

## 6. Test checklist (Stripe test mode)

- [ ] Terms **not** offered to a retailer with `terms_status != 'approved'`.
- [ ] Net order blocked when `outstanding + cart > credit_limit`; allowed when within limit.
- [ ] `create-net-order` creates: N orders (`payment_status='invoiced'`), 1 invoice (`open`),
      N held `publisher_transfers`, and a finalized+sent Stripe invoice with a hosted URL.
- [ ] Inventory decremented at order creation.
- [ ] Publisher receives "new order — payout delayed" email; publisher dashboard shows the
      order as fulfillable and the payout as "awaiting retailer payment".
- [ ] Pay the invoice by **card** → `invoice.paid` → invoice `paid`, orders `paid`, transfers
      auto-released (`transferred`), publisher paid.
- [ ] Repeat paying by **ACH** (test bank) → transfer waits for settlement via
      `source_transaction`, then releases.
- [ ] `mark_overdue_invoices` flips a past-due open invoice to `overdue`; reminder email sends;
      `last_reminder_at` stamped; no duplicate within 3 days.
- [ ] `invoice.marked_uncollectible` → invoice `uncollectible`, orders `written_off`, transfers
      stay held, admin alerted.
- [ ] Admin `release-publisher-transfer` on a held row is **refused** without `force`.
- [ ] Pay-now checkout (existing flow) is unaffected end to end.

---

## 7. Known limitations / follow-ups (post-pilot)

- **ACH reversal window:** `invoice.paid` for ACH fires post-settlement, but a debit can still be
  returned/disputed days later. We release on `invoice.paid`; for the pilot's volume that risk is
  acceptable and admin-recoverable. Revisit before scaling.
- **Credit-limit race:** two concurrent net orders could both pass the credit check. Low risk at
  pilot volume; harden later with `SELECT … FOR UPDATE` or a DB constraint/trigger on outstanding.
- **Partial payments / credit memos / returns against an unpaid invoice** — not handled in v1;
  document the manual admin process (void + reissue) until built.
- **Underwriting** is entirely manual (admin allowlist) — deliberately. The retailer application
  collects no EIN/address/financials; add those fields when moving to self-serve terms.
- **Model C exit:** if defaults become a problem, swap the invoice-and-collect machinery for a
  non-recourse provider (Resolve/Balance/Hokodo) — publishers then get paid upfront and the
  provider carries the risk. The `invoices` + held-transfer abstraction makes that swap localized.
```
