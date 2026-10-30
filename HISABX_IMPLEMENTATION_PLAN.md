# HisabX — Master Implementation Plan (All Improvements)

| Field | Value |
|---|---|
| **Document** | Master Implementation Plan |
| **Version** | 1.0 |
| **Date** | 2026-07-11 |
| **Source backlog** | `HISABX_DETAILED_FEATURE_REPORT.md` v3.0 |
| **Architecture ref** | `HISABX_ENTERPRISE_SPECIFICATION_MANUAL.md` v2.1 |
| **Goal** | Implement **all** P0 → P1 → P2 improvements in a safe, dependency-ordered sequence |
| **Assumed capacity** | 1 full-stack engineer (scale with parallel tracks where noted) |

---

## 1. Plan principles

| Principle | Rule |
|---|---|
| **Money first** | Atomic money/stock mutations before UX polish |
| **Security before scale** | RLS, API auth, secrets before multi-node deploy |
| **Small mergeable PRs** | Each PR ≤ ~3–5 days when possible; independently testable |
| **Feature flags** | Risky behavior behind shop/plan flags when needed |
| **No big-bang rewrite** | Extract services around POS; don’t freeze product for months |
| **Definition of Done** | Code + migration + tests for money paths + types update when schema changes |
| **Verticals after core** | Pharmacy/restaurant/etc. P0s after core checkout RPC exists |

### 1.1 Global effort estimate

| Priority | Approx. items | Engineer-days (sequential) | Calendar (1 eng) | Calendar (2 eng*) |
|---|---|---|---|---|
| **P0** | ~35 | 70–95 | 14–19 weeks | 8–11 weeks |
| **P1** | ~90 | 120–160 | 24–32 weeks | 14–18 weeks |
| **P2** | ~55 | 70–95 | 14–19 weeks | 8–11 weeks |
| **Total** | ~180 | **260–350 days** | **~12–16 months** | **~7–10 months** |

\*2 engineers only where workstreams don’t share the same files (see §3 tracks).

### 1.2 Recommended release strategy

| Release | Scope | Outcome |
|---|---|---|
| **R0** | Foundation | Safe repo, CI, env secrets |
| **R1** | Security | RLS + middleware + admin/API auth |
| **R2** | Money integrity | Atomic POS/void/purchase/khata/payment |
| **R3** | Offline | Real offline POS + dead-letter |
| **R4** | Platform ops | Storage, backups, deploy packaging |
| **R5** | Scale reports | SQL KPIs, report RPCs, pagination |
| **R6** | Vertical P0/P1 | Industry correctness |
| **R7** | Growth P1 | Staff, WA, loyalty, tax depth |
| **R8** | Polish P2** | Differentiators & UX |

---

## 2. Workstreams (parallel tracks)

```
Track A — Platform & Security     (middleware, RLS, admin, billing verify)
Track B — Money Engine            (RPCs: checkout, void, PO, khata, journals)
Track C — Offline & Client UX     (sync engine, POS modularization, i18n)
Track D — Data & Ops              (types, indexes, storage, backup, Docker)
Track E — Verticals               (pharmacy, restaurant, electronics, …)
Track F — Growth & Polish         (P2 features, marketing, design system)
```

**Dependency rule:** B needs A (auth context for RPCs). C needs B for offline apply. E needs B for stock/money. D can start after R0. F after core R2–R3.

---

## 3. Phase plan (detailed)

Each phase lists:

- **Goals**
- **PRs** (ordered; `depends on`)
- **Improvement IDs covered**
- **Effort**
- **Acceptance criteria**
- **Risks**

---

### PHASE 0 — Foundation & Hygiene  
**Release:** R0 · **Track:** A+D · **Effort:** 5–7 days · **Status:** ✅ Implemented (2026-07-11)

| PR | Title | IDs | Depends | Effort | Work | Status |
|---|---|---|---|---|---|---|
| **PR-0.1** | Secrets & env hygiene | G-03 | — | 1–2d | Remove hardcoded Supabase/Safepay defaults; `.env.example`; document required vars; rotate any leaked keys | ✅ |
| **PR-0.2** | CI: lint + typecheck | G-07 (partial) | — | 1d | GitHub Action / local script: `eslint`, `tsc --noEmit` on PR | ✅ |
| **PR-0.3** | Plan matrix single source | AUTHZ-04 | — | 1–2d | Document free/starter/premium; export `planMatrix.ts`; fix Sidebar vs plan JSON conflicts | ✅ |
| **PR-0.4** | Landing claim accuracy | LND-01 | — | 0.5d | Tone down offline claims until R3 ships | ✅ |
| **PR-0.5** | Types regenerate pipeline | G-05 | PR-0.1 | 1–2d | Script/docs to regenerate `database.types.ts` from live DB; first refresh | ✅ (pipeline; run `types:gen` with live credentials) |

