# ClassPortals

Marketplace connecting students with teachers, tuition institutes and
campus lecturers across Sri Lanka. See `../rq_md/` for the product spec and
`../req/` for the original static HTML prototype this app is being built
from — the design tokens, page map and feature list there are still the
source of truth for "what should this look like."

## Stack

Next.js (App Router, TypeScript) · Tailwind CSS v4 + shadcn/ui (Base UI
primitives) · `next-intl` (English / Sinhala / Tamil) · Supabase (Postgres +
Auth + Storage + Realtime, not yet connected — see below) · Zod.

## Getting started

```bash
npm install
npm run dev
```

Open <http://localhost:3000> — it redirects to `/en`. Try `/si` and `/ta`
directly, or use the language switcher in the header.

## Connecting Supabase

No Supabase project is wired up yet; the homepage currently renders from
mock data (`src/lib/mock-data.ts`). To connect a real one:

1. Create a project at [supabase.com](https://supabase.com).
2. Apply the schema: `supabase/migrations/*.sql`, in numeric order — either
   via the Supabase CLI (`supabase link` then `supabase db push`) or by
   pasting each file into the SQL Editor in order. `supabase/seed.sql` adds
   a handful of sample subjects for local testing.
3. Copy `.env.local.example` to `.env.local` and fill in the project URL,
   anon key, and service role key from Project Settings -> API.
4. Generate real types: `npx supabase gen types typescript --project-id <ref> > src/types/database.ts`
   (replaces the `any` placeholder currently there).

## Project structure

```
src/
├── app/[locale]/         # (public), (auth), (dashboard)/*, admin — route groups
├── components/
│   ├── ui/                # shadcn primitives — don't hand-edit, re-run `shadcn add`
│   └── features/          # product components (ListingCard, GradeLadder, ...)
├── i18n/                  # next-intl routing/navigation/request config
├── lib/
│   ├── supabase/          # client.ts (browser), server.ts (RLS-scoped), admin.ts (service role)
│   └── validation/        # zod schemas, one file per entity
├── server/actions/        # server actions, grouped by feature
└── types/                 # database.ts (generated) + domain types
messages/                  # en.json, si.json, ta.json — UI strings only
supabase/migrations/       # numbered SQL migrations, RLS co-located per table
```

## Internationalization

- UI chrome strings live in `messages/{locale}.json`. Content that belongs
  to a database row (subject names, note titles, ad copy) instead uses a
  `translations jsonb` column on that table — see `supabase/migrations/0007_subjects.sql`
  for the pattern. Don't mix the two: a new UI label goes in the JSON
  files; a new piece of user-generated text needing translation gets a
  `translations` column.
- Sinhala and Tamil are mandatory locales (see `src/i18n/routing.ts`).
  Missing keys fall back to the key name itself at dev time (a loud
  placeholder) rather than failing the build, so partial translation work
  never blocks shipping — check the browser console for `MISSING_MESSAGE`
  warnings before calling a locale "done".
- Which locales actually show up in the public switcher is admin-controlled
  (`locales.is_active`, see `src/i18n/active-locales.ts`) independently of
  which locales have a translation file — this lets a locale be soft-launched
  without a deploy once Supabase is connected.

## Security notes for anyone extending this

- Every table ships with Row Level Security from its first migration. If
  you add a table, add its policies in the same file — don't leave a table
  "temporarily open."
- `src/lib/supabase/admin.ts` bypasses RLS entirely. Only call it from a
  server action that has already re-checked the caller's role itself —
  the client believing it's an admin is never sufficient.
- Never expose a raw Storage URL for `notes` or `submissions` (both private
  buckets) — always mint a short-lived signed URL server-side.

## Commands

```bash
npm run dev      # start the dev server
npm run build    # production build (also runs the TypeScript check)
npm run lint     # eslint
```
