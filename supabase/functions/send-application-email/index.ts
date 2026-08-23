// TOMBSTONE — retired 2026-08-23. This function intentionally does nothing.
//
// Why it was retired:
//   A duplicate application-received emailer. It was also broken: it passed a literal Resend key string to Deno.env.get() as if it were a variable name, so the key was always undefined and every send failed unauthenticated. That hard-coded key is removed by this tombstone and should be rotated.
//
// Use instead: send-application-received-email
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
    `[tombstone] send-application-email called (origin: ${req.headers.get('origin') ?? 'none'}) — returning 410`
  )

  return new Response(
    JSON.stringify({
      error: 'gone',
      message: 'send-application-email was retired on 2026-08-23. Use send-application-received-email instead.',
    }),
    { status: 410, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
})
