# Jeevana Insight — Family Assessment Research Platform

A private research platform for family well-being assessments. A single super admin
account builds surveys from validated instruments and publishes them; families answer at
a shareable QR link with no login required.

## Stack

Vite + React + TypeScript, Tailwind CSS + shadcn/ui, Supabase (Postgres, Auth, RLS).

## Development

```sh
npm install
npm run dev
```

## Database

Migrations live in `supabase/migrations`. Apply with the Supabase CLI:

```sh
supabase db push
```
