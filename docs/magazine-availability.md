# Magazine availability & counts — single source of truth

Two things here were historically duplicated across the codebase and drifted out
of sync. This note records the consolidated definitions so new surfaces reuse
them instead of inventing a third copy.

## "Is this magazine in stock / orderable?"

**Use `isMagazineInStock(magazine)` from `src/lib/inventory.ts`. Do not re-derive
availability inline.**

The rule:

- `fulfillment_method === 'neesh_handled'` → always orderable (Neesh fulfils
  centrally; the publisher's `inventory_count` does not gate it).
- otherwise (`publisher_handled`) → orderable when `inventory_count > 0`.
  A `null`/untracked count is treated as available; `0` is out of stock.

Any surface that decides whether to **show, hide, grey out, or disable ordering**
for a magazine must go through this helper so the surfaces agree. Current
callers:

- `src/pages/retailer/RetailerCatalogue.tsx` — the "In stock" filter.
- `src/pages/retailer/RetailerTitleDetail.tsx` — `outOfStock` / add-to-cart.
- `src/pages/public/PublisherPublicProfile.tsx` (`/p/:id`) — see below.

Related display helpers in the same file (`getStockLevel`, `getStockMessage`,
`isInStock`) are **quantity-scarcity** helpers for badges ("Only 3 left"). They
are inventory-only and do NOT know about `fulfillment_method`; they are for
display copy, not the availability decision.

### Do NOT hide out-of-stock titles by filtering the query

`/p/:id` used to fetch titles with `.gt('inventory_count', 0)`, which *hid*
active-but-out-of-stock titles entirely. This made a publisher's public page
read "0 titles available / No titles currently in stock" for titles that were
live everywhere else in the app.

Rule: fetch **all active titles** (`.eq('is_active', true)`) and let
`MagazineCard` badge the stock state. A publisher's active catalogue should
never render as silently empty just because stock is 0.

## Publisher magazine count

**There is no stored count column. Count live from the `magazines` relation.**

The `publishers.total_magazines` column was removed
(`supabase/migrations/20260220000000_drop_total_magazines.sql`) because nothing
ever maintained it — no trigger, default, or write path — so it read `0` for
every publisher and silently corrupted any UI that trusted it.

To get a publisher's title count, embed the aggregate in the query:

```ts
supabase.from('publishers').select('*, magazines(count)')
// → row.magazines[0].count
```

Current callers: `src/hooks/usePublisherProfile.ts`,
`src/pages/admin/AdminPublishers.tsx`, `src/pages/admin/AdminPublisherDetail.tsx`.

## Lessons for future changes

- When the same row looks different on two screens, suspect **duplicated logic**,
  not one broken query. Fix by consolidating into a shared helper, not by
  aligning two copies.
- A DB column with no write path is a latent bug. `.select('*')` will happily
  return it and generated types will vouch for it, but the value is meaningless.
  Prefer live/derived values over denormalized counters unless a trigger keeps
  them honest.
