# Environment setup (Phase 0)

1. Copy the template:
   ```bash
   cp .env.example .env.local
   ```
2. Fill `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` from the Supabase project settings.
3. Set `NEXT_PUBLIC_PLATFORM_SHOP_ID` to the shop UUID that stores platform SaaS config (`company_details` for plans/gateways).
4. For server routes (pay, migrate), set `SUPABASE_SERVICE_ROLE_KEY` and optionally `DATABASE_URL` / `SUPABASE_DB_URL`.
5. Never commit `.env.local` or `client_secret_*.json`.

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Local HTTPS dev server |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run ci` | lint + typecheck |
| `npm run types:gen` | Regenerate `database.types.ts` (see `scripts/regen-database-types.md`) |

## Secret rotation

If keys were previously committed in git history, rotate them in Supabase/Safepay dashboards and update only `.env.local` / hosting secrets.
