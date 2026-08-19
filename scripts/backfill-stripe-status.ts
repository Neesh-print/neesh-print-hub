// One-off backfill: read current Connect account state from Stripe for every
// publisher that already has a stripe_account_id, and write the persisted
// status columns added in 20260721000000_add_publisher_stripe_status.sql.
//
// Run once after deploying that migration. Safe to re-run — it only updates
// existing rows and does not create anything in Stripe.
//
// Usage (Deno, matching the edge-function runtime):
//   STRIPE_SECRET_KEY=sk_live_... \
//   SUPABASE_URL=https://xxxx.supabase.co \
//   SUPABASE_SERVICE_ROLE_KEY=eyJ... \
//   deno run --allow-env --allow-net scripts/backfill-stripe-status.ts
//
// Add --commit to actually write. Without it the script runs in dry-run mode
// and only prints what it would change.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@14.10.0?target=deno'

const COMMIT = Deno.args.includes('--commit')

const stripeKey = Deno.env.get('STRIPE_SECRET_KEY')
const supabaseUrl = Deno.env.get('SUPABASE_URL')
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

if (!stripeKey || !supabaseUrl || !serviceKey) {
  console.error('Missing STRIPE_SECRET_KEY, SUPABASE_URL, or SUPABASE_SERVICE_ROLE_KEY')
  Deno.exit(1)
}

const stripe = new Stripe(stripeKey, {
  // @ts-ignore: pinned to match the rest of the codebase
  apiVersion: '2026-01-28.clover',
  httpClient: Stripe.createFetchHttpClient(),
})

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

console.log(COMMIT ? '=== BACKFILL (writing changes) ===' : '=== BACKFILL (dry run — pass --commit to write) ===')

const { data: publishers, error } = await supabase
  .from('publishers')
  .select('id, company_name, stripe_account_id')
  .not('stripe_account_id', 'is', null)

if (error) {
  console.error('Failed to load publishers:', error.message)
  Deno.exit(1)
}

console.log(`Found ${publishers?.length ?? 0} publisher(s) with a stripe_account_id`)

let updated = 0
let failed = 0

for (const p of publishers ?? []) {
  try {
    const account = await stripe.accounts.retrieve(p.stripe_account_id as string)

    const requirements = account.requirements
      ? {
          currently_due: account.requirements.currently_due ?? [],
          past_due: account.requirements.past_due ?? [],
          pending_verification: account.requirements.pending_verification ?? [],
          disabled_reason: account.requirements.disabled_reason ?? null,
          current_deadline: account.requirements.current_deadline ?? null,
        }
      : null

    const patch = {
      stripe_charges_enabled: !!account.charges_enabled,
      stripe_payouts_enabled: !!account.payouts_enabled,
      stripe_details_submitted: !!account.details_submitted,
      stripe_requirements_due: requirements,
      stripe_account_created_at: account.created
        ? new Date(account.created * 1000).toISOString()
        : null,
      stripe_status_updated_at: new Date().toISOString(),
    }

    console.log(
      `${p.company_name ?? p.id}: charges=${patch.stripe_charges_enabled} ` +
        `payouts=${patch.stripe_payouts_enabled} details=${patch.stripe_details_submitted} ` +
        `due=${requirements?.currently_due.length ?? 0}`,
    )

    if (COMMIT) {
      const { error: updErr } = await supabase.from('publishers').update(patch).eq('id', p.id)
      if (updErr) {
        console.error(`  ! failed to write ${p.id}: ${updErr.message}`)
        failed++
        continue
      }
    }
    updated++
  } catch (e) {
    console.error(`  ! Stripe retrieve failed for ${p.stripe_account_id} (${p.company_name}): ${(e as Error).message}`)
    failed++
  }
}

console.log(`\nDone. ${COMMIT ? 'Wrote' : 'Would write'} ${updated}, failed ${failed}.`)
