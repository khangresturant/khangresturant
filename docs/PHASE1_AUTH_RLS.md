# Phase 1 — Auth, Access, RLS

## What shipped

| Piece | Location |
|---|---|
| Next.js 16 Proxy (auth gate) | `src/proxy.ts` |
| Server Supabase clients | `src/lib/supabase/server.ts` |
| Superadmin by role | `src/lib/auth/roles.ts` |
| `resolveAccess` | `src/lib/auth/resolveAccess.ts` |
| API auth helpers | `src/lib/auth/apiAuth.ts` |
| Password policy | `src/lib/auth/passwordPolicy.ts` |
| RLS migration | `supabase/migrations/20260711_phase1_rls_core.sql` |

## Proxy behavior

| Path | Rule |
|---|---|
| `/dashboard/*` | Must be logged in → else `/login?next=…` |
| `/admin/*` | Must be logged in + `user_profiles.role = superadmin` (or `SUPERADMIN_EMAILS`) |
| `/login`, `/register` | If already logged in → `/dashboard` |

## Making a superadmin

```sql
UPDATE user_profiles
SET role = 'superadmin'
WHERE id = '<auth-user-uuid>';
```

Optional bootstrap (not recommended long-term):

```env
SUPERADMIN_EMAILS=you@example.com
```

## Applying RLS (staging first)

1. Backup database.
2. Open Supabase SQL editor (or `psql` with `DATABASE_URL`).
3. Run `supabase/migrations/20260711_phase1_rls_core.sql`.
4. Smoke test:
   - Login as shop owner → see only own shop data.
   - Login as other shop → cannot read first shop's invoices.
   - Superadmin can still list shops in admin.

### Rollback sketch

```sql
-- Disable RLS on a table if something breaks:
ALTER TABLE public.invoices DISABLE ROW LEVEL SECURITY;
-- Or drop policies:
-- DROP POLICY IF EXISTS hx_rls_invoices_select ON public.invoices;
```

## API auth matrix

| Route | Auth |
|---|---|
| `POST /api/pay/init` | Logged-in + shop access |
| `GET /api/pay/callback` | Signature if `PAYMENT_CALLBACK_SECRET` set |
| `POST /api/upload-receipt` | Logged-in + shop access + file limits |
| `GET /api/migrate` | Superadmin only |

## Payment callback hardening

Set:

```env
PAYMENT_CALLBACK_SECRET=your-long-random-secret
```

When set, callback requires `sig` = HMAC-SHA256 of `shop_id:tier:billing`.

## Password policy

- Min 8 characters
- Letters + at least one number
- Enforced on register UI; also set Supabase Auth min length in dashboard
