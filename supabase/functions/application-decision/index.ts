// TOMBSTONE — retired 2026-08-23. This function intentionally does nothing.
//
// Why it was retired:
//   Wrote status/reviewed_at/reviewed_by to both application tables without provisioning an auth user, users/profiles/publishers/retailers rows or the initial magazine, leaving applications approved with no account behind them. It also hard-coded the recipient to a personal test address, so applicants never received the decision.
//
// Use instead: approve-application
//
// Kept as a tombstone rather than deleted so the slug stays claimed and any
// lingering caller gets an explicit 410 that shows up in the logs, rather than
// a silent 404 or, worse, the old behaviour. Do not restore this file: if the
// behaviour is ever needed again, add it to the replacement above.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

Deno.serve((req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  // Logged so a caller that still exists is discoverable rather than silent.
  console.warn(
    `[tombstone] application-decision called (origin: ${req.headers.get('origin') ?? 'none'}) — returning 410`
  )

  return new Response(
    JSON.stringify({
      error: 'gone',
      message: 'application-decision was retired on 2026-08-23. Use approve-application instead.',
    }),
    { status: 410, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
})