**Acceptance criteria**

- [ ] No secrets/keys in source (grep clean)
- [ ] CI fails on type/lint errors
- [ ] Plan matrix file is the only place Sidebar + ShopContext read feature gates
- [ ] Landing does not claim full offline if not wired

**Risks:** Key rotation may break local dev — document new env setup.

---

### PHASE 1 — AuthN / AuthZ / Tenant Safety  
**Release:** R1 · **Track:** A · **Effort:** 12–16 days · **Status:** ✅ Implemented in code (2026-07-11) — apply RLS SQL on staging manually

| PR | Title | IDs | Depends | Effort | Work | Status |
|---|---|---|---|---|---|---|
| **PR-1.1** | Next.js auth proxy | AUTH-01, ADM-01 | R0 | 2–3d | `src/proxy.ts` protects `/dashboard/*`, `/admin/*` | ✅ |
| **PR-1.2** | `resolveAccess` helper | AUTHZ-02 | PR-0.3 | 2d | `src/lib/auth/resolveAccess.ts` + ShopContext | ✅ |
| **PR-1.3** | Superadmin via role only | AUTH-03 | PR-1.1 | 1d | `roles.ts`; optional `SUPERADMIN_EMAILS` | ✅ |
| **PR-1.4** | API route auth | G-04, FIL-01 | PR-1.1 | 2–3d | pay/init, upload, migrate guarded | ✅ |
| **PR-1.5** | Payment amount verify | BILL-01 | PR-1.4 | 1–2d | Server plan price + optional callback HMAC | ✅ |
| **PR-1.6** | RLS core policies | G-01, AUTHZ-01 | PR-1.1 | 4–5d | `supabase/migrations/20260711_phase1_rls_core.sql` | ✅ SQL ready (apply manually) |
| **PR-1.7** | Password policy + rate limit | AUTH-02 | PR-1.1 | 1–2d | UI policy; Supabase dashboard min length still required | ✅ partial |

**Acceptance criteria**

- [ ] Unauthenticated user cannot open dashboard HTML
- [ ] Non-superadmin gets 403 on `/admin`
- [ ] Cross-shop select blocked under RLS (integration test)
- [ ] `/api/upload-receipt` without auth → 401
- [ ] Pay init uses server-side plan price

**Risks:** RLS can break legitimate multi-shop queries — test shop switch thoroughly. Service role only on server.

---

### PHASE 2 — Money Engine (Atomic RPCs)  
**Release:** R2 · **Track:** B · **Effort:** 20–28 days · **Status:** ✅ Implemented in code (2026-07-11) — apply SQL on DB

| PR | Title | IDs | Depends | Effort | Work | Status |
|---|---|---|---|---|---|---|
| **PR-2.1** | RPC: `pos_checkout` | POS-01, G-06 | R1 | 5–7d | Atomic checkout SQL | ✅ |
| **PR-2.2** | POS client → RPC | POS-01 | PR-2.1 | 3–4d | POS wired + legacy fallback | ✅ |
| **PR-2.3** | RPC: `void_invoice` | SALE-01, AUTHZ-03 | PR-2.1 | 3–4d | void + restore RPCs + Sales UI | ✅ |
| **PR-2.4** | RPC: `apply_party_payment` | KHA-01 | PR-2.1 | 2–3d | Khata wired | ✅ |
| **PR-2.5** | RPC: `receive_purchase` | PUR-01 | PR-2.1 | 3–4d | Purchase wired (simple stock) | ✅ |
| **PR-2.6** | Return link + over-return guard | RET-01 | PR-2.3 | 2–3d | `original_invoice_id` + `assert_return_qty` | ✅ SQL helper |
| **PR-2.7** | Journal balance constraint | ACC-02 | R1 | 1–2d | Deferred constraint trigger | ✅ SQL |
| **PR-2.8** | Account balance integrity | ACC-01 | PR-2.1, 2.4 | 2–3d | Dual-write inside RPCs | ✅ partial |
| **PR-2.9** | Auto-post journals (industrial) | GL-01 | PR-2.1, 2.7 | 3–4d | Deferred to Phase 7 depth | ⏳ partial |
| **PR-2.10** | Audit on money mutations | BAK-04 | PR-2.1–2.5 | 1–2d | audit_logs inside RPCs | ✅ |

**Acceptance criteria**

- [ ] Kill DB mid-checkout cannot leave invoice without stock update (txn)
- [ ] Void restores stock and cash/credit exactly
- [ ] Retry same invoice UUID does not double stock
- [ ] Unbalanced journal rejected
- [ ] Unit + integration tests for tax, discount, packing, checkout, void

