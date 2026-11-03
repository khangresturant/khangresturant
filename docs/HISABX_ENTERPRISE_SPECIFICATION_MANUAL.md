# HisabX: Enterprise Multi-Vertical POS & ERP Specification Manual

| Field | Value |
|---|---|
| **Document Title** | HisabX Enterprise Multi-Vertical POS & ERP Specification Manual |
| **Product Brand** | The Accounts (HisabX) |
| **Version** | 2.1 |
| **Status** | Living Specification |
| **Audience** | Engineering, Product, QA, DevOps, Implementation Partners |
| **Last Updated** | 2026-07-11 |
| **Primary Stack** | Next.js 16 · React 19 · TypeScript · Supabase (PostgreSQL) · Tailwind CSS 4 |
| **Deployment Target** | VPS + Managed/Self-hosted PostgreSQL (Supabase-compatible or native) |

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [System Architecture Overview](#2-system-architecture-overview)
3. [Multi-Tenancy & Shop Model](#3-multi-tenancy--shop-model)
4. [Authentication & Authorization Flow](#4-authentication--authorization-flow)
5. [Subscription & Licensing Model](#5-subscription--licensing-model)
6. [Common Database Conventions](#6-common-database-conventions)
7. [Core Domain Model](#7-core-domain-model)
8. [Vertical Modules](#8-vertical-modules)
9. [Accounting & Financial Engine](#9-accounting--financial-engine)
10. [API Design Standards & Conventions](#10-api-design-standards--conventions)
11. [File Storage Strategy](#11-file-storage-strategy)
12. [Offline Sync Architecture](#12-offline-sync-architecture)
13. [Backup & Recovery Strategy](#13-backup--recovery-strategy)
14. [Performance & Indexing Guidelines](#14-performance--indexing-guidelines)
15. [Testing Strategy](#15-testing-strategy)
16. [Deployment Architecture (VPS + PostgreSQL)](#16-deployment-architecture-vps--postgresql)
17. [Security Baseline](#17-security-baseline)
18. [Implementation Roadmap (Phased)](#18-implementation-roadmap-phased)
19. [Appendix](#19-appendix)

---

## 1. Executive Summary

HisabX (marketed as **The Accounts**) is a multi-tenant, multi-vertical Point of Sale and lightweight ERP platform designed primarily for South Asian SMEs. A single codebase serves many business types through an `industry_type` switch on each shop, while shared core modules handle sales, inventory, parties (khata), purchases, expenses, cash accounts, and reporting.

| Capability | Description |
|---|---|
| **Multi-vertical POS** | One product surface adapts UI, flows, and tables per industry |
| **Khata-first accounting** | Party balances, credit sales, aging, registers, and optional double-entry GL |
| **SaaS licensing** | Free / Starter / Premium tiers with feature gates and device limits |
| **Role-based access** | Panel-level and action-level permissions per staff user |
| **Offline POS resilience** | Local queue for critical write operations with background sync |
| **Fiscal closing books** | Period isolation for historical vs active books |
| **Super Admin console** | Plans, shops, users, gateways, support, announcements |
| **i18n** | English + Urdu (billing language and UI language configurable) |

### 1.1 Design Principles

| Principle | Rule |
|---|---|
| **Simple by default** | Free/SME shops get cash + khata without forced double-entry |
| **Powerful when enabled** | Tax, payroll, assets, bank rec, GL toggled per shop/plan |
| **Vertical isolation** | Industry modules never leak menus into unrelated shops |
| **Shop-scoped data** | Every business row carries `shop_id`; queries always filter by it |
| **Idempotent writes** | Offline and retry-safe IDs for invoices and related docs |
| **Feature gates over forks** | Prefer toggles and plan flags over separate codebases |

---

## 2. System Architecture Overview

### 2.1 High-Level Components

```
┌──────────────────────────────────────────────────────────────────────┐
│                         Client (Browser / PWA)                        │
│  Next.js App Router · ShopContext · LanguageContext · SyncEngine     │
│  POS · Purchase · Khata · Vertical Modules · Admin UI                │
└───────────────────────────────┬──────────────────────────────────────┘
                                │ HTTPS
┌───────────────────────────────▼──────────────────────────────────────┐
│                    Next.js Application Server                         │
│  /api/pay/*  ·  /api/upload-receipt  ·  /api/migrate  · SSR pages    │
└───────────────┬─────────────────────────────┬────────────────────────┘
                │                             │
                ▼                             ▼
┌───────────────────────────┐   ┌─────────────────────────────────────┐
│ Supabase Auth + PostgREST │   │ PostgreSQL (primary system of record)│
│ JWT sessions · RLS · RPC  │   │ Core + vertical + ERP tables         │
└───────────────────────────┘   └─────────────────────────────────────┘
                │
                ▼
┌───────────────────────────┐   ┌─────────────────────────────────────┐
│ Object / File Storage     │   │ External Services                     │
│ public/receipts · buckets │   │ Safepay · Google Drive · Gemini AI   │
└───────────────────────────┘   └─────────────────────────────────────┘
```

### 2.2 Application Layers

| Layer | Location | Responsibility |
|---|---|---|
| **Presentation** | `src/app/**`, `src/components/**` | Pages, modals, POS UI, landing |
| **Context / State** | `src/context/ShopContext.tsx`, `LanguageContext.tsx` | Auth session → shop, permissions, plan, languages |
| **Domain helpers** | `src/lib/restaurant-*.ts`, `src/utils/audit.ts` | Vertical workflows, audit writes |
| **Sync** | `src/lib/sync/syncEngine.ts` | Offline queue + reconnect flush |
| **Data access** | Supabase JS client (`src/lib/supabase/client.ts`) | CRUD via PostgREST; RPC for stock/balance |
| **API routes** | `src/app/api/**` | Payments, local file upload, migrations |
| **Admin** | `src/app/admin/**` | Platform operations |

### 2.3 Runtime Scripts & Tooling

| Script / Area | Purpose |
|---|---|
| `npm run dev` | HTTPS local dev (`--experimental-https`, host `0.0.0.0`) |
| `npm run build` / `start` | Production Next.js build and serve |
| `deploy_*.js` / `scratch/execute_*.js` | Schema and data migrations against PostgreSQL |
| `*.sql` | Vertical and ERP schema definitions |

---

## 3. Multi-Tenancy & Shop Model

### 3.1 Tenancy Model

| Concept | Table / Field | Notes |
|---|---|---|
| **Tenant root** | `shops` | One business location / brand unit |
| **User binding** | `user_profiles.shop_id` | Active shop for session |
| **Multi-shop map** | `user_shops` | User may belong to many shops |
| **Industry** | `shops.industry_type` | Drives sidebar and module routes |
| **Branch (future-ready)** | `ShopContext.branchId` | Prepared for multi-branch expansion |

### 3.2 Supported Industry Types

| `industry_type` | Vertical | Primary routes |
|---|---|---|
| `general` | General retail | `/dashboard/general/*`, gift cards |
| `karyana` | Grocery / karyana | Barcodes, packings (shared catalog) |
| `pharmacy` | Medical store | Expiry, formulas, drug registry |
| `electronics` | Mobile / electronics | EMI, IMEI, repair |
| `crockery` | Crockery / bridal packs | Optional EMI |
| `hardware` | Hardware / sanitary | Dimension pricing |
| `garments` | Boutique / garments | Size/color variations |
| `tailor` | Stitching | Measurements, orders, karigar |
| `fuel` | Petrol pump | Tanks, meter readings |
| `showroom` | Vehicles / rental | Vehicles, rentals |
| `fertilizer` | Agri inputs | Batches, seasonal khata, fertilizer POS |
| `restaurant` | F&B | Tables, KOT/KDS, deals, recipes, active bills |

### 3.3 Shop Switch Flow

1. User loads dashboard → `ShopProvider` reads auth user.
2. Profile supplies `shop_id`, `role`, `permissions`.
3. Shop row supplies industry, ERP toggles, subscription.
4. Plan config resolved from platform `company_details` (super-admin shop config JSON).
5. User may switch via `user_shops` → update `user_profiles.shop_id` → full reload.

---

## 4. Authentication & Authorization Flow

### 4.1 Authentication (Supabase Auth)

| Step | Actor | Behavior |
|---|---|---|
| 1 | User | Opens `/login` or `/register` |
| 2 | Client | `supabase.auth.signInWithPassword({ email, password })` or sign-up |
| 3 | Supabase Auth | Issues JWT session (stored by Supabase client) |
| 4 | Register path | Creates `shops` → `user_profiles` → `user_shops` |
| 5 | Session bootstrap | `ShopProvider` calls `getUser()`; missing user redirects to `/login` |
| 6 | Logout | `supabase.auth.signOut()` → redirect `/login` |

### 4.2 Identity Entities

| Entity | Key fields | Purpose |
|---|---|---|
| **Auth user** | Supabase `auth.users.id` | Credentials & JWT subject |
| **Profile** | `user_profiles.id` (= auth uid), `shop_id`, `role`, `name`, `permissions` | App identity |
| **Shop membership** | `user_shops (user_id, shop_id)` | Multi-business access |
| **Platform admin** | Email allowlist (`superadmin@hisabx.com`, `superadmin@theaccounts.cloud`) and/or `role = superadmin` | Admin console |

### 4.3 Authorization Layers (Defense in Depth)

Authorization is evaluated in **four stacked layers**. A request is allowed only if **all** applicable layers pass.

| Layer | Source | Controls |
|---|---|---|
| **L1 – Authentication** | Valid JWT / session | Must be logged in |
| **L2 – Subscription tier** | `shops.subscription_tier` + `subscription_expires_at` | Free/Starter/Premium feature set; expired → degrade to free |
| **L3 – Shop plan flags** | Plan JSON in platform config + shop toggles (`has_emi`, `has_payroll`, …) | Module availability (EMI, payroll, tax, assets, backup, AI, …) |
| **L4 – Staff permissions** | `user_profiles.permissions` | Panels (`pos`, `purchase`, …) and actions (`edit_bill`, `delete_bill`, …) |

### 4.4 Roles

| Role | Capabilities |
|---|---|
| **superadmin** | Full panels/actions; bypass most plan gates; platform admin UI |
| **owner / admin** (shop) | Staff management, settings, accounts (subject to plan) |
| **staff / cashier** | Subset of panels/actions from JSON permissions |
| **waiter** (restaurant) | POS / order workflow subset (vertical convention) |

### 4.5 Permission Schema (JSON)

```json
{
  "panels": {
    "dashboard": true,
    "pos": true,
    "sales": true,
    "registers": true,
    "purchase": true,
    "products": true,
    "categories": true,
    "brands": true,
    "units": true,
    "khata": true,
    "returns": true,
    "expenses": true,
    "accounts": true,
    "reports": true,
    "staff": false,
    "backup": false
  },
  "actions": {
    "edit_bill": false,
    "delete_bill": false,
    "edit_account": false,
    "delete_account": false
  },
  "max_discount_percentage": 100
}
```

### 4.6 UI Enforcement Rules

| Surface | Rule |
|---|---|
| **Sidebar** | Hide links where `permissions.panels[key] !== true` |
| **Tier paths** | Free blocks GL, closing, support, staff, EMI; Starter blocks staff + EMI (current product rule) |
| **SubscriptionBlocker** | Soft-lock premium pages when plan does not allow |
| **Server routes** | Payment and admin mutations must re-validate identity and shop ownership (required hardening) |
| **RLS** | PostgreSQL RLS should enforce `shop_id` membership (target standard for production) |

### 4.7 Sequence: Protected Dashboard Load

```
Browser → /dashboard
  → ShopProvider.getUser()
  → if !user → /login
  → load user_profiles + shops + print_settings + platform config
  → compute effective permissions = intersection(role, plan, profile.permissions)
  → render Sidebar + page with gates
```

### 4.8 Public Surfaces

| Route | Auth required | Notes |
|---|---|---|
| `/` | No | Marketing / landing |
| `/login`, `/register` | No | Auth entry |
| `/public/receipt/[id]` | No | Customer-facing receipt view by invoice id |
| `/dashboard/**` | Yes | Shop application |
| `/admin/**` | Super admin only | Platform console |

---

## 5. Subscription & Licensing Model

### 5.1 Tiers (Default Product Matrix)

| Feature | Free | Starter | Premium |
|---|---|---|---|
| Core POS + products + khata | Yes | Yes | Yes |
| Simple accounts / expenses / reports | Limited | Yes | Yes |
| Industrial / advanced accounts | No | Yes | Yes |
| Backup | No | Yes | Yes |
| Barcode tools | No | Yes | Yes |
| Multi-shop | No | No | Yes |
| Universal import | No | Yes | Yes |
| AI product add / AI PO | No | No | Yes |
| WhatsApp integrations | No | No | Yes |
| EMI | No | Yes* | Yes |
| Payroll / Tax / Assets | No | No | Yes (shop toggles) |
| Support tickets | No | No | Yes |
| Max devices | 1 | 3 | Unlimited |
| Indicative monthly (PKR) | 0 | 1,500 | 3,500 |

\*Product code currently also blocks EMI for Starter in sidebar tier path; treat matrix vs code as an open product decision.

### 5.2 Billing Integration

| Component | Implementation |
|---|---|
| Init | `POST /api/pay/init` → Safepay order token |
| Callback | `POST /api/pay/callback` → update `shops.subscription_*` |
| Config | Safepay keys + plan definitions in platform `company_details.website` JSON |
| UI | `/dashboard/billing` |

### 5.3 Expiry Behavior

| Condition | Behavior |
|---|---|
| `subscription_expires_at` past | Effective tier becomes **free** for gates |
| Trial ≤ 10 days remaining | Trial banner + upsell to billing |
| Expired premium | Red banner; core free features remain where allowed |

---

## 6. Common Database Conventions

All new tables and migrations **must** follow these conventions unless a documented exception exists.

### 6.1 Base Columns (Mandatory on Tenant Tables)

| Column | Type | Required | Description |
|---|---|---|---|
| `id` | `UUID` | Yes | Primary key; default `gen_random_uuid()` / `uuid_generate_v4()` |
| `shop_id` | `UUID` → `shops(id)` | Yes* | Tenant isolation; `ON DELETE CASCADE` for shop-owned data |
| `created_at` | `TIMESTAMPTZ` | Yes | Default `timezone('utc', now())` |
| `updated_at` | `TIMESTAMPTZ` | Recommended | Maintain via trigger or app write |
| `created_by` | `UUID` → auth user | Recommended | Actor on insert |
| `updated_by` | `UUID` | Optional | Actor on update |

\*Join / child tables may omit `shop_id` only if parent FK guarantees shop scope **and** every query joins parent for isolation. Prefer denormalized `shop_id` for performance.

### 6.2 Soft Deletes

| Convention | Rule |
|---|---|
| Column | `deleted_at TIMESTAMPTZ NULL` |
| Active rows | `deleted_at IS NULL` |
| Soft delete | Set `deleted_at = now()`, never hard-delete financial history |
| Hard delete | Allowed only for pure catalog drafts or with audit + no ledger refs |
| Default filters | All list queries exclude soft-deleted rows |
| Void vs delete | Financial docs use `is_voided` / status enums rather than delete |

### 6.3 Audit Fields & Audit Log

| Mechanism | When to use |
|---|---|
| Row `created_by` / `updated_by` | Lightweight provenance |
| `audit_logs` table | Sensitive mutations (void invoice, balance change, staff, restore) |
| Document `edit_history` JSON | Invoice edit trail |
| `sync_info` JSON | Offline creation metadata |

**`audit_logs` (logical columns):**

| Column | Type | Notes |
|---|---|---|
| `id` | UUID | PK |
| `shop_id` | UUID | Tenant |
| `user_id` | UUID | Actor |
| `action` | TEXT | `create` \| `update` \| `delete` \| `void` \| `login` \| … |
| `table_name` / details | TEXT / JSONB | Target entity |
| `old_data` / `new_data` | JSONB | Optional snapshots |
| `ip_address` | TEXT | Optional |
| `created_at` | TIMESTAMPTZ | Event time |

### 6.4 Monetary & Quantity Types

| Kind | Type | Rule |
|---|---|---|
| Money | `NUMERIC(15,2)` or `DECIMAL(15,2)` | Never float for money |
| Rates / tax % | `NUMERIC(8,4)` or `DECIMAL(5,2)` | Consistent rounding policy (half-up, 2 dp for PKR) |
| Stock qty | `NUMERIC(18,4)` | Supports partial units |
| Currency | Shop setting (`selectedCurrency`, default `PKR`) | Store amounts in shop currency |

### 6.5 Status & Enum Conventions

| Pattern | Examples |
|---|---|
| Lowercase snake strings | `pending`, `paid`, `voided`, `partial` |
| Boolean flags for irreversible states | `is_voided`, `is_edited`, `is_reconciled` |
| Prefer status + timestamps | `status`, `paid_at`, `closed_at` |

### 6.6 Naming Rules

| Object | Convention |
|---|---|
| Tables | Plural snake_case: `invoice_items`, `cash_accounts` |
| Columns | Snake_case |
| FK names | `{table}_{column}_fkey` |
| Indexes | `idx_{table}_{columns}` |
| Unique indexes | `uq_{table}_{columns}` |
| RPCs | Verb style: `decrement_product_stock`, `increment_party_balance` |

### 6.7 Indexing Rules (Convention Level)

| Rule | Example |
|---|---|
| Always index `shop_id` on tenant tables | `idx_invoices_shop_id` |
| Composite for common filters | `(shop_id, created_at DESC)` |
| Unique business keys per shop | `(shop_id, invoice_number)` when introduced |
| Soft-delete partial indexes | `WHERE deleted_at IS NULL` |
| Avoid over-indexing write-heavy lines | Index parents more than volatile children if needed |

### 6.8 Referential Integrity

| Rule | Detail |
|---|---|
| Money docs | Prefer `ON DELETE RESTRICT` for posted invoices/PO lines |
| Catalog | `ON DELETE SET NULL` only when history can survive without product |
| Shop cascade | Shop deletion cascades operational data (dangerous; admin-only) |
| Balance mutations | Prefer RPCs/triggers over multi-step client updates for stock and party balance |

### 6.9 Multi-Language Fields

| Pattern | Usage |
|---|---|
| `translated_names` JSONB | Product / item names per language code |
| `print_settings.receipt_design_settings` | Active languages, billing language, layout |
| UI dictionary | `src/lib/translations.ts` |

---

## 7. Core Domain Model

### 7.1 Core Tables (All Verticals)

| Domain | Tables |
|---|---|
| **Identity & tenancy** | `shops`, `user_profiles`, `user_shops`, `users` (legacy/compat) |
| **Catalog** | `products`, `categories`, `brands`, `units`, `product_variants`, `product_barcodes`, `shelves`, `warehouses`, `stock` |
| **Parties** | `parties` (customers/suppliers unified), optional legacy `customers` / `suppliers` |
| **Sales** | `invoices`, `invoice_items`, `sales`, `sale_items` (legacy dual-path awareness) |
| **Purchase** | `purchase_orders`, `purchase_order_items` |
| **Returns** | `returns`, `return_items` |
| **Cash & credit** | `cash_accounts`, `account_transactions`, `credit_transactions`, `pending_payments` |
| **Registers** | `register_sessions`, `shift_meter_readings` |
| **Expenses** | `expenses` |
| **Settings** | `company_details`, `print_settings` |
| **Loyalty / cards** | `gift_cards`, `gift_card_transactions` |
| **Audit / support** | `audit_logs`, `support_tickets`, `support_ticket_replies` |
| **Closing** | `closing_books`, `closing_balances` |
| **ERP GL** | `journal_entries`, `journal_lines` |
| **ERP extras** | `fixed_assets`, `asset_depreciation_logs`, `payroll_slips`, `payroll_items`, `bank_statement_lines`, `post_dated_cheques` |

### 7.2 Primary Document: Invoice

| Field group | Fields (logical) |
|---|---|
| Identity | `id`, `shop_id`, `created_at` |
| Party & pay | `party_id`, `payment_mode`, `paid_amount`, `account_id` |
| Amounts | `total_amount`, `discount`, `tax_rate`, `tax_amount` |
| Ops | `register_session_id`, `status`, `is_voided`, `is_edited`, `edit_history` |
| Vertical ext | Restaurant status fields, fertilizer remarks, EMI linkage |
| Offline | Client-generated `id`, optional `sync_info` |

### 7.3 Stock Mutation Pattern

1. Create invoice / PO / return lines.
2. Call RPC (`decrement_product_stock`, `decrement_variant_stock`, etc.) **or** controlled update.
3. Optionally write `stock_adjustments` / inventory audit.
4. Never allow silent negative stock unless `shops.allow_negative_stock = true`.

### 7.4 Party Balance Pattern

1. Credit sale / payment / purchase on credit updates `parties.balance` via RPC or transactional update.
2. Append `credit_transactions` for ledger lines.
3. Khata UI reads party + transaction history; aging reports bucket open items by date.

---

## 8. Vertical Modules

Each vertical reuses core tables and adds specialized tables/UI. At the end of every vertical: **Required Tables**.

### 8.1 General Retail

| Feature | Behavior |
|---|---|
| Products / categories / brands | Full catalog |
| Variations & barcodes | Packings, multi-barcode |
| Gift cards | Issue, redeem, ledger |
| POS | Standard grid + scan |

**Required Tables:** `shops`, `user_profiles`, `products`, `categories`, `brands`, `units`, `product_variants`, `product_barcodes`, `parties`, `invoices`, `invoice_items`, `cash_accounts`, `account_transactions`, `credit_transactions`, `gift_cards`, `gift_card_transactions`, `print_settings`, `company_details`

---

### 8.2 Karyana / Grocery

| Feature | Behavior |
|---|---|
| Fast barcode POS | High-frequency scan |
| Packings | Box / carton / gatta with conversion |
| Weight-friendly units | Custom units |

**Required Tables:** `products`, `product_variants`, `product_barcodes`, `units`, `categories`, `brands`, `parties`, `invoices`, `invoice_items`, `purchase_orders`, `purchase_order_items`, `stock` / product stock fields, `cash_accounts`, `credit_transactions`

---

### 8.3 Pharmacy & Medical

| Feature | Behavior |
|---|---|
| Formulations | Generic/salt search |
| Expiry / batch | Warnings, filters |
| Drug registry | Master medicine assist (where enabled) |
| Packing math | Strip / box conversions |

**Required Tables:** `products`, `formulations`, `product_variants`, `product_barcodes`, `parties`, `invoices`, `invoice_items`, `purchase_orders`, `purchase_order_items`, `cash_accounts`, `credit_transactions`  
*(Optional/extended: batch/expiry columns or `product_batches` if shared with fertilizer patterns, master medicine tables when deployed)*

---

### 8.4 Electronics & Mobile

| Feature | Behavior |
|---|---|
| IMEI tracking | `product_imeis`, sold IMEI on lines |
| Warranty | Line-level warranty text |
| EMI / installments | Plans, schedules, payments |
| Repair desk | `repair_tickets` lifecycle |

**Required Tables:** `products`, `product_imeis`, `product_variants`, `parties`, `invoices`, `invoice_items`, `installment_plans`, `installment_payments`, `emi_schedules`, `repair_tickets`, `cash_accounts`, `credit_transactions`, `account_transactions`

---

### 8.5 Crockery

| Feature | Behavior |
|---|---|
| Package / set sales | Core catalog + POS |
| Optional EMI | Same EMI stack as electronics when `has_emi` |

**Required Tables:** `products`, `product_variants`, `parties`, `invoices`, `invoice_items`, `cash_accounts`, `credit_transactions`  
*(If EMI enabled: `installment_plans`, `installment_payments`, `emi_schedules`)*

---

### 8.6 Hardware & Sanitary

| Feature | Behavior |
|---|---|
| Dimension pricing | Length × width / area / running feet |
| Cut pieces | Qty derived from measurements |

**Required Tables:** `products`, `product_variants`, `units`, `parties`, `invoices`, `invoice_items`, `purchase_orders`, `purchase_order_items`, `cash_accounts`, `credit_transactions`  
*(Dimension metadata on product/settings as implemented in hardware UI)*

---

### 8.7 Garments & Boutique

| Feature | Behavior |
|---|---|
| Size / color matrix | Variants |
| Barcodes per SKU | Variant barcodes |

**Required Tables:** `products`, `product_variants`, `product_barcodes`, `categories`, `brands`, `parties`, `invoices`, `invoice_items`, `purchase_orders`, `purchase_order_items`, `cash_accounts`, `credit_transactions`

---

### 8.8 Tailor & Stitching

| Feature | Behavior |
|---|---|
| Customer measurements | `tailor_measurements` |
| Stitching orders | `stitching_orders` |
| Karigar ledger | `karigars` + balance RPCs |
| Expense link | Shop expenses for materials |

**Required Tables:** `parties`, `tailor_measurements`, `stitching_orders`, `karigars`, `expenses`, `cash_accounts`, `account_transactions`, `invoices` (if advance bills), `print_settings`

---

### 8.9 Fuel / Petrol Pump

| Feature | Behavior |
|---|---|
| Tanks | `fuel_tanks` inventory |
| Pumps | `fuel_pumps` |
| Shift readings | `fuel_shift_readings` / `shift_meter_readings` |
| Register coupling | `register_sessions` |

**Required Tables:** `fuel_tanks`, `fuel_pumps`, `fuel_shift_readings`, `shift_meter_readings`, `register_sessions`, `products` (fuel grades), `invoices`, `invoice_items`, `cash_accounts`, `account_transactions`, `parties`

---

### 8.10 Showroom & Vehicle Rental

| Feature | Behavior |
|---|---|
| Vehicle inventory | `showroom_vehicles` (chassis, model, status) |
| Rentals | Rental agreements / returns |
| Vehicle expenses | Expenses linked to vehicle |

**Required Tables:** `showroom_vehicles`, `parties`, `expenses`, `cash_accounts`, `account_transactions`, `invoices` (sales/rental bills as modeled), rental tables as deployed in showroom module

---

### 8.11 Fertilizer, Seeds & Pesticides

| Feature | Behavior |
|---|---|
| Batches | `product_batches` |
| Seasonal farmer khata | `seasonal_khata` |
| Fertilizer POS | Dedicated POS path with batch selection |

**Required Tables:** `products`, `product_batches`, `parties`, `seasonal_khata`, `invoices`, `invoice_items`, `cash_accounts`, `account_transactions`, `credit_transactions`, `print_settings`, `company_details`

---

### 8.12 Restaurant & Cafe

| Feature | Behavior |
|---|---|
| Tables | `restaurant_tables` |
| Orders / KOT | `kitchen_orders`, `kitchen_order_items` |
| KDS | Kitchen display statuses |
| Deals | `restaurant_deals`, `restaurant_deal_items` |
| Recipes / BOM | `product_recipes` (ingredient deduction) |
| Waiter calls | `restaurant_waiter_calls` |
| Active bills | Open invoices with restaurant status machine |

**Required Tables:** `restaurant_tables`, `kitchen_orders`, `kitchen_order_items`, `restaurant_deals`, `restaurant_deal_items`, `restaurant_menu_sizes`, `restaurant_waiter_calls`, `product_recipes`, `products`, `parties`, `invoices`, `invoice_items`, `cash_accounts`, `account_transactions`, `credit_transactions`, `print_settings`

---

## 9. Accounting & Financial Engine

### 9.1 Modes

| Mode | Audience | Components |
|---|---|---|
| **Simple** | SME | Cash accounts, credit transactions, registers, expenses |
| **Industrial / GL** | Larger clients | `journal_entries`, `journal_lines`, GL reports, closing books |
| **ERP add-ons** | Premium | Payroll, tax lines, fixed assets, bank reconciliation, PDCs |

### 9.2 Double-Entry Rules

| Rule | Detail |
|---|---|
| Balance | Every journal: Σ debits = Σ credits |
| Source docs | Invoice, PO, expense, payment, transfer generate or link journals when enabled |
| Closing books | Historical book view freezes context for reports |
| Opening balances | `closing_balances` seed next period |

### 9.3 Register Lifecycle

1. Open `register_sessions` with opening cash.
2. POS sales attach `register_session_id`.
3. Optional fuel meter readings per shift.
4. Close session with counted cash / variance.

---

## 10. API Design Standards & Conventions

HisabX is primarily a **BFF-light + direct Supabase client** architecture. Standards below apply to both Next.js route handlers and any future dedicated API.

### 10.1 Transport & Format

| Standard | Rule |
|---|---|
| Protocol | HTTPS only |
| Body | JSON (`Content-Type: application/json`) unless multipart/binary upload |
| Dates | ISO-8601 UTC strings |
| Money | Numbers with 2 decimal places; never strings for calc |
| IDs | UUID v4 strings |
| Errors | Consistent JSON error envelope |

### 10.2 Error Envelope

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Human readable message",
    "details": { "field": "party_id" },
    "request_id": "optional-correlation-id"
  }
}
```

| HTTP Status | Use |
|---|---|
| 200 / 201 | Success |
| 400 | Validation / bad input |
| 401 | Unauthenticated |
| 403 | Authenticated but not allowed |
| 404 | Missing resource |
| 409 | Conflict (duplicate offline id, stock race) |
| 422 | Semantic business rule failure |
| 429 | Rate limit |
| 500 | Unexpected server error |

### 10.3 Naming Conventions

| Surface | Convention |
|---|---|
| REST paths | kebab-case nouns: `/api/pay/init`, `/api/upload-receipt` |
| Query params | snake_case or camelCase consistently per surface; prefer snake_case for DB-aligned APIs |
| Supabase tables | snake_case plurals |
| RPC names | snake_case verbs |

### 10.4 Current First-Party Routes

| Method | Path | Auth | Purpose |
|---|---|---|---|
| `POST` | `/api/pay/init` | App session (should verify) | Create Safepay order token |
| `POST` | `/api/pay/callback` | Gateway / server | Apply subscription after payment |
| `POST` | `/api/upload-receipt` | App (should verify) | Write PDF/image to `public/receipts` |
| `POST` | `/api/migrate` | Admin only (must lock down) | Controlled migrations |

### 10.5 Supabase Data Access Conventions

| Rule | Detail |
|---|---|
| Always filter `shop_id` | Client queries must include active shop |
| Prefer RPC for balances | Stock and party balance concurrency |
| Select only needed columns | Avoid `select('*')` on heavy lists in new code |
| Pagination | `.range()` / cursor on large tables (products, invoices, audit) |
| Idempotency | Client supplies document `id` for offline inserts |

### 10.6 Versioning Policy

| Phase | Approach |
|---|---|
| Now | Single unversioned `/api/*` with backward-compatible additive fields |
| Later | `/api/v1/*` when external integrators appear |
| Deprecation | Announce in admin notes; keep ≥ 90 days dual support |

### 10.7 Idempotency Keys

| Write type | Key |
|---|---|
| Offline invoice | Client UUID in `invoices.id` |
| Payment init | Optional `Idempotency-Key` header (recommended) |
| Sync replay | Same UUID insert → treat unique violation as success if payload matches |

### 10.8 Rate Limiting & Abuse Controls (Target)

| Endpoint class | Guidance |
|---|---|
| Auth | Strict limits per IP + email |
| AI endpoints | Per shop daily quota from plan |
| Upload | Size cap (e.g. 5–10 MB), MIME allowlist |
| Pay init | Per shop burst limit |

---

## 11. File Storage Strategy

### 11.1 Storage Classes

| Class | Current / Target | Examples |
|---|---|---|
| **Public static** | `public/` in app deploy | Logos, marketing images |
| **Generated receipts** | `public/receipts/` via `/api/upload-receipt` | PDF/PNG receipts, product snaps |
| **Supabase Storage buckets** | Target for multi-node | `receipts`, `support_attachments` |
| **External backup** | Google Drive (user-linked) | Full shop JSON export |

### 11.2 Local Receipt Upload (Current)

| Step | Detail |
|---|---|
| Request | `POST /api/upload-receipt` with raw body + `x-filename` header |
| Validation | Require filename; enforce extension allowlist (pdf, png, jpg) in hardened version |
| Path | `public/receipts/{filename}` |
| Response | `{ success: true, url: "/receipts/{filename}" }` |
| Risk | Local disk is **node-local**; not shared across multiple app instances |

### 11.3 Target Object Storage Layout

| Bucket | Access | Key pattern |
|---|---|---|
| `receipts` | Authenticated read; public read only via signed URL if customer link | `{shop_id}/{yyyy}/{mm}/{invoice_id}_{ts}.pdf` |
| `support_attachments` | Staff + admin | `{shop_id}/{ticket_id}/{uuid}_{filename}` |
| `product_images` | Shop staff | `{shop_id}/products/{product_id}/{uuid}.webp` |
| `backups` | Owner only / server-side | `{shop_id}/backup_{timestamp}.json` |

### 11.4 File Policy

| Rule | Value |
|---|---|
| Max upload size | 10 MB (receipts), 25 MB (support) |
| Allowed MIME | `application/pdf`, `image/png`, `image/jpeg`, `image/webp` |
| Virus/malware | Optional ClamAV on VPS for support uploads |
| Retention | Receipts: life of shop; support: 24 months; backups: last N + monthly |
| PII | Avoid storing CNIC images unless encrypted bucket |

### 11.5 CDN & Caching

| Asset type | Cache |
|---|---|
| Marketing static | Long cache + hashed names |
| Receipts | Private/short cache; prefer signed URLs in multi-tenant production |
| API JSON | No public CDN cache |

---

## 12. Offline Sync Architecture

Implementation reference: `src/lib/sync/syncEngine.ts`.

### 12.1 Goals

| Goal | Description |
|---|---|
| Sell without internet | Queue POS-critical writes |
| Auto recovery | Flush on `window.online` |
| Bounded risk | Max retries; no infinite poison queue |
| Operator visibility | Offline banner in dashboard layout |

### 12.2 Tables That Support Offline (Write Queue)

| Priority | Endpoint / table | Offline support | Notes |
|---|---|---|---|
| P0 | `invoices` | **Yes** | Header must be queued with stable UUID |
| P0 | `invoice_items` | **Yes (with parent)** | Prefer single payload or transactional RPC later |
| P0 | `account_transactions` | **Conditional** | Queue only if generated with invoice payload bundle |
| P0 | `credit_transactions` | **Conditional** | Credit sales offline |
| P1 | `purchase_orders` | **Yes** (engine endpoint) | Stock-in while offline |
| P1 | `purchase_order_items` | **Yes (with parent)** | Bundle with PO |
| P1 | `expenses` | **Yes** (engine endpoint) | Petty cash expenses |
| P2 | `parties` | **Limited** | New walk-in customer: temp id map required |
| P2 | `products` | **No (read cache only)** | Catalog should be pre-cached; no offline create by default |
| — | `journal_entries` | **No** | Online-only financial close/GL |
| — | `closing_books` | **No** | Online-only |
| — | `support_tickets` | **No** | Online-only |
| — | Kitchen / KOT mutations | **No (v1)** | Restaurant floor should warn offline |
| — | EMI payments | **No (v1)** | High conflict risk |
| — | Stock RPCs alone | **No** | Must ride on document sync + server apply |

**Read models recommended for offline cache (localStorage/IndexedDB target):**

| Cache | Contents |
|---|---|
| Catalog snapshot | products, variants, barcodes, prices |
| Parties snapshot | top customers / last N |
| Cash accounts | id + name (not live balance as source of truth) |
| Print settings | receipt layout |

### 12.3 Temporary ID Strategy for Offline Invoices

| ID type | Strategy |
|---|---|
| **Invoice primary key** | Client generates UUID v4 **before** queueing; used as permanent PK (`payload.id`) |
| **Invoice number (human)** | Optional offline sequence: `OFF-{deviceShort}-{localSeq}` stored in remarks or dedicated column; server may renumber on sync **or** keep OFF- number for audit clarity |
| **Line item IDs** | Client UUID v4 each line |
| **New party offline** | `temp_party_{uuid}` in local map → create party on sync first → rewrite `party_id` in payload |
| **Local queue id** | Same as document id or separate `OfflineTransaction.id` (= payload id) |
| **Device id** | Persist `hx_device_id` in localStorage for support diagnostics |
| **Idempotency** | Server unique on `id`; duplicate insert = already synced |

**Recommended payload bundle (target):**

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "shop_id": "...",
  "total_amount": 1500,
  "paid_amount": 1500,
  "payment_mode": "cash",
  "account_id": "...",
  "party_id": null,
  "items": [ { "id": "...", "product_id": "...", "quantity": 1, "unit_price": 1500, "subtotal": 1500 } ],
  "side_effects": {
    "stock": [{ "product_id": "...", "qty": 1 }],
    "account_tx": true,
    "credit_tx": false
  },
  "client_meta": {
    "device_id": "...",
    "created_offline_at": "2026-07-11T10:00:00.000Z",
    "app_version": "0.1.0"
  }
}
```

> **Gap to close:** Current engine inserts a single table row from `endpoint`. Production-ready offline must use a **server RPC** `apply_offline_invoice(payload)` that inserts header, lines, stock, and ledger atomically.

### 12.4 Sync Algorithm

| Step | Behavior |
|---|---|
| 1 | Detect offline → `queueTransaction(endpoint, shopId, payload)` |
| 2 | Persist queue key `hisabx_offline_queue` in `localStorage` |
| 3 | On `online` event → `syncAll()` |
| 4 | For each FIFO item → insert + attach `sync_info` |
| 5 | Success → drop from queue; failure → `attempts++` |
| 6 | `attempts >= 5` → discard (or move to dead-letter UI — recommended) |

### 12.5 Conflict Resolution Matrix

| Scenario | Resolution |
|---|---|
| Duplicate invoice UUID | Treat as success if existing row belongs to same shop and amounts match; else dead-letter |
| Stock went negative while offline | If `allow_negative_stock=false`, server rejects; keep in queue with user prompt to edit/void local copy |
| Price changed online after local sale | **Last local wins for that invoice**; do not rewrite historical price; optional manager alert |
| Party credit limit exceeded | Server reject; cashier must collect cash or raise limit online |
| Same IMEI sold on two offline devices | Second sync fails unique constraint; dead-letter + manual repair ticket |
| Register session closed online | Attach to new open session or null session + audit note |
| Invoice voided locally & paid online | Prefer server state; local void becomes no-op with warning |
| Clock skew | Prefer `client_meta.created_offline_at` for business time; `created_at` server default for system time; store both |
| Partial child insert failure | Must be transactional; never leave header without lines |
| Queue corrupted JSON | Backup raw string to `hisabx_offline_queue_corrupt`; start empty queue; alert owner |
| Multi-tab dual queue | Use single-tab lock (`navigator.locks` or `localStorage` lock timestamp) |

### 12.6 Conflict Resolution Edge Cases (Detailed)

| Edge case | Expected system behavior |
|---|---|
| **E1 – Offline cash sale, account deleted before sync** | Fail sync; prompt remapping to another cash account |
| **E2 – Product deleted/archived before sync** | Fail line apply; force substitute product or void |
| **E3 – Two offline invoices, same local stock unit (qty 1)** | First sync succeeds; second fails stock check |
| **E4 – Offline credit sale, party merged online** | Map old party id → surviving party id via merge table if introduced; else fail |
| **E5 – User logs into different shop on same browser** | Queue entries are shop-scoped; never flush shop A payload under shop B session |
| **E6 – Subscription expired during offline period** | Allow sync of already-created local sales (data integrity); block new premium-only features |
| **E7 – Hard refresh mid-sync** | `isSyncing` resets; safe due to idempotent UUIDs |
| **E8 – localStorage quota exceeded** | Block new offline sales with hard error; force online or export queue |

### 12.7 Offline Testing Checklist

| # | Test | Pass criteria |
|---|---|---|
| 1 | Disable network → create cash invoice | Invoice appears in local queue; user sees offline banner |
| 2 | Re-enable network | Queue flushes; invoice visible in Sales/DB |
| 3 | Duplicate flush (sync twice) | No double stock decrement; one invoice row |
| 4 | Offline credit sale | Party balance updates once after sync |
| 5 | Offline PO receive | Stock increases once; PO present |
| 6 | Offline expense | Expense + account tx consistent after sync |
| 7 | Max retry poison message | After 5 failures, item leaves live queue and is visible in dead-letter/debug |
| 8 | Shop switch with pending queue | No cross-shop insert |
| 9 | Negative stock blocked | Sync fails gracefully; operator notified |
| 10 | Multi-tab offline sale | Only one queue writer; no lost items |
| 11 | Clear site data with pending queue | Documented data loss; warn before clear (if app-controlled) |
| 12 | Restaurant KOT while offline | Explicit block or warning (no silent failure) |
| 13 | EMI collection offline | Blocked or queued per policy with test proof |
| 14 | Clock set wrong on device | Invoice still syncs; timestamps auditable |
| 15 | Large queue (100 invoices) | Sync completes without UI freeze; progress indicator |

---

## 13. Backup & Recovery Strategy

### 13.1 Backup Types

| Type | Mechanism | RPO target | RTO target |
|---|---|---|---|
| **DB continuous** | PostgreSQL WAL / managed PITR (Supabase or pgBackRest) | ≤ 5 min | ≤ 1 h |
| **DB daily dump** | `pg_dump` cron on VPS | 24 h | 2–4 h |
| **Shop export** | In-app Backup page JSON export | On demand | Minutes |
| **Google Drive** | OAuth upload of export | On demand / manual | Minutes |
| **File storage** | Object storage versioning / rsync | 24 h | 2–4 h |

### 13.2 In-App Backup Module (`/dashboard/backup`)

| Capability | Detail |
|---|---|
| Access | Plan flag `allowBackup` + permission |
| Export | Pull shop-scoped tables (invoices, items, EMI, measurements, returns, POs, sales, sessions, installments, gift cards, …) |
| Download | Browser JSON download |
| Drive link | Google Identity Services client; folder listing/restore |
| Audit tab | Filterable `audit_logs` |

### 13.3 What Must Be in a Full Logical Backup

| Group | Tables (minimum) |
|---|---|
| Master | shops (row), company_details, print_settings, categories, brands, units, products, variants, barcodes |
| Parties | parties, credit_transactions |
| Docs | invoices, invoice_items, purchase_orders, purchase_order_items, returns, return_items, expenses |
| Cash | cash_accounts, account_transactions, register_sessions |
| Vertical | industry-specific tables for that shop |
| ERP | journals, assets, payroll if enabled |

### 13.4 Restore Procedures

| Scenario | Procedure |
|---|---|
| **Single shop logical restore** | Import JSON in controlled admin tool; map IDs; disable live POS during restore |
| **Point-in-time DB restore** | Restore PITR to staging → verify → promote or extract shop |
| **Accidental void/delete** | Prefer reverse document + audit, not full restore |
| **Ransomware / total loss** | Rebuild VPS → restore latest DB dump + WAL → restore object storage → smoke test |

### 13.5 Backup Verification

| Check | Frequency |
|---|---|
| Restore drill to staging | Quarterly |
| Checksum daily dump | Daily |
| Verify Drive token still valid | Monthly |
| Row counts sample after restore | Every drill |

### 13.6 Retention Policy

| Store | Retention |
|---|---|
| WAL / PITR | 7–14 days |
| Daily dumps | 30 days rolling |
| Monthly dumps | 12 months |
| Drive shop exports | Last 10 + 1st of month |

---

## 14. Performance & Indexing Guidelines

### 14.1 Critical Indexes (Baseline)

| Table | Index | Reason |
|---|---|---|
| `invoices` | `(shop_id, created_at DESC)` | Sales lists, dashboards |
| `invoices` | `(shop_id, party_id, created_at DESC)` | Khata statements |
| `invoices` | `(shop_id, is_voided)` partial where false | Active sales |
| `invoice_items` | `(invoice_id)` | Line fetch |
| `invoice_items` | `(product_id)` | Product sales analysis |
| `products` | `(shop_id, name)` | Search |
| `product_barcodes` | `(shop_id, barcode)` UNIQUE | Scan path |
| `parties` | `(shop_id, name)` | Search |
| `parties` | `(shop_id, phone)` | Lookup |
| `account_transactions` | `(shop_id, account_id, created_at DESC)` | Cash ledger |
| `credit_transactions` | `(shop_id, party_id, created_at DESC)` | Khata |
| `purchase_orders` | `(shop_id, created_at DESC)` | Purchase history |
| `audit_logs` | `(shop_id, created_at DESC)` | Audit UI |
| `journal_lines` | `(shop_id, account_code, entry_date)` | GL reports (as modeled) |
| `product_imeis` | `(shop_id, imei)` UNIQUE | Electronics |
| `kitchen_orders` | `(shop_id, status, created_at)` | KDS |
| `user_profiles` | `(shop_id)` | Staff lists |

### 14.2 Query Guidelines

| Guideline | Detail |
|---|---|
| Always predicate `shop_id` first | Enables index use + tenancy safety |
| Paginate | Default page size 50–100 for products/invoices |
| Avoid N+1 | Join or batch `.in('id', ids)` for child rows |
| Dashboard aggregates | Prefer SQL views/RPCs over shipping all rows |
| Search | `ilike` with prefix where possible; consider `pg_trgm` for name search |
| Heavy reports | Run async or limited date range; never unbounded history on first paint |

### 14.3 Frontend Performance

| Area | Rule |
|---|---|
| POS catalog | Cache products in memory; refresh incremental |
| Images | Lazy load; compressed webp |
| PDF generation | Client jspdf for receipts; don’t block UI thread on large reports without worker |
| Lists | Virtualize when > 200 visible rows (target) |

### 14.4 Connection & Pooling

| Env | Guidance |
|---|---|
| Serverless / many nodes | Use Supabase pooler (transaction mode) carefully with prepared statements |
| VPS Node | PgBouncer in front of PostgreSQL |
| Long jobs | Direct session connection for migrations only |

### 14.5 SLOs (Targets)

| Metric | Target |
|---|---|
| POS product scan → cart add | < 100 ms local cache; < 300 ms network |
| Invoice save online | < 800 ms p95 |
| Dashboard first meaningful paint | < 2.5 s on broadband |
| Offline queue item sync | < 1 s p95 per simple invoice |

---

## 15. Testing Strategy

### 15.1 Test Pyramid

| Layer | Scope | Tools (recommended) | Ownership |
|---|---|---|---|
| **Unit** | Pure helpers, tax math, deal pricing, permissions merge | Vitest / Jest | Dev |
| **Integration** | Supabase RPCs, stock decrement, offline apply RPC | Vitest + test DB | Dev |
| **API** | `/api/pay/*`, upload, authz failures | Supertest / Playwright request | Dev |
| **E2E** | Login → POS sale → khata → report | Playwright | QA + Dev |
| **Offline** | Queue, sync, conflicts | Playwright offline emulation | QA |
| **Vertical smoke** | One golden path per industry | Playwright projects | QA |
| **Load** | POS concurrent sales | k6 / Artillery | DevOps |

### 15.2 Unit Testing Focus

| Module | Cases |
|---|---|
| Tax calculation | Inclusive/exclusive, rounding |
| Packing conversion | Box ↔ piece |
| Dimension pricing | Area / running feet |
| Permission resolver | Intersection of role × plan × profile |
| Restaurant deal pricing | Bundle math |
| EMI schedule generation | Rounding last installment |

### 15.3 Integration Testing Focus

| Flow | Assert |
|---|---|
| Cash invoice | Stock −, cash +, invoice row |
| Credit invoice | Stock −, party balance +, credit_tx |
| PO receive | Stock +, supplier balance if credit |
| Return | Stock +, reverse payment paths |
| Transfer between accounts | Double account_tx, balances match |
| Journal balance constraint | Reject unbalanced entry |
| Offline apply RPC | Atomic multi-table write |

### 15.4 E2E Critical Paths

| ID | Path |
|---|---|
| E2E-01 | Register shop → login → create product → POS cash sale → print |
| E2E-02 | Credit sale → payment on khata → balance zero |
| E2E-03 | Purchase → stock increase → sell → stock decrease |
| E2E-04 | Staff with limited permissions cannot open Accounts |
| E2E-05 | Expired subscription degrades premium UI |
| E2E-06 | Restaurant: table order → KOT → settle → free table |
| E2E-07 | Pharmacy: batch expiry warning path |
| E2E-08 | Electronics: IMEI sale uniqueness |
| E2E-09 | Backup export contains invoices |
| E2E-10 | Super admin can list shops / change plan |

### 15.5 Offline Test Strategy

| Method | Detail |
|---|---|
| Browser offline | Playwright `context.setOffline(true)` |
| Queue inspection | Read `localStorage.hisabx_offline_queue` |
| Conflict injection | Pre-seed stock=0 then sync offline sale of 1 |
| Device matrix | Chrome + Edge on Windows (primary POS OS) |

Use the [Offline Testing Checklist](#127-offline-testing-checklist) as the acceptance suite for offline releases.

### 15.6 Test Data & Environments

| Env | Purpose |
|---|---|
| `local` | Developer + mock flag optional (`NEXT_PUBLIC_USE_MOCK`) |
| `staging` | Full PostgreSQL copy schema; synthetic shops per vertical |
| `prod` | No automated destructive tests |

### 15.7 Definition of Done (Quality)

| Gate | Requirement |
|---|---|
| Unit | New money math covered |
| Integration | Stock/balance flows green on CI |
| E2E smoke | E2E-01 and E2E-02 green before release |
| Offline | Checklist items 1–9 green for POS releases |
| Types | `tsc` clean for touched modules |

---

## 16. Deployment Architecture (VPS + PostgreSQL)

### 16.1 Reference Topology

```
                    ┌──────────── Internet ────────────┐
                    │                                  │
                    ▼                                  ▼
            ┌───────────────┐                  ┌───────────────┐
            │ Reverse Proxy │                  │  Optional CDN │
            │ Nginx / Caddy │                  │  static assets│
            │ TLS termination│                  └───────────────┘
            └───────┬───────┘
                    │
            ┌───────▼───────┐
            │ Next.js Node  │  (PM2 / systemd / Docker)
            │ hisabx-web    │
            └───────┬───────┘
                    │
            ┌───────▼───────┐       ┌──────────────────┐
            │  PgBouncer    │──────▶│ PostgreSQL 16    │
            │  (pooler)     │       │ primary          │
            └───────────────┘       │ + WAL archiving  │
                                    └────────┬─────────┘
                                             │
                                    ┌────────▼─────────┐
                                    │ Object storage    │
                                    │ (local disk / S3) │
                                    └──────────────────┘
```

### 16.2 VPS Sizing Guidance

| Load | vCPU | RAM | Disk | Notes |
|---|---|---|---|---|
| Pilot (< 20 shops) | 2 | 4 GB | 80 GB SSD | Single node OK |
| Growth (< 200 shops) | 4 | 8–16 GB | 200 GB SSD | Split DB if needed |
| Scale | 8+ | 32 GB | 500 GB+ NVMe | App replicas + managed DB |

### 16.3 Process Model

| Process | Command / unit | Notes |
|---|---|---|
| App | `next start -p 3000` under PM2/systemd | Set `NODE_ENV=production` |
| Proxy | Nginx → `127.0.0.1:3000` | TLS certs (Let’s Encrypt) |
| DB | PostgreSQL 16 | Daily dump cron |
| Pooler | PgBouncer | Transaction pooling for web |

### 16.4 Environment Variables

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | API URL (Supabase or Kong/PostgREST gateway) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only admin key (pay/migrate) |
| `DATABASE_URL` | Direct Postgres for migration scripts |
| `NEXT_PUBLIC_USE_MOCK` | Local mock mode |
| `NODE_ENV` | `production` |

> **Security note:** Never commit real service keys. Rotate any keys that appeared in historical source.

### 16.5 Database Deployment Options

| Option | When |
|---|---|
| **A. Supabase hosted** | Fastest ops; Auth + Storage + PostgREST included |
| **B. Self-hosted Supabase stack** | Full control on VPS/K8s |
| **C. Vanilla PostgreSQL + custom API** | Long-term simplification; more eng work |

### 16.6 Release Pipeline

| Stage | Action |
|---|---|
| 1 | PR → lint + typecheck + unit tests |
| 2 | Merge → build Docker or artifact |
| 3 | Run SQL migrations (forward-only) on staging |
| 4 | Smoke E2E on staging |
| 5 | Maintenance window if migration locks |
| 6 | Deploy app; health check `/login` |
| 7 | Monitor error logs 30 min |

### 16.7 Health Checks

| Check | Expect |
|---|---|
| `GET /login` | 200 |
| DB `SELECT 1` | OK |
| Disk usage | < 80% |
| PM2 process | online |
| TLS expiry | > 14 days |

### 16.8 Logging & Observability

| Signal | Sink |
|---|---|
| App logs | journald / PM2 logs → optional Loki |
| DB slow queries | `pg_stat_statements` |
| Uptime | UptimeRobot / better stack |
| Audit | `audit_logs` table |

---

## 17. Security Baseline

| Control | Requirement |
|---|---|
| TLS | Everywhere |
| Secrets | Env only; no client exposure of service role |
| RLS | Enable on all tenant tables; policy by shop membership |
| Admin routes | Server-side role check, not only UI hide |
| Upload | MIME + size + auth |
| Payment callbacks | Verify authenticity; never trust client price alone |
| XSS | React defaults; sanitize any HTML print templates |
| CSRF | Same-site cookies / header checks on mutating API |
| Device limits | Enforce `max_devices` with device registry (target) |
| Superadmin emails | Move allowlist to env/DB config |

---

## 18. Implementation Roadmap (Phased)

Effort estimates assume **1 full-stack engineer** familiar with the codebase. Parallelization can reduce calendar time.

### Phase 0 — Specification Freeze & Hardening Baseline

| Item | Detail |
|---|---|
| **Effort** | 3–5 days |
| **Goals** | Align docs with code; secret hygiene; env templates; CI lint/typecheck |
| **Acceptance criteria** | Secrets removed from repo history plan; `.env.example` complete; CI runs `lint` + `tsc`; this manual reviewed by product owner |

### Phase 1 — AuthZ Completeness & Tenant Safety

| Item | Detail |
|---|---|
| **Effort** | 8–12 days |
| **Goals** | RLS policies; server checks on `/api/*`; permission helpers shared client/server; admin route guard |
| **Acceptance criteria** | Cross-shop select blocked in RLS tests; unauthenticated upload rejected; non-admin `/admin` returns 403; staff panel matrix test passes |

### Phase 2 — Offline Sync Productionization

| Item | Detail |
|---|---|
| **Effort** | 10–15 days |
| **Goals** | `apply_offline_invoice` RPC; payload bundles; dead-letter UI; temp party map; multi-tab lock |
| **Acceptance criteria** | Offline checklist 1–15 pass on staging; no double stock on retry; cross-shop queue isolation proven |

### Phase 3 — Storage & Backup Hardening

| Item | Detail |
|---|---|
| **Effort** | 7–10 days |
| **Goals** | Move receipts to object storage/signed URLs; automated `pg_dump` + restore runbook; backup verification job |
| **Acceptance criteria** | Receipt upload works on 2-node app simulation; restore drill document signed off; Drive backup still works |

### Phase 4 — Accounting Correctness

| Item | Detail |
|---|---|
| **Effort** | 10–14 days |
| **Goals** | Trigger/RPC journal generation; unbalanced journal impossible; closing book report consistency |
| **Acceptance criteria** | Random sample of 100 invoices has matching GL when industrial mode on; closing report ties to trial balance within rounding tolerance |

### Phase 5 — Vertical Parity & QA Pack

| Item | Detail |
|---|---|
| **Effort** | 12–18 days |
| **Goals** | Golden path E2E per vertical; fix schema drift in `database.types.ts`; restaurant offline policy explicit |
| **Acceptance criteria** | E2E-01…E2E-10 green; each vertical Required Tables present in staging migrations; types match DB |

### Phase 6 — Performance & Scale

| Item | Detail |
|---|---|
| **Effort** | 8–12 days |
| **Goals** | Indexes from §14; product pagination everywhere; dashboard RPC aggregates; PgBouncer |
| **Acceptance criteria** | p95 invoice save < 800 ms on staging with 100k invoices; product search < 300 ms; no sequential scans on hot paths in `EXPLAIN` |

### Phase 7 — VPS Production Packaging

| Item | Detail |
|---|---|
| **Effort** | 6–9 days |
| **Goals** | Docker Compose or Ansible; Nginx TLS; PM2; monitoring; migration runbook |
| **Acceptance criteria** | Fresh VPS bootstrap ≤ 1 hour; health checks green; rollback procedure tested once |

### Phase 8 — Growth Features (Post-MVP ERP)

| Item | Detail |
|---|---|
| **Effort** | 15–25 days (split epics) |
| **Goals** | Device registry, multi-branch, deeper AI quotas, WhatsApp templates, advanced payroll |
| **Acceptance criteria** | Per-epic PRD acceptance; plan flags enforce correctly; no regression on POS cash path |

### Roadmap Summary

| Phase | Name | Effort (days) |
|---|---|---|
| 0 | Spec freeze & hygiene | 3–5 |
| 1 | AuthZ & tenant safety | 8–12 |
| 2 | Offline productionization | 10–15 |
| 3 | Storage & backup | 7–10 |
| 4 | Accounting correctness | 10–14 |
| 5 | Vertical parity & QA | 12–18 |
| 6 | Performance & scale | 8–12 |
| 7 | VPS packaging | 6–9 |
| 8 | Growth features | 15–25 |
| **Total (sequential)** | | **~79–120 days** |

---

## 19. Appendix

### 19.1 Key Source Map

| Area | Path |
|---|---|
| Shop session | `src/context/ShopContext.tsx` |
| Sidebar / industry nav | `src/components/dashboard/Sidebar.tsx` |
| Offline engine | `src/lib/sync/syncEngine.ts` |
| DB types | `src/lib/database.types.ts` |
| Restaurant domain | `src/lib/restaurant-orders.ts`, `restaurant-deals.ts` |
| Audit helper | `src/utils/audit.ts` |
| Backup UI | `src/app/dashboard/backup/page.tsx` |
| Payments | `src/app/api/pay/init/route.ts`, `callback/route.ts` |
| Upload | `src/app/api/upload-receipt/route.ts` |
| Enterprise SQL | `enterprise_schema.sql` |
| Restaurant SQL | `restaurant_schema.sql`, `restaurant_full_migration.sql` |
| Fertilizer SQL | `fertilizer_schema.sql` |

### 19.2 Known Gaps / Tech Debt (Non-Exhaustive)

| Gap | Risk | Mitigation phase |
|---|---|---|
| Offline insert not atomic across lines/stock | High | Phase 2 |
| Local disk receipts not multi-instance safe | High on scale-out | Phase 3 |
| API routes weak auth checks | High | Phase 1 |
| `database.types.ts` lagging live schema | Medium | Phase 5 |
| Dual sales models (`sales` vs `invoices`) | Medium | Phase 4–5 |
| Plan matrix vs sidebar tier inconsistencies | Low–Medium | Phase 0 product decision |
| Secrets historically in repo / defaults | Critical | Phase 0 |

### 19.3 Glossary

| Term | Meaning |
|---|---|
| **Khata** | Party credit ledger (AR/AP style running balance) |
| **Karigar** | Tailor workshop craftsman with wage balance |
| **KOT** | Kitchen Order Ticket |
| **KDS** | Kitchen Display System |
| **Closing book** | Fiscal period archive / view switch |
| **Party** | Customer or supplier unified contact |
| **The Accounts** | Go-to-market brand for HisabX |

### 19.4 Document Control

| Version | Date | Notes |
|---|---|---|
| 1.0 | 2026-06 | Initial multi-vertical feature inventory |
| 2.0 | 2026-07 | Enterprise ERP + architecture baseline |
| 2.1 | 2026-07-11 | Added AuthZ, API standards, storage, backup, performance, testing, VPS deploy, DB conventions, offline depth, vertical required tables, phased effort + acceptance criteria |

---

*End of HisabX Enterprise Multi-Vertical POS & ERP Specification Manual v2.1*
