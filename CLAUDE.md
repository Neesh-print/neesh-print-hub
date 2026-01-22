# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

```bash
npm run dev        # Start dev server on port 8080
npm run build      # Production build
npm run build:dev  # Development build
npm run lint       # Run ESLint
npm run test       # Run tests once
npm run test:watch # Run tests in watch mode
```

## Tech Stack

- **Framework**: React 18 + TypeScript + Vite
- **Styling**: Tailwind CSS + shadcn/ui components
- **Backend**: Supabase (auth, database, storage)
- **State**: TanStack React Query for server state, React Context for local state
- **Forms**: React Hook Form + Zod validation
- **Routing**: React Router v6

## Architecture

### Multi-Tenant Role System
The app serves three user roles, each with dedicated routes and layouts:
- **Publisher** (`/publisher/*`) - Magazine publishers managing titles, orders, and earnings
- **Retailer** (`/retailer/*`) - Stores browsing catalog, ordering, and managing inventory
- **Admin** (`/admin/*`) - Platform operators managing applications, users, and fulfillment

### Route Protection
Routes are protected by `ProtectedRoute` component with `allowedRoles` prop. Auth state is managed via `useAuth` hook from `src/hooks/useAuth.tsx`.

### Component Organization
- `src/components/ui/` - shadcn/ui primitives (Button, Dialog, etc.)
- `src/components/neesh/` - Custom component library (MagazineCard, StatusBadge, DataTable, etc.)
- `src/components/{admin,publisher,retailer}/` - Role-specific layout and feature components
- `src/components/shared/` - Cross-role components (ErrorBoundary, LoadingScreen, SidebarNav)
- `src/components/skeletons/` - Loading skeleton components

### Page Organization
Each role has its own page directory with an `index.ts` barrel export:
- `src/pages/admin/` - Admin dashboard, applications, fulfillment, analytics
- `src/pages/publisher/` - Publisher dashboard, titles, orders, transfers
- `src/pages/retailer/` - Catalog, cart, checkout, orders, wishlist
- `src/pages/marketing/` - Public landing pages
- `src/pages/auth/` - Login, signup, password reset flows
- `src/pages/apply/` - Publisher/retailer application forms

### Hooks
Custom hooks in `src/hooks/` wrap Supabase queries using TanStack Query:
- `useAuth` - Authentication context and auth methods
- `useMagazines`, `useMagazine` - Magazine CRUD
- `useOrders`, `useOrder` - Order management
- `usePublisherProfile`, `useRetailerProfile` - Profile data
- `useMessages`, `useNotifications` - Communication features

### Data Layer
- Supabase client initialized in `src/integrations/supabase/client.ts`
- TypeScript types generated in `src/integrations/supabase/types.ts`
- Database migrations in `supabase/migrations/`
- Edge functions in `supabase/functions/`

### Path Aliases
The `@/` alias maps to `src/`. Example: `import { Button } from "@/components/ui/button"`.

## Environment Variables

Required in `.env`:
- `VITE_SUPABASE_URL` - Supabase project URL
- `VITE_SUPABASE_PUBLISHABLE_KEY` - Supabase anon/public key