**Risks:** Largest phase; ship behind flag `use_pos_checkout_rpc` for 1 week dual-run if needed.

---

### PHASE 3 — Offline Productionization  
**Release:** R3 · **Track:** C · **Effort:** 12–18 days · **Status:** ✅ Implemented (2026-07-11)

| PR | Title | IDs | Depends | Effort | Work | Status |
|---|---|---|---|---|---|---|
| **PR-3.1** | RPC: `apply_offline_invoice` | OFF-02, G-02 | PR-2.1 | 3–4d | Wrapper SQL + `/api/sync` | ✅ |
| **PR-3.2** | Wire POS queue on offline/error | OFF-01, POS-02 | PR-3.1 | 3–4d | POS queues checkout offline/network fail | ✅ |
| **PR-3.3** | Shop-scoped queue isolation | OFF-03, SHOP-02 | PR-3.2 | 1–2d | shopId on events + API skip | ✅ |
| **PR-3.4** | Dead-letter UI | OFF-04, BAK-03 | PR-3.2 | 2d | Retry / discard / export JSON | ✅ |
| **PR-3.5** | IndexedDB queue | OFF-05 | PR-3.2 | 2–3d | IDB v3 shop indexes + multi-tab lock | ✅ |
| **PR-3.6** | Catalog snapshot cache | OFF-06 | PR-3.2 | 2–3d | save/load on POS fetchData | ✅ |
| **PR-3.7** | Restaurant offline policy | RST-05 | PR-3.2 | 1d | KOT + settle blocked offline | ✅ |
| **PR-3.8** | Offline checklist smoke | TST-04 | PR-3.2–3.4 | 2d | `npm run test:offline` + docs checklist | ✅ |

**Acceptance criteria**

- [ ] Offline cash sale appears in queue; syncs once online
- [ ] Double sync no double stock
- [ ] Cross-shop queue isolation proven
- [ ] Dead-letter visible for poison messages
- [ ] Landing may re-enable honest “offline POS” claim after this phase

**Risks:** Stock conflicts multi-device — document LWW + reject policy.

---

### PHASE 4 — Storage, Backup & Deploy  
**Release:** R4 · **Track:** D · **Effort:** 12–16 days

| PR | Title | IDs | Depends | Effort | Work |
|---|---|---|---|---|---|
| **PR-4.1** | Object storage receipts | FIL-02, FIL-03, FIL-04, PROD-04, SET-02 | R1 | 3–5d | Supabase Storage / S3; signed URLs; MIME/size; migrate upload route |
| **PR-4.2** | Image compression optional | FIL-05 | PR-4.1 | 1–2d | Client or server resize |
| **PR-4.3** | DB backup automation | BAK-01 | R0 | 2–3d | `pg_dump` cron + retention; restore runbook markdown |
| **PR-4.4** | Restore safety | BAK-02 | PR-4.3 | 1d | Staging default; prod confirm UI/admin |
| **PR-4.5** | Docker Compose VPS pack | DEP-01, DEP-02, DEP-03 | PR-4.1, 4.3 | 3–4d | app + postgres + proxy + pgbouncer notes; healthchecks |
| **PR-4.6** | Expense/support attachments | EXP-02, SUP-01 | PR-4.1 | 2d | Reuse storage helpers |
| **PR-4.7** | AI server proxy | AI-01, SET-03 | R1 | 2–3d | `/api/ai/*` with server keys; remove client key dependency long-term |

**Acceptance criteria**

- [ ] App works with zero local `public/receipts` writes in multi-instance sim
- [ ] Fresh VPS bootstrap ≤ 1 hour using docs
- [ ] Daily dump exists and restore drill documented
- [ ] AI calls don’t require browser-held master keys

---

### PHASE 5 — Performance, Reports & Lists  
**Release:** R5 · **Track:** B+D · **Effort:** 12–16 days

| PR | Title | IDs | Depends | Effort | Work |
|---|---|---|---|---|---|
| **PR-5.1** | Core indexes migration | PERF-01 | R1 | 1–2d | `(shop_id, created_at)`, barcodes unique, IMEI unique (prep ELE-01) |
| **PR-5.2** | Dashboard KPI RPCs | DASH-01, G-08 (dash) | PR-5.1 | 2–3d | Replace load-all-invoices aggregation |
| **PR-5.3** | Sales pagination/search | SALE-02 | PR-5.1 | 2d | Server range + filters |
| **PR-5.4** | Report RPCs + rollups | REP-01 | PR-5.1 | 4–5d | sales/P&L/inventory/aging server-side |
| **PR-5.5** | Background large export | REP-02, SALE-03 | PR-5.4 | 2–3d | Job or chunked download CSV |
| **PR-5.6** | Report presets | REP-03 | PR-5.4 | 1d | Save date+tab per shop |
| **PR-5.7** | List virtualization | PERF-03 | PR-5.3 | 1–2d | Long tables in sales/products |
| **PR-5.8** | Industry dashboard widgets | DASH-02 | PR-5.2 | 2d | Restaurant open tables; fuel tanks; pharmacy expiry |

