# Phase 3 — Offline Productionization

## Apply SQL

1. Phase 2 money RPCs (required): `20260711_phase2_money_rpcs.sql`
2. Phase 3 wrapper: `20260711_phase3_apply_offline_invoice.sql`

## Architecture

```
POS (offline / network error)
  → IndexedDB sync_queue (shop-scoped)
  → useSyncEngine flush (multi-tab lock)
  → POST /api/sync
  → apply_offline_invoice / pos_checkout (idempotent UUID)
```

## Key modules

| File | Role |
|---|---|
| `src/utils/syncQueue.ts` | IndexedDB queue + catalog cache + export |
| `src/lib/sync/offlineCheckout.ts` | Queue helpers + network detection |
| `src/hooks/useSyncEngine.ts` | Auto-flush for active shop only |
| `src/components/sync/OfflineStatusBar.tsx` | Pending / dead counts |
| `src/components/sync/DeadLetterDrawer.tsx` | Retry / discard / export |
| `src/app/api/sync/route.ts` | Server apply + shop isolation |

## Policies

| Surface | Offline behavior |
|---|---|
| Retail POS cash/credit/EMI | **Queue** checkout payload |
| POS invoice **edit** | **Blocked** offline |
| Restaurant KOT / settle | **Blocked** (online-only) |
| Cross-shop queue flush | **Skipped** (dead-letter if forced) |

## Offline checklist (manual / smoke)

| # | Test | Pass |
|---|---|---|
| 1 | Disable network → cash sale | Queued; toast "saved offline" |
| 2 | Re-enable network | Auto-sync; invoice in Sales |
| 3 | Sync twice same invoice UUID | No double stock |
| 4 | Offline credit sale | Party balance once after sync |
| 5 | Offline then switch shop | Other shop does not flush first shop queue |
| 6 | Poison event 5 failures | Appears in dead-letter drawer |
| 7 | Export dead-letter JSON | File downloads |
| 8 | Discard dead event | Removed from drawer |
| 9 | Restaurant POS offline KOT | Explicit block toast |
| 10 | Offline catalog after online load | Products still searchable offline |

## Scripts

```bash
npm run test:offline
```

## Feature notes

- Catalog is snapshotted after successful online POS `fetchData`.
- Multi-tab: only one tab holds `hisabx_sync_flush_lock` during flush.
- Device id stored in `localStorage` as `hx_device_id`.
