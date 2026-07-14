# AP Police Family Assessment Platform (APFAP)

Official survey platform for the Andhra Pradesh Police Department. A single super admin
account creates and publishes surveys; the public answers them at a shareable link with
no login required.

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