**Acceptance criteria**

- [ ] Dashboard first load with 100k invoices still usable (no full table transfer)
- [ ] p95 invoice save &lt; 800ms on staging (with indexes + RPC)
- [ ] Sales list paginated

---

### PHASE 6 — POS Modularization & Core UX P1  
**Release:** R5–R6 · **Track:** C · **Effort:** 14–18 days

| PR | Title | IDs | Depends | Effort | Work |
|---|---|---|---|---|---|
| **PR-6.1** | Extract checkout service | POS-03 | PR-2.2 | 3–4d | `services/posCheckout.ts`; thin page |
| **PR-6.2** | Cart store | POS-03 | PR-6.1 | 2–3d | Context or zustand; hold cart |
| **PR-6.3** | Split payments | POS-05 | PR-2.1 | 2–3d | Multi account_tx lines |
| **PR-6.4** | Keyboard mode help | POS-04 | PR-6.1 | 1d | In-app shortcuts panel always |
| **PR-6.5** | Synced held carts | POS-06 | PR-6.2 | 2d | DB table `held_carts` |
| **PR-6.6** | Soft shop switch | SHOP-01 | R1 | 2d | Refresh ShopContext without full reload |
| **PR-6.7** | Unified product editor | PROD-01, VAR-01 | — | 3–4d | Collapse general/* / karyana/* duplicates into shared modules |
| **PR-6.8** | Stock movement ledger | PROD-02 | PR-2.1 | 2–3d | Query stock adjustments / derived movements |
| **PR-6.9** | Bulk price update | PROD-03 | PR-6.7 | 1–2d | Category % update |
| **PR-6.10** | Unit conversion graph | UNIT-01 | — | 2d | First-class pack conversions |
| **PR-6.11** | Barcode gen + label PDF | VAR-02, VAR-03 | — | 2d | EAN range + jspdf labels |
| **PR-6.12** | Gift card server rules | GC-01, GC-02 | PR-2.1 | 2d | Expiry, PIN, partial redeem RPC |
| **PR-6.13** | i18n key audit + RTL QA | I18N-01, I18N-02 | — | 2–3d | Replace hardcoded EN; RTL pass |
| **PR-6.14** | Scanner multi-scan | SCAN-01 | — | 1d | Stock take mode |
| **PR-6.15** | Scale parsers + auto cart | SCL-01, SCL-02, KAR-01 | — | 2–3d | PK scale profiles |

**Acceptance criteria**

- [ ] `pos/page.tsx` substantially thinner or façade only
- [ ] Split payment stores multiple tender lines
- [ ] Shared product/variation modules used by ≥2 industries
- [ ] Urdu RTL no major layout break on POS/settings

---

### PHASE 7 — Accounting Depth & Closing  
**Release:** R6 · **Track:** B · **Effort:** 10–14 days

| PR | Title | IDs | Depends | Effort | Work |
|---|---|---|---|---|---|
| **PR-7.1** | Period close wizard | GL-02, GL-03 | PR-2.9 | 3–4d | Trial balance → lock → opening; DB prevent edit closed |
| **PR-7.2** | Bank rec CSV match | ACC-03 | PR-2.8 | 3–4d | Import + match UI complete |
| **PR-7.3** | Register variance reason | ACC-04 | PR-2.1 | 1–2d | Forced reason on close; report |
| **PR-7.4** | Khata opening + aging UI | KHA-02, KHA-04 | PR-2.4 | 2d | Wizard + party aging buckets |
| **PR-7.5** | Returns refund modes | RET-02, RET-03 | PR-2.6 | 2d | Cash vs credit note; reason codes |
| **PR-7.6** | Sale edit re-post | SALE-04 | PR-2.3 | 3d | Edit with audit + reverse/repost |
| **PR-7.7** | Expense categories/budgets/recurring | EXP-01, EXP-03 | — | 2–3d | Masters + schedule |
| **PR-7.8** | Tax multi-rate | TAX-01, TAX-02 | PR-2.1 | 2–3d | Tax groups + number series |

**Acceptance criteria**

- [ ] Closed book cannot accept POS sale
- [ ] Bank lines can match cash ledger
- [ ] Aging matches open invoices within rounding

---

### PHASE 8 — Vertical Correctness (P0 + high P1)  
**Release:** R6 · **Track:** E · **Effort:** 18–25 days

| PR | Title | IDs | Depends | Effort | Work |
|---|---|---|---|---|---|
| **PR-8.1** | Pharmacy FEFO | PHR-01 | PR-2.1 | 2–3d | Force earliest batch on sale |
| **PR-8.2** | Controlled register report | PHR-02 | PR-8.1 | 1–2d | Legal report export |
| **PR-8.3** | Rx image + master drug | PHR-03, PHR-04 | PR-4.1 | 2–3d | Attach Rx; registry sync improvements |
| **PR-8.4** | Unique IMEI + double-sale block | ELE-01 | PR-5.1 | 1–2d | Unique index + checkout check |
| **PR-8.5** | EMI overdue board | ELE-02 | — | 2d | Collections dashboard |
| **PR-8.6** | Repair SLA + parts stock | ELE-03 | PR-2.1 | 2d | Statuses + consume parts |
| **PR-8.7** | Warranty claim link | ELE-04 | PR-2.3 | 1–2d | Link to original invoice |
| **PR-8.8** | Fertilizer batch stock enforce | FER-01 | PR-2.1 | 1–2d | Negative batch blocked |
| **PR-8.9** | Seasonal close/transfer | FER-02 | PR-8.8 | 2d | Season tools |
| **PR-8.10** | Restaurant recipe atomic settle | RST-01 | PR-2.1 | 2–3d | BOM deduct in settle txn |
| **PR-8.11** | Split/merge bills + KOT void | RST-03, RST-04 | PR-8.10 | 3d | Table ops polish |
| **PR-8.12** | Floor plan editor | RST-02 | — | 2–3d | Drag tables |
| **PR-8.13** | Fuel recon report | FUL-01 | — | 2d | Tank vs meter |
| **PR-8.14** | Pump/shift assignment | FUL-02 | PR-8.13 | 1–2d | Nozzle mapping |
| **PR-8.15** | Tailor order pipeline | TAI-01 | — | 2d | Status machine |
| **PR-8.16** | Tailor fabric consume + WA due | TAI-02, TAI-03 | PR-2.1 | 2–3d | Stock + messaging |
| **PR-8.17** | Showroom unique + rental PDF | SHW-01, SHW-02, SHW-03 | — | 3d | Chassis unique; contract; cost sheet |
| **PR-8.18** | Hardware cut-list + wastage | HDW-01, HDW-02 | — | 2d | Print + analytics |
| **PR-8.19** | Garments size matrix + seasons | GAR-01, GAR-02 | PR-6.7 | 2d | Matrix editor |
| **PR-8.20** | Crockery set builder | CRK-01 | PR-6.7 | 2d | BOM-like packages |
| **PR-8.21** | Grocery optional expiry | KAR-02 | PR-8.1 patterns | 1d | Soft expiry flags |

**Acceptance criteria**

- [ ] Each vertical golden-path E2E green (sell/core flow)
- [ ] FEFO, IMEI unique, recipe stock, batch stock: automated tests
- [ ] Fuel recon report matches sample data

---

### PHASE 9 — SaaS, Staff, Support, Growth P1  
**Release:** R7 · **Track:** A+F · **Effort:** 16–22 days

| PR | Title | IDs | Depends | Effort | Work |
|---|---|---|---|---|---|
| **PR-9.1** | Device registry | G-09, BILL-03, AUTH-05 (partial) | R1 | 3–4d | `devices` table; max_devices enforce; list sessions |
| **PR-9.2** | Subscription payment history | BILL-02 | PR-1.5 | 1–2d | Owner billing invoices UI |
| **PR-9.3** | Grace period | BILL-04 | PR-0.3 | 1d | 3-day soft degrade |
| **PR-9.4** | platform_settings table | ADM-03 | R1 | 2d | Migrate off JSON-in-website |
| **PR-9.5** | Admin metrics + impersonate | ADM-02, ADM-04 | PR-1.1 | 3d | MRR/churn; read-only impersonate |
| **PR-9.6** | AI quota meter | AI-02, AI-03 | PR-4.7 | 2d | Monthly limits + HITL UI |
| **PR-9.7** | Payroll generate + PDF + post | PAY-01, PAY-02, STF-03 | PR-2.4 | 3–4d | Slips → cash/expense |
| **PR-9.8** | Attendance + commission | STF-01, STF-02 | — | 3d | Clock-in; salesman rules |
| **PR-9.9** | Support SLA workflow | SUP-02 | — | 1–2d | Statuses + timers |
| **PR-9.10** | Depreciation + bank polish | AST-01, AST-02 | PR-7.2 | 3d | Monthly run; CSV match rules |
| **PR-9.11** | Loyalty earn/burn | GEN-01 | PR-2.1 | 2–3d | Points on sale/redeem |
| **PR-9.12** | WhatsApp statement + API path | KHA-03, WA-01, WA-02 | PR-4.7 | 3–4d | Templates + opt-in |
| **PR-9.13** | Public receipt signed links | PRC-01 | R1 | 1d | Expiring tokens |
| **PR-9.14** | Notifications center | NTF-01 | — | 2–3d | Low stock, EMI due, support |
| **PR-9.15** | Thermal profiles | SET-01 | — | 1–2d | 58/80mm presets |
| **PR-9.16** | Settings print polish | SET-03 done in 4.7 | — | — | — |
| **PR-9.17** | Purchase partial GRN + AI confidence | PUR-02, PUR-04 | PR-2.5 | 3d | Multi-receive; confirm UI |
| **PR-9.18** | Three-way match light | PUR-03 | PR-9.17 | 2–3d | PO↔bill↔pay status |
| **PR-9.19** | Fertilizer subsidy lists | FER-03 | — | 1–2d | Scheme prices |
| **PR-9.20** | Fuel density optional | FUL-03 | PR-8.13 | 1–2d | Correction factor |

**Acceptance criteria**

- [ ] Device over limit blocks new login
- [ ] Payroll posts cash once
- [ ] Loyalty points consistent after void
- [ ] Admin MRR dashboard matches shop subscriptions sample

---

### PHASE 10 — Testing Hardening (continuous but formalize)  
**Release:** R2 onward · **Track:** all · **Effort:** 10–14 days total (spread)

| PR | Title | IDs | Depends | Effort | Work |
|---|---|---|---|---|---|
| **PR-T.1** | Unit test suite scaffold | TST-01, G-07 | R0 | 2d | Vitest; tax/discount/packing/EMI math |
| **PR-T.2** | Integration RPC tests | TST-02 | PR-2.1 | 3d | Checkout/void/stock against test DB |
| **PR-T.3** | Playwright smoke E2E | TST-03 | R2 | 3d | Login → sell → khata → void |
| **PR-T.4** | Vertical smokes | Phase 8 | PR-T.3 | 3d | One path per industry |
| **PR-T.5** | Load smoke | TST-05 | R5 | 2d | k6 optional 20 concurrent |

**Wire into CI gradually:** unit (R0) → integration (R2) → E2E smoke (R3).

---

### PHASE 11 — All P2 Features (Growth & Polish)  
**Release:** R8 · **Track:** F · **Effort:** 70–95 days (can parallelize heavily)

Group P2 into epics; order by product value.

#### Epic P2-A — POS & Commerce polish (~12d)

| PR | IDs | Work |
|---|---|---|
| PR-11.1 | POS-07 | Customer display secondary screen |
| PR-11.2 | POS-08 | Scale auto-add weight items |
| PR-11.3 | POS-09 | Compact density theme |
| PR-11.4 | SALE-05, SALE-06 | Public QR share; duplicate to cart |
| PR-11.5 | RET-04 | Exchange wizard |
| PR-11.6 | GC-03 | Digital gift card send |
| PR-11.7 | PROD-05, PROD-06 | Multi-warehouse transfer; archive |
| PR-11.8 | VAR-04 | GS1/scale barcodes |
| PR-11.9 | UNIT-02 | Industry unit presets |
| PR-11.10 | PUR-05, PUR-06 | Supplier price history; recurring PO |

#### Epic P2-B — Finance & reports (~10d)

| PR | IDs | Work |
|---|---|---|
| PR-11.11 | ACC-05, ACC-06 | Multi-currency; CoA templates |
| PR-11.12 | EXP-04 | Expense approval workflow |
| PR-11.13 | REP-04, REP-05, REP-06 | Excel; scheduled email; P&L graphs |
| PR-11.14 | GL-04 | Comparative BS across books |
| PR-11.15 | TAX-03 | Jurisdiction export formats |
| PR-11.16 | PAY-03 | Loan/advance recovery |
| PR-11.17 | AST-03 | Asset disposal |

#### Epic P2-C — People & messaging (~10d)

| PR | IDs | Work |
|---|---|---|
| PR-11.18 | AUTHZ-05, STF-04, STF-05 | Permission templates; clone staff; PIN login |
| PR-11.19 | AUTH-04 | OTP/WhatsApp login |
| PR-11.20 | KHA-05, KHA-06 | Overdue auto reminders; party merge |
| PR-11.21 | WA-03 | Broadcast segments |
| PR-11.22 | NTF-02, NTF-03 | PWA push; email digest |
| PR-11.23 | SUP-03, SUP-04 | Canned replies; help center |
| PR-11.24 | BAK-05 | Nightly Drive backup |

#### Epic P2-D — Vertical differentiators (~20d)

| PR | IDs | Work |
|---|---|---|
| PR-11.25 | GEN-02 | Promotions BOGO/happy hour |
| PR-11.26 | KAR-03 | Van/wholesale routes |
| PR-11.27 | PHR-05 | Recall freeze batch |
| PR-11.28 | ELE-05, ELE-06 | IMEI CSV; EMI SMS |
| PR-11.29 | CRK-02 | Gallery mode |
| PR-11.30 | HDW-03 | Formula library |
| PR-11.31 | GAR-03 | Fitting room hold timer |
| PR-11.32 | TAI-04, TAI-05 | Measurement templates; design photos |
| PR-11.33 | FUL-04, FUL-05 | Attendant commission; DSR PDF |
| PR-11.34 | SHW-04, SHW-05 | Service reminders; test drive log |
| PR-11.35 | FER-04, FER-05 | Acreage helper; dealer targets |
| PR-11.36 | RST-06, RST-07, RST-08 | QR order; delivery; tip pool |
| PR-11.37 | OFF-07, OFF-08 | Multi-device conflict UI; policies |

#### Epic P2-E — Platform polish (~12d)

| PR | IDs | Work |
|---|---|---|
| PR-11.38 | G-10 | Design system tokens cleanup |
| PR-11.39 | SHOP-03, SHOP-04 | Branches; timezone |
| PR-11.40 | ADM-05 | Per-shop remote feature flags |
| PR-11.41 | BILL-05, BILL-06 | Auto-renew reminders; promo codes |
| PR-11.42 | SET-04, SET-05 | Multi-printer routing; QR pay preview |
| PR-11.43 | AI-04, AI-05 | Sales insights; voice cart experimental |
| PR-11.44 | LND-02, LND-03 | Live pricing page; SEO vertical pages |
| PR-11.45 | I18N-03, I18N-04 | More languages; AI product translate |
| PR-11.46 | SCAN-02, SCAN-03 | Scanner docs; torch/zoom |
| PR-11.47 | SCL-03 | Scale tare/calibration |
| PR-11.48 | PRC-02, PRC-03 | Pay remaining link; multi-lang public receipt |
| PR-11.49 | PERF-04 | CDN for marketing static |
| PR-11.50 | DEP-04, DEP-05 | Blue/green; read replicas |
| PR-11.51 | SEC-04, SEC-05 | Admin 2FA; security.txt |
| PR-11.52 | DASH-03, DASH-04 | Sparklines; dashboard PDF |

**P2 acceptance:** each epic ships with its own PR checklist; no P2 blocks P0/P1 releases.

---

## 4. Dependency DAG (critical path)

```
PR-0.* ──► PR-1.* (Auth/RLS) ──► PR-2.* (Money RPCs) ──┬──► PR-3.* (Offline)
                     │                                  ├──► PR-7.* (GL depth)
                     │                                  ├──► PR-8.* (Verticals)
                     │                                  └──► PR-9.* (SaaS/staff)
                     │
                     ├──► PR-4.* (Storage/Deploy) ──► media-dependent features
                     │
                     └──► PR-5.* (Perf/Reports) ──► scale

PR-T.* tests attach after each related phase
PR-6.* modularization after PR-2.2 (can parallel PR-5)
PR-11.* P2 after R2 minimum; preferred after R6
```

**Critical path length (1 eng):**  
R0 (1w) → R1 (3w) → R2 (5w) → R3 (3w) → R4 (3w) → R5–6 (6w) → R7 (4w) → R8 P2 (partial ongoing)  
≈ **25–30 weeks to production-grade core + verticals**; P2 continues after.

---

## 5. Full ID coverage matrix

Every improvement ID maps to at least one PR above.

| ID range | Phase / PR group |
|---|---|
| G-01…G-10 | P0–1, P1–5, P9, P11 |
| AUTH-*, AUTHZ-* | Phase 1, 9, 11 |
| SHOP-* | Phase 3, 6, 11 |
| BILL-* | Phase 1, 9, 11 |
| ADM-* | Phase 1, 9, 11 |
| DASH-* | Phase 5, 11 |
| POS-* | Phase 2, 3, 6, 11 |
| SALE-* | Phase 2, 5, 7, 11 |
| PUR-* | Phase 2, 9, 11 |
| RET-* | Phase 2, 7, 11 |
| PROD-*, VAR-*, UNIT-*, GC-* | Phase 4, 6, 11 |
| KHA-* | Phase 2, 7, 9, 11 |
| ACC-*, EXP-*, REP-*, GL-* | Phase 2, 5, 7, 11 |
| SET-*, STF-*, SUP-*, BAK-* | Phase 4, 7, 9, 11 |
| OFF-* | Phase 3, 11 |
| FIL-*, SCAN-*, SCL-* | Phase 4, 6, 11 |
| I18N-*, LND-* | Phase 0, 6, 11 |
| Vertical * | Phase 8, 9, 11 |
| TAX-*, PAY-*, AST-*, AI-* | Phase 4, 7, 9, 11 |
| WA-*, NTF-*, PRC-*, PERF-*, SEC-*, DEP-*, TST-* | Phases 1–5, 9–11 |

---

## 6. Team model (recommended)

| Role | Focus | Phases |
|---|---|---|
| **Eng A (backend)** | RLS, RPCs, reports SQL, backup | 1, 2, 5, 7 |
| **Eng B (frontend)** | POS modularization, offline UX, verticals UI | 3, 6, 8 |
| **Eng C (optional)** | Deploy, storage, admin, AI proxy | 0, 4, 9 |
| **QA (part-time)** | E2E + offline checklist | T series |

If **solo engineer:** follow critical path strictly; defer Phase 11 until after Phase 8 P0s.

---

## 7. Risk register

| Risk | Impact | Mitigation |
|---|---|---|
| RLS breaks production queries | High | Staging first; feature flag; superuser break-glass |
| Checkout RPC edge cases (EMI, gift, IMEI) | High | Incremental feature parity tests; dual-run flag |
| Offline multi-device stock | High | Reject on insufficient stock; dead-letter |
| Scope creep from P2 | Medium | P2 never blocks R2/R3 ship |
| Types drift | Medium | PR-0.5 + regenerate on every schema PR |
| Single huge POS file conflicts | Medium | PR-6 early extract after RPC |

---

## 8. Definition of Done (every PR)

| Gate | Required |
|---|---|
| Builds | `npm run build` or CI equivalent |
| Types | No new `any` without reason; schema types updated if SQL changed |
| Money change? | Integration test mandatory |
| Migrations | Forward-only SQL; documented rollback note |
| Security | No new client service-role usage |
| Docs | Update feature report status row if closing an ID |
| Review | Human or `/review` before merge |

---

## 9. Tracking method

| Artifact | Purpose |
|---|---|
| This file | Master plan |
| GitHub Projects / Linear | One issue per PR row |
| Labels | `P0` `P1` `P2` `track-A`…`track-F` `phase-N` |
| Milestone | R0…R8 |
| Close ID | Move ID to “Done” in feature report when merged |

**Suggested issue title format:**  
`[P0][PR-2.1] pos_checkout atomic RPC (POS-01, G-06)`

---

## 10. Immediate next actions (start this week)

| Day | Action |
|---|---|
| 1 | Create GitHub milestones R0–R8; import Phase 0–2 PR issues |
| 1–2 | Execute **PR-0.1 → PR-0.5** (foundation) |
| 3–5 | Start **PR-1.1 middleware** + **PR-T.1** unit scaffold |
| Week 2 | RLS spike on 5 core tables; design `pos_checkout` payload JSON schema |
| Week 3–4 | Finish Phase 1; begin Phase 2 RPC |

---

## 11. Success metrics (program level)

| Metric | Target after R3 | Target after R6 |
|---|---|---|
| Cross-shop data leak tests | 0 failures | 0 failures |
| Checkout partial-write incidents | 0 | 0 |
| Offline sales sync success rate | ≥ 99% | ≥ 99.5% |
| p95 online checkout | &lt; 1s | &lt; 800ms |
| Automated tests on money paths | ≥ 20 | ≥ 50 |
| P0 improvement IDs closed | 100% of P0 | 100% P0 + ≥70% P1 |
| Vertical golden paths green | Core only | All 12 industries |

---

## 12. Open decisions (resolve before/during Phase 1–2)

| # | Decision | Options | Recommendation |
|---|---|---|---|
| 1 | Offline restaurant KOT | Block vs queue | **Block** KOT offline; settle online-only |
| 2 | Starter plan EMI | Allow vs block | Align matrix; **block on free only** if product wants Starter EMI |
| 3 | Account balance model | Derived vs stored dual-write | **Stored + reconcile job** short-term; derived long-term |
| 4 | Object storage | Supabase Storage vs S3 | **Supabase Storage** if already on Supabase |
| 5 | Checkout dual-run | Hard cutover vs 2-week flag | **Flag** for 1–2 weeks |

---

## 13. Document control

| Version | Date | Notes |
|---|---|---|
| 1.0 | 2026-07-11 | Full plan covering all improvement IDs from Feature Report v3.0 |

---

### Quick start command for engineers

```text
1. Read HISABX_DETAILED_FEATURE_REPORT.md (what & why)
2. Read HISABX_IMPLEMENTATION_PLAN.md (this file — how & when)
3. Pick next open PR on critical path (start at PR-0.1)
4. Open PR with ID list in description
5. Close IDs in tracker when merged
```

*End of Master Implementation Plan v1.0*
