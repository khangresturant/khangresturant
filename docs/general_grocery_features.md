# 🏪 HISAB X — General Grocery & General Retail Store
## Complete Implemented Features Reference

> **Version:** June 2025
> **Covers:** Karyana (Grocery) Store + General Retail Store
> **Both stores share:** Purchase Panel, POS/Sale Panel, Khata, Reports, Accounts

---

## 📋 Table of Contents

1. [Store Types Overview](#1-store-types-overview)
2. [Products Module](#2-products-module)
3. [Packing & Bulk Purchase System](#3-packing--bulk-purchase-system)
4. [Packing Variations Module](#4-packing-variations-module-general-store)
5. [Barcode Printing Module](#5-barcode-printing-module-general-store)
6. [Purchase Panel (Shared)](#6-purchase-panel-shared)
7. [POS / Sale Panel (Karyana)](#7-pos--sale-panel-karyana)
8. [POS / Sale Panel (General Retail)](#8-pos--sale-panel-general-retail)
9. [Keyboard Shortcuts](#9-keyboard-shortcuts)
10. [Stock Management Logic](#10-stock-management-logic)
11. [Database Schema Reference](#11-database-schema-reference)

---

## 1. Store Types Overview

| Feature | Karyana (Grocery) | General Retail |
|---------|-------------------|----------------|
| Route | /dashboard/karyana | /dashboard/general |
| Products Page | /dashboard/products | /dashboard/general/products |
| Base Unit | kg, litre, pcs, etc. | Pieces (pcs) only |
| Packing System | Gatta / Bori (weight-based) | Box / Multi-Pack (piece-based) |
| Variations | Unit-based (sub-units: gram, ml) | Name-based (Box of 12, etc.) |
| Barcode Module | Shared | /dashboard/general/barcodes |
| Purchase Page | Shared /dashboard/purchase | Shared /dashboard/purchase |
| POS | /dashboard/pos | /dashboard/general/cards |

---

## 2. Products Module

### 2.1 Karyana Products (dashboard/products)
File: src/app/dashboard/products/page.tsx

#### Product Type (Database Fields)
- id, name, code
- unit — base unit: "kg", "litre", "pcs", etc.
- sale_price_single — price per base unit (e.g. Rs 100/kg)
- purchase_price_single — purchase price per base unit
- current_stock — stock in base units
- min_stock_level — low stock alert threshold
- category_id, brand_id
- shelf_location, note
- pack_size — units per bulk packing (e.g. 50 for Gatta of 50kg)
- purchase_price_pack — purchase price per packing (e.g. Rs 5000/Gatta)
- sale_price_pack — sale price per packing

#### Tabs
1. Products Catalog — Main product list with search
2. Categories — Manage categories (add / edit / delete)
3. Brands & Companies — Manage brands (add / edit / delete)

#### Product List Table Columns
| Column | Description |
|--------|-------------|
| Product Name | Name + shelf location + packing badge if enabled |
| Barcode/Code | Product code |
| Category | Badge chip |
| Brand/Company | Brand name |
| Purchase Price | Per base unit |
| Sale Price | Per base unit |
| Stock | Colored badge: Out / Low / OK |
| Actions | Edit / Delete |

#### Add/Edit Product Modal — Field Order
1. Product Name
2. Barcode / Code + Base Unit (grid)
3. Has Bulk Packing? (Gatta/Bori system — amber styled card)
4. Purchase Price / unit + Sale Price / unit (auto-filled from packing)
5. Opening Stock (in base unit, label shows unit name) + Low Stock Alert Level
6. Category + Brand (with Quick Add inline)
7. Shelf Location (optional)
8. Product Note (optional)
9. Packing Variations & Barcodes (custom secondary packings)

#### Statistics Banner
- Total Products count
- Out of Stock count
- Low Stock Alert count
- Total Inventory Value (purchase_price x stock)

---

### 2.2 General Store Products (dashboard/general/products)
File: src/app/dashboard/general/products/page.tsx

#### Key Differences from Karyana
- NO Base Unit field (general store sells by pieces only)
- Box / Multi-Pack packing is piece-count based (e.g. Box of 12 pieces)
- Opening Stock label: "Opening Stock (Pieces / Units)" — no unit selector
- Packing card appears after Barcode, with BLUE styling (vs amber for karyana)

#### Product Type (Database Fields)
- id, name, code
- sale_price_single — price per piece
- purchase_price_single — purchase cost per piece
- current_stock — stock in pieces
- min_stock_level
- category_id, brand_id, shelf_location, note
- pack_size — pieces per box/pack
- purchase_price_pack — purchase price per box
- sale_price_pack — sale price per box

#### Add/Edit Product Modal — Field Order
1. Product Name
2. Barcode / Code
3. Has Box / Multi-Pack Packing? (blue-styled card)
4. Purchase Price / piece + Sale Price / piece (auto-filled)
5. Opening Stock (Pieces) + Low Stock Alert Level
6. Category + Brand (with Quick Add)
7. Shelf Location
8. Note
9. Packing Variations & Barcodes

---

## 3. Packing & Bulk Purchase System

### 3.1 Karyana — Gatta / Bori System

Purpose: Karyana items bought in bulk (Gatta of 50kg sugar). This lets you manage bulk purchase pricing while POS and inventory stay in base units.

#### How It Works
Enter: Gatta = 50 kg, Purchase Price = Rs 5000
Auto-calculated: purchase_price_single = 5000 / 50 = Rs 100/kg
Stored in DB: pack_size=50, purchase_price_pack=5000
A product_variant is saved with: is_packing=true, pack_size=50

#### Fields (when "Has Bulk Packing?" is checked)
| Field | Description |
|-------|-------------|
| Packing Name | e.g. Gatta, Bori, Drum, Box |
| KG per Packing | How many base units in 1 packing (e.g. 50) |
| Packing Purchase Price | Rs per packing |
| Packing Sale Price | Rs per packing (for whole-packing sales) |
| Packing Barcode | Optional, for scanner |
| Info hint | Shows: "Purchase = Rs 100 / kg" (auto-calculated) |

#### Auto-Calculation Logic
When Packing Purchase Price changes:
  purchase_price_single = boxPurchasePrice / boxPackSize

When Units per Packing changes:
  purchase_price_single = boxPurchasePrice / newPackSize
  sale_price_single = boxSalePrice / newPackSize

#### Packing Badge in Product List
Products with packing enabled show: "📦 Packing: 50 kg/pack"

#### Stock Management Example
- Buying 2 Gattay: Stock += 2 × 50 = 100 kg
- Selling 2 kg via POS: Stock -= 2 = 98 kg
- Selling 1 Gatta via POS: Stock -= 50 = 48 kg

---

### 3.2 General Store — Box / Multi-Pack System

Purpose: General retail items come in boxes (Box of 12, Carton of 24).

#### Fields (when "Has Box / Multi-Pack Packing?" is checked)
| Field | Description |
|-------|-------------|
| Box / Pack Name | e.g. Box, Carton, Dozen |
| Pieces per Box | How many pieces in 1 box (e.g. 12) |
| Box Purchase Price | Rs per box |
| Box Sale Price | Rs per box |
| Box Barcode | Optional |
| Info hint | Shows: "Purchase = Rs 25 / piece" |

#### Auto-Calculation Logic (Same as Karyana but in pieces)
purchase_price_single = boxPurchasePrice / boxPackSize
sale_price_single = boxSalePrice / boxPackSize

#### Stock Management Example
- Buying 3 Boxes (12 pcs each): Stock += 3 × 12 = 36 pieces
- Selling 5 pieces via POS: Stock -= 5 = 31 pieces
- Selling 1 Box via POS: Stock -= 12 = 19 pieces

---

## 4. Packing Variations Module (General Store)

Route: /dashboard/general/variations
File: src/app/dashboard/general/variations/page.tsx

### Purpose
Manage multiple packing types per product. Example biscuit may come in:
- Individual piece
- Pack of 6
- Box of 24
- Carton of 144

Each variation has its own Packing Name, Purchase Price, Sale Price, Stock Qty, Barcode.

### In the Product Modal (Variations Section)
| Field | Description |
|-------|-------------|
| Packing Name | e.g. Box, Carton, Half Dozen |
| Purchase Price | Cost for this packing |
| Sale Price | Selling price for this packing |
| Stock Qty | Opening stock for this packing |
| Barcode | Scan-ready barcode |
| Add Button | Adds to variations list |

### Variations Table
| Column | Data |
|--------|------|
| Packing Name | Bold |
| Barcode | Monospace |
| Purchase Price | Rs amount |
| Sale Price | Rs amount (blue) |
| Stock | Quantity |
| Actions | Delete |

---

## 5. Barcode Printing Module (General Store)

Route: /dashboard/general/barcodes
File: src/app/dashboard/general/barcodes/page.tsx

### Features
- Search products by name or code
- Select base product or specific variation
- Choose barcode type: Code128 or EAN-13
- Set number of copies to print
- Print barcode labels in browser

---

## 6. Purchase Panel (Shared)

Route: /dashboard/purchase
File: src/app/dashboard/purchase/page.tsx
Used by: Both Karyana and General Retail stores

### Tabs
1. New Purchase — Current purchase entry
2. History — Past purchase orders

### Product Search (Left Panel)
- Search by name, code, or barcode (F1 / Alt+S)
- Floating dropdown: top 10 matches
- Each result: Name, Code, Stock, Purchase Rate
- Navigate with arrow keys, Enter to add, Esc to close
- Category filter chips

### Packing Variant Popup
When a product has packing variants, pressing Enter opens a popup:
"Which Packing are you buying?"

Options shown:
- Base Unit (kg/pcs) — Unit name, purchase price, current stock
- Gatta (50 kg) — Pack name, pack price, packs in stock
- Navigate: Up/Down arrows, Enter to confirm, Esc to cancel

### Purchase Cart (Right Panel)

#### Cart Item Fields (Editable)
| Field | Shortcut | Description |
|-------|----------|-------------|
| Product Name | — | Read-only |
| Packing | — | Shows variant name if applicable |
| Purchase Rate (Rs) | -> from cart | Edit purchase price |
| Sale Rate (Rs) | -> next | Edit sale price |
| Quantity | -> next | Edit quantity |
| Remove | Del | Remove from cart |

### Supplier Selection (F2 / Alt+U)
- Dropdown with all registered suppliers
- Add new supplier inline
- Walk-in purchase option (no supplier)

### Payment Summary
| Field | Description |
|-------|-------------|
| Subtotal | Sum of all items |
| Tax % | Optional tax |
| Discount | Fixed deduction |
| Grand Total | Final payable |
| Payment Mode | Cash / Bank / Credit |
| Paid Now | Amount paid |
| Remaining | Amount owed to supplier |
| Account | Cash account to debit |
| Invoice # | Optional invoice number |
| Notes | Optional notes |

### Payment Modes
| Mode | Behavior |
|------|----------|
| Cash | Full paid, debits cash account |
| Bank | Full paid, debits bank account |
| Credit | Partial/zero, remainder added to supplier Khata |

### Save Purchase (F9 / Alt+Enter)

#### For Base Unit Purchase
new_stock = old_stock + qty
new_price = weighted_avg(old_stock, old_price, qty, new_price)
Updates: products.current_stock, products.purchase_price_single

#### For Packing Variant Purchase (is_packing = true)
base_units_added = qty x pack_size
new_base_stock = old_base_stock + base_units_added
price_per_unit = purchase_price / pack_size
new_base_price = weighted_avg(...)
Updates: products.current_stock + purchase_price_single
Also Updates: product_variants.stock_quantity + purchase_price

#### For Independent Variant (is_packing = false)
new_variant_stock = old_variant_stock + qty
new_variant_price = weighted_avg(...)
Updates: product_variants.stock_quantity, purchase_price

### Purchase History Tab
| Column | Description |
|--------|-------------|
| Date | Purchase date/time |
| Invoice # | PO number |
| Supplier | Name or "Cash Purchase" |
| Items | Number of line items |
| Total | Grand total |
| Paid | Amount paid |
| Status | PAID / PARTIAL / CREDIT badge |
| Actions | View Detail / Void |

### Keyboard Shortcuts (Purchase Panel)
| Key | Action |
|-----|--------|
| F1 / Alt+S | Focus product search |
| F2 / Alt+U | Open supplier selector |
| F3 / Alt+A | Activate cart mode |
| F4 / Alt+D | Focus discount input |
| F7 / Alt+T | Focus tax input |
| F8 | Cycle payment mode |
| F9 / Alt+Enter | Save purchase |
| F10 / Alt+K | Show shortcuts help |
| Esc | Close modals / exit cart mode |

---

## 7. POS / Sale Panel (Karyana)

Route: /dashboard/pos
File: src/app/dashboard/pos/page.tsx

### Session Management (Register Shift)
- Must open a cash register session before selling
- Enter opening float -> start shift
- End shift: enter actual cash counted, optional note
- Session summary: total sales, cash/card/credit breakdown

### Dual Layout Views
- Grid Mode: Product cards grid (left) + cart (right)
- Search Mode: Wide table cart + search dropdown + checkout
- Preference saved to localStorage per shop

### Product Search & Add
- Search by name, code, barcode
- Barcode scan -> exact match auto-adds to cart
- Category filter chips
- Grid pagination (20 per page, PageUp/PageDown)

### Unit & Packing Selection Popup
When product has options, a popup shows:

| Option | Example |
|--------|---------|
| Base Unit | kg — Rs 100/kg, Stock: 200 kg |
| Gatta (50 kg) | Rs 5500/Gatta, 4 Gattay in stock |
| Gram (auto sub-unit) | Rs 0.10/g |

Navigate: Up/Down arrows, Enter to confirm, Esc to cancel

### Cart Features
- Same product + same unit -> quantity increments
- Stock limit enforced (unless allowNegativeStock enabled)
- Price edit mode (toggle ON/OFF)
- Purchase price guard: warns if selling below cost
- Discount guard: warns if total below cost

### Payment & Checkout
- Modes: Cash / Card / Credit (Udhaar)
- Credit: partial payment allowed, remaining -> customer Khata
- Cash account selection
- Receipt modal (thermal-style) after checkout
- Quotation PDF (jsPDF) estimate generation

### Held Bills (F6)
- Hold current cart with a tag name
- Resume from held bill list (Alt+R)
- Stored in localStorage

### Edit Previous Invoice
- Navigate to ?edit=<invoiceId>
- Stock changes reversed then re-applied
- Edit history tracked in invoice JSONB

---

## 8. POS / Sale Panel (General Retail)

Route: /dashboard/general/cards
File: src/app/dashboard/general/cards/page.tsx

### Key Differences from Karyana POS
- No register session (no shift management required)
- No sub-unit auto-conversion (no gram/ml calculations)
- Piece-based selling with packing variants
- Same keyboard shortcut system

### Packing Variant Popup (Sale)
"Which packing are you selling?"
- Base Unit (piece)
- Box of 12
- Carton of 24
Navigate: Up/Down arrows, Enter to confirm, Esc to cancel

### Stock Decrement Rules
- Base unit: products.current_stock -= qty
- Packing variant (is_packing=true): products.current_stock -= qty x pack_size
- Independent variant: product_variants.stock_quantity -= qty

### Payment & Checkout
- Cash / Bank / Credit modes
- Credit -> customer Khata
- Receipt generation
- Same cart keyboard shortcuts as purchase panel

---

## 9. Keyboard Shortcuts

### Full Reference

| Key | Purchase Panel | POS (Karyana) | General POS |
|-----|----------------|----------------|-------------|
| F1 / Alt+S | Focus search | Focus search | Focus search |
| F2 / Alt+U | Supplier selector | — | — |
| F2 / Alt+C | — | Customer selector | Customer selector |
| F3 / Alt+A | Cart focus mode | Cart focus mode | Cart focus mode |
| F4 / Alt+D | Discount input | Discount input | Discount input |
| F5 | — | Toggle Grid/Search view | Toggle view |
| F6 | — | Hold bill | — |
| F7 / Alt+T | Tax input | Tax input | Tax input |
| F8 | Cycle payment mode | Cycle payment mode | Cycle payment |
| F9 / Alt+Enter | Save purchase | Checkout | Checkout |
| F10 / Alt+K | Shortcuts help | Shortcuts help | Shortcuts help |
| Alt+R | — | Resume held bill | — |
| PageUp/Down | — | Grid pagination | Grid pagination |
| Esc | Close / exit | Close / exit | Close / exit |

### Cart Focus Mode (F3) — All Panels
| Key | Action |
|-----|--------|
| Up/Down | Select item |
| -> | Move to rate/price field |
| -> again | Next field (sale rate, qty) |
| <- | Go back |
| Del / Backspace | Remove item |
| Esc / F3 | Exit cart mode |

---

## 10. Stock Management Logic

### Weighted Average Cost (WAC)
Used whenever a new purchase is made:

new_avg_cost = (old_stock x old_price + new_qty x new_price) / (old_stock + new_qty)

Applied to:
- products.purchase_price_single (base unit)
- product_variants.purchase_price (variant)

### Stock Decrement Rules (Sale)

| Sold As | Stock Change |
|---------|-------------|
| Base Unit | products.current_stock -= qty |
| Auto Sub-unit (e.g. gram) | products.current_stock -= qty / factor (500g = -0.5 kg) |
| Auto Multiplier (e.g. box of 12) | products.current_stock -= qty x factor |
| Packing Variant (is_packing=true) | products.current_stock -= qty x pack_size |
| Independent Variant | product_variants.stock_quantity -= qty |

### Stock Increment Rules (Purchase)

| Bought As | Stock Change |
|-----------|-------------|
| Base Unit | products.current_stock += qty |
| Packing Variant (is_packing=true) | products.current_stock += qty x pack_size AND product_variants.stock_quantity += qty |
| Independent Variant | product_variants.stock_quantity += qty |

---

## 11. Database Schema Reference

### products Table (Key Columns)
- id — UUID
- shop_id — UUID
- name — TEXT
- code — TEXT (barcode/SKU)
- unit — TEXT (kg, litre, pcs — karyana only)
- sale_price_single — NUMERIC (per base unit)
- purchase_price_single — NUMERIC (per base unit, weighted avg)
- current_stock — NUMERIC (in base units)
- min_stock_level — NUMERIC
- category_id — UUID -> categories
- brand_id — UUID -> brands
- shelf_location — TEXT
- note — TEXT
- pack_size — NUMERIC (units per bulk packing)
- purchase_price_pack — NUMERIC (purchase price per bulk pack)
- sale_price_pack — NUMERIC (sale price per bulk pack)

### product_variants Table
- id — UUID
- product_id — UUID -> products
- shop_id — UUID
- packing_name — TEXT (e.g. "Gatta (50 kg)", "Box of 12")
- purchase_price — NUMERIC
- sale_price — NUMERIC
- stock_quantity — NUMERIC
- is_packing — BOOLEAN (true = bulk packing linked to base stock)
- pack_size — NUMERIC (base units per this packing)

### product_barcodes Table
- id — UUID
- product_id — UUID -> products
- variant_id — UUID -> product_variants (nullable)
- shop_id — UUID
- barcode — TEXT

### purchase_orders Table
- id — UUID
- shop_id — UUID
- supplier_id — UUID -> parties (nullable)
- total_amount — NUMERIC
- paid_amount — NUMERIC
- discount — NUMERIC
- tax_amount — NUMERIC
- status — TEXT (PAID | PARTIAL | CREDIT)
- payment_mode — TEXT (cash | bank | credit)
- notes — TEXT
- invoice_number — TEXT
- is_voided — BOOLEAN
- account_id — UUID -> cash_accounts

### purchase_order_items Table
- id — UUID
- purchase_order_id — UUID -> purchase_orders
- product_id — UUID -> products
- variant_id — UUID -> product_variants (nullable)
- quantity — NUMERIC
- unit_price — NUMERIC
- purchase_price — NUMERIC
- subtotal — NUMERIC

### invoices Table
- id — UUID
- shop_id — UUID
- customer_id — UUID -> parties (nullable)
- subtotal, tax_amount, discount, total — NUMERIC
- paid_amount — NUMERIC
- status — TEXT (paid | partial | unpaid)
- payment_mode — TEXT (cash | card | credit)
- account_id — UUID -> cash_accounts
- edit_history — JSONB

### invoice_items Table
- id — UUID
- invoice_id — UUID -> invoices
- product_id — UUID -> products
- variant_id — UUID -> product_variants (nullable)
- name — TEXT
- unit_label — TEXT (display name)
- price — NUMERIC (selling price)
- purchase_price — NUMERIC (cost, for profit calc)
- quantity — NUMERIC
- subtotal — NUMERIC

---

## Important Notes

KARYANA & GENERAL STORE ARE SEPARATE:
Changes to /dashboard/products (karyana) do NOT affect /dashboard/general/products and vice versa.
They are completely independent pages with separate code.

PURCHASE PANEL IS SHARED:
The same purchase page at /dashboard/purchase is used by both stores.

PACKING VARIANT POPUP:
Appears in both purchase and sale panels whenever a product has product_variants with is_packing=true.
Fully keyboard navigable with Up/Down arrows, Enter to select, Esc to cancel.

VOID PURCHASE DOES NOT REVERSE STOCK:
Stock corrections must be done manually via the product edit modal if a purchase is voided.

---

Last Updated: June 2025 | Hisab X v2.0
