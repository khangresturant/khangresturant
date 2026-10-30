# Phase 2 — Atomic Money RPCs

## Apply SQL (required for atomic mode)

1. Open Supabase SQL editor (or `psql` with `DATABASE_URL`).
2. Run:

```text
supabase/migrations/20260711_phase2_money_rpcs.sql
```

3. Confirm functions exist:

```sql
SELECT proname FROM pg_proc
WHERE proname IN (
  'pos_checkout','void_invoice','restore_invoice',
  'apply_party_payment','receive_purchase'
);
```

## Feature flag

| Env | Effect |
|---|---|
| `NEXT_PUBLIC_USE_MONEY_RPCS` unset or `true` | Prefer RPCs |
| `NEXT_PUBLIC_USE_MONEY_RPCS=false` | Always use legacy multi-step client writes |

If the RPC is missing, the UI **falls back** to the legacy path and logs a warning.

## Client modules

| File | Role |
|---|---|
| `src/lib/money/types.ts` | Payload types |
| `src/lib/money/rpc.ts` | Supabase `.rpc()` wrappers |
| `src/lib/money/buildPosPayload.ts` | POS cart → `pos_checkout` payload |

## Wired UI

| Screen | RPC |
|---|---|
| POS checkout | `pos_checkout` |
| Sales void / restore | `void_invoice` / `restore_invoice` |
| Khata receive/pay | `apply_party_payment` |
| Purchase save | `receive_purchase` |

## Idempotency

- `pos_checkout`: pass stable `invoice_id` (client UUID). Re-call returns existing row.
- `receive_purchase`: pass stable `purchase_order_id`.

## Audit

Money RPCs write to `audit_logs` with `via` field in details.

## Known limits (follow-ups)

- Restaurant settle still uses multi-step client writes (`restaurant-orders.ts`) — Phase 8 / later.
- Purchase batch/IMEI inserts after RPC remain client-side for pharmacy/electronics edge cases.
- Full weighted-average cost (WAC) simplified in `receive_purchase` vs legacy JS WAC.
- Journal auto-post from sales (GL-01 full) not yet trigger-driven from every invoice.

## Smoke test checklist

1. Apply SQL on staging.
2. Cash sale → stock −1, cash account +, invoice present.
3. Credit sale → party balance +, credit_tx row.
4. Void invoice → stock restored, unpaid credit reversed.
5. Khata receive → party balance and cash account consistent.
6. Purchase → stock +, cash − or supplier credit +.
7. Retry same `invoice_id` → no double stock (idempotent).
