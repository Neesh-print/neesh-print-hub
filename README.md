# Neesh

Wholesale marketplace for independent magazines — publishers list titles, retailers order at wholesale, publishers ship direct. Live at [neesh.art](https://neesh.art), operated by WAU LLC.

## Stack

React 18 + TypeScript + Vite, Tailwind CSS + shadcn/ui, Supabase (auth, Postgres, storage, edge functions), Stripe Connect for payments and payouts, Resend for email. Hosted on Vercel; deploys automatically from `main`.

## Development

```bash
npm install
npm run dev        # dev server on port 8080
npm run build      # production build
npm run lint       # ESLint
npm run test       # tests
```

Required environment variables (see `.env`):

```
VITE_SUPABASE_URL=            # Supabase project URL
VITE_SUPABASE_PUBLISHABLE_KEY= # Supabase anon/public key
```

## Architecture notes

See `CLAUDE.md` for the full architecture guide (roles, routing, component organization, data layer). Legal documents rendered at `/legal/*` live in `src/pages/marketing/legal/legalContent.ts` — edit the canonical markdown there. Database migrations are in `supabase/migrations/`, edge functions in `supabase/functions/`.
