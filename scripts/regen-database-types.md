# Regenerating `src/lib/database.types.ts`

Phase 0 / PR-0.5 — keep TypeScript types aligned with the live PostgreSQL schema.

## Prerequisites

- Supabase CLI (`npm i -g supabase`) **or** project linked via `npx supabase`
- Access to the project ref and a personal access token / DB URL

## Option A — Supabase CLI (recommended)

```bash
# From repo root
npx supabase gen types typescript --project-id YOUR_PROJECT_REF > src/lib/database.types.ts
```

Or with a direct connection string:

```bash
npx supabase gen types typescript --db-url "%DATABASE_URL%" > src/lib/database.types.ts
```

On PowerShell:

```powershell
npx supabase gen types typescript --db-url $env:DATABASE_URL | Set-Content -Encoding utf8 src/lib/database.types.ts
```

## Option B — npm script helper

```bash
npm run types:gen
```

This runs `scripts/regen-database-types.mjs`, which shells out to the Supabase CLI when `SUPABASE_PROJECT_ID` or `DATABASE_URL` / `SUPABASE_DB_URL` is set.

## After regenerating

1. Review the diff (new tables, renamed columns).
2. Fix any compile errors in app code.
3. Commit types together with the migration that introduced schema changes.

## When to regenerate

- After every SQL migration that adds/alters tables used by the app
- Before starting vertical work that depends on restaurant, journals, batches, etc.
- At least once per release train (R1+)

## Note

A full live regen was not run in Phase 0 if credentials were unavailable in CI. Run locally with your project credentials and commit the result.
