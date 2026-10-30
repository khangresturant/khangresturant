# 🛒 Hisab X — Grocery Store POS Terminal

> **Full Feature Reference & Technical Implementation Guide**  
> File: `src/app/dashboard/pos/page.tsx`

---

## 📋 Table of Contents

1. [Overview](#overview)
2. [Register Session Management](#register-session-management)
3. [Dual Layout Views](#dual-layout-views)
4. [Product Catalog & Search](#product-catalog--search)
5. [Cart System](#cart-system)
6. [Unit & Packing Variants](#unit--packing-variants)
7. [Price Editing & Purchase Price Guard](#price-editing--purchase-price-guard)
8. [Customer Management](#customer-management)
9. [Checkout & Payment Modes](#checkout--payment-modes)
10. [Held Bills (Bill Suspension)](#held-bills-bill-suspension)
11. [Keyboard Shortcut System](#keyboard-shortcut-system)
12. [Edit Previous Invoice](#edit-previous-invoice)
13. [Receipt & Quotation PDF](#receipt--quotation-pdf)
14. [Real-Time Sync](#real-time-sync)
15. [Cash Account Integration](#cash-account-integration)
16. [Data Types & Architecture](#data-types--architecture)

---

## Overview

The Hisab X POS Terminal is a full-featured, keyboard-driven Point-of-Sale system for grocery stores. It supports:
- Multi-unit products with automatic sub-unit conversions (kg/gram, ltr/ml)
- Manual packing variants per product
- Register sessions (shift management)
- Credit (Udhaar) and split payment support
- Real-time stock sync via Supabase subscriptions
- Bilingual UI (English/Urdu)

---

## Register Session Management

### How it Works
Before any sale can be made, a **cash register session (shift)** must be opened. If no active session exists, the POS locks and shows the "Register is Closed" screen.

### Opening a Session
- User enters an **opening cash float** (optional) and clicks "Open Register & Start Shift".
- A row is inserted into `register_sessions` table with `status: "open"`.
- Opening balance defaults to the last closed session's `closing_balance` (for float continuity).

### Closing a Session
- User clicks **"End Shift"** in the top header.
- A modal opens showing shift sales summary (total invoices, cash/card/credit totals).
- User enters **actual cash counted** and an optional closing note.
- The session row is updated with `status: "closed"`, `closing_balance`, and `closed_at`.

### Technical Implementation
```ts
// Open session
supabase.from("register_sessions").insert({
  shop_id, user_id, opening_balance, status: "open", opened_at
})

// Close session
supabase.from("register_sessions").update({
  closing_balance, closed_at, status: "closed"
}).eq("id", activeSession.id)
```

---

## Dual Layout Views

### Grid Mode (Default)
- Left panel: Product cards in a responsive grid (2/3/4 columns based on screen width)
- Right panel: Checkout Cart with item list and checkout summary
- Supports category filtering and pagination (20 products/page)

### Search Mode (Fast Billing)
- Left panel: Wide table-style cart with a search bar + floating autocomplete dropdown
- Right panel: Checkout summary with customer selection, discount, tax, payment
- Best for high-volume billing where cashier knows product names
- Autocomplete shows top 10 matching products with quick-add packing pills

### Switching Views
- Click the **"Search Mode" / "Grid Mode"** toggle button in the header
- View preference is **persisted** to localStorage keyed by shopId:
  ```ts
  localStorage.setItem(`pos_layout_view_${shopId}`, nextView);
  ```

---

## Product Catalog & Search

### Data Source
Products are fetched from Supabase with related data:
```sql
SELECT id, name, code, unit, sale_price_single, purchase_price_single,
       current_stock, category_id,
       product_barcodes(barcode),
       product_variants(id, packing_name, sale_price, purchase_price, stock_quantity,
         product_barcodes(barcode))
FROM products WHERE shop_id = ?
```

### Search Logic
Searches across:
- Product `name` (partial match)
- Product `code` (partial match)
- Product barcodes
- Variant barcodes

### Barcode / Code Auto-Add (Enter Key)
When user presses `Enter` on the search input:
1. Checks for **exact code match** -> adds base unit directly
2. Checks for **exact barcode match** (product or variant) -> adds matched unit
3. If only **1 result** in filtered list -> auto-adds it (or shows variant modal)

### Category Filtering
- Categories fetched from `categories` table
- Displayed as horizontal scrollable chips
- Filtering is pure client-side (`product.category_id === selectedCategoryId`)

### Pagination
- 20 products per page (PAGE_SIZE = 20)
- `PageUp` / `PageDown` keys navigate pages
- Grid arrow key navigation works within a page

---

## Cart System

### Cart Item Structure
```ts
type CartItem = {
  productId: string;
  variantId?: string;         // undefined = base unit
  name: string;
  packingName?: string;       // display name for variant
  price: number;              // current selling price
  purchasePrice: number;      // cost price (for loss detection)
  quantity: number;
  stock: number;              // max stock for this unit
  isAutoSubunit?: boolean;    // true if computed from unit relations
  conversionFactor?: number;  // e.g. 1000 for g/kg
  unitType?: "multiplier" | "divisor";
};
```

### Adding to Cart
- **Base unit**: `handleAddBaseUnitDirectly(product)` - no variant, uses `sale_price_single`
- **With option (variant/subunit)**: `handleAddProductToCart(product, option)` - uses variant price
- If the same product+variant already exists -> **increments quantity** instead of adding a new row
- Stock checking: if `allowNegativeStock` is false, blocks adding beyond available stock

### Quantity Update
```ts
updateCartQty(index, newQty)
// newQty <= 0 -> removes item
// newQty > item.stock (if !allowNegativeStock) -> blocks with toast warning
```

---

## Unit & Packing Variants

### Two Types of Unit Options

**1. Manual Variants** (`product_variants` table)
- Defined per product: e.g. "Box of 12", "Half Dozen"
- Have their own `sale_price`, `purchase_price`, `stock_quantity`

**2. Auto Sub-Units** (from `units` table relations)
- Based on `parent_unit_id` and `conversion_factor`
- Computed dynamically via `getProductUnitOptions(product)`

### Auto Sub-Unit Calculation
```ts
// Divisor unit: e.g. gram under kg
if (isDivisor) {
  price = product.sale_price_single / factor;        // Rs/kg ÷ 1000 = Rs/g
  stock = product.current_stock * factor;            // kg × 1000 = grams
  purchasePrice = product.purchase_price_single / factor;
}
// Multiplier unit: e.g. box of 12 bags
else {
  price = product.sale_price_single * factor;
  stock = product.current_stock / factor;
  purchasePrice = product.purchase_price_single * factor;
}
```

### Stock Decrement on Checkout
Auto sub-units always decrement the **base product stock**:
```ts
// For auto subunit, convert qty back to base units before decrementing
if (item.unitType === "divisor") {
  qtyToDecrement = item.quantity / item.conversionFactor; // grams -> kg
} else {
  qtyToDecrement = item.quantity * item.conversionFactor; // boxes -> units
}
supabase.rpc("decrement_product_stock", { p_id, qty: qtyToDecrement })
```

### Variant Selection Modal
When a product has variants/subunits and user clicks the card (without choosing a packing pill), a modal opens listing all options including base unit. Keyboard-navigable with Arrow keys, Enter, Esc.

---

## Price Editing & Purchase Price Guard

### Price Edit Mode
A toggle button **"Price Edit: ON/OFF"** appears in the cart header (both Grid and Search views). When enabled, each cart item shows a live number input for the selling price.

### Purchase Price Tracking
Every CartItem stores `purchasePrice` (cost price) fetched from:
- Base unit: `product.purchase_price_single`
- Manual variant: `variant.purchase_price`
- Auto sub-unit: scaled from `product.purchase_price_single` using conversion factor

### Warning: Below Purchase Price (Price Edit)
```ts
// Triggered in updateCartItemPrice()
if (item.purchasePrice > 0 && newPrice < item.purchasePrice) {
  toast.error(
    `Warning: Selling price Rs ${newPrice} is BELOW purchase price 
     Rs ${item.purchasePrice} for "${item.name}"! You will be selling at a loss.`,
    { duration: 5000 }
  );
}
```

### Warning: Below Purchase Price (Discount)
```ts
// Triggered in discount onChange handler
const effectiveTotal = subtotal + taxAmount - newDiscount;
if (totalPurchaseCost > 0 && effectiveTotal < totalPurchaseCost) {
  toast.error(
    `Warning: Discount of Rs ${newDiscount} brings the total (Rs ${effectiveTotal})
     BELOW total purchase cost (Rs ${totalPurchaseCost})! You will be selling at a loss.`,
    { duration: 6000 }
  );
}
```

The warning is **non-blocking** — cashier can override but is clearly informed of the loss.

---

## Customer Management

### Customer Types
- **Walk-in Customer** (default): `selectedCustomerId = "walkin"`, no Khata tracking
- **Registered Customer**: Selected from `parties` table where `type = "customer"`

### Customer Search Dropdown
- Type in the customer search box -> filtered dropdown appears
- Keyboard navigable (Arrow keys, Enter, Esc)
- Shows customer name, phone, and outstanding balance (Khata)

### Add New Customer
- Click **"+ Add New"** button -> modal opens
- Fields: Name, Phone (optional)
- Inserts into `parties` table with `type: "customer"`, `current_balance: 0`
- Immediately selects new customer in the POS

---

## Checkout & Payment Modes

### Payment Modes
| Mode | Behavior |
|------|----------|
| **Cash** | Full payment received, `status: "paid"` |
| **Card** | Full payment received, `status: "paid"` |
| **Credit (Udhaar)** | Partial or zero payment now, remainder goes to Khata |

### Credit / Split Payment
When `paymentMode === "credit"`:
- User can enter **cash paid now** (0 to total)
- Remaining amount = `total - receivedAmount` -> added to customer's `current_balance`
- Invoice status: `unpaid` (0 paid), `partial` (some paid), `paid` (fully paid)

### Totals Calculation
```ts
subtotal = cart.reduce((acc, item) => acc + item.price * item.quantity, 0)
taxAmount = (subtotal * taxRate) / 100
total = Math.max(0, subtotal + taxAmount - discount)
```

### Checkout Process (handleCheckout)
1. Validate: cart not empty, credit must have a named customer
2. Insert/update `invoices` record
3. Insert `invoice_items` rows
4. Decrement stock (variants via RPC, base units via RPC)
5. Update customer Khata balance if credit
6. Update selected cash account balance + log transaction
7. Show receipt modal, reset cart

---

## Held Bills (Bill Suspension)

### Holding a Bill
- Press `F6` or click **"Hold (F6)"** button
- User prompted for a tag/name (e.g. "Table 3", "Customer Ahmed")
- Entire cart state (items, customer, discount, tax, payment mode, received amount) saved to localStorage:
  ```ts
  localStorage.setItem(`held_carts_${shopId}`, JSON.stringify(newCarts))
  ```
- Current cart is cleared

### Resuming a Held Bill
- Press `Alt+R` or click **"Resume (Alt+R)"** button
- Modal shows all held bills with tag, timestamp, item count, and total
- Click Resume -> restores full cart state, removes from held list
- Red badge shows count of held bills

---

## Keyboard Shortcut System

| Key | Action |
|-----|--------|
| `F1` / `Alt+S` | Focus product search bar |
| `F2` / `Alt+C` | Focus customer search |
| `F3` / `Alt+A` | Activate cart focus mode |
| `F4` / `Alt+D` | Focus discount input |
| `F6` | Hold / suspend current bill |
| `F7` / `Alt+T` | Focus tax input |
| `F8` | Cycle payment mode (Cash -> Card -> Credit) |
| `F9` / `Alt+Enter` | Process checkout |
| `F10` / `Alt+K` | Show keyboard shortcuts help |
| `Alt+R` | Open held bills / resume modal |
| `Esc` | Close modals, clear search, exit cart focus |
| `PageUp / PageDown` | Navigate product pages (Grid Mode) |
| Arrow keys | Navigate grid (Grid Mode) |

### Cart Focus Mode (F3)
When activated:
| Key | Action |
|-----|--------|
| `Up / Down` | Select cart item |
| `Left / Right` | Qty -1 / +1 |
| `Enter` or `0-9` | Focus qty input for direct edit |
| `Space / U` | Cycle to next unit/packing |
| `Del / Backspace` | Delete selected item |
| `F3 / Esc / Alt+A` | Exit cart focus |

### Search Mode Autocomplete Navigation
When autocomplete dropdown is open:
| Key | Action |
|-----|--------|
| `Up / Down` | Highlight next/prev product |
| `Enter` | Add highlighted product to cart |
| `Esc` | Close dropdown |

---

## Edit Previous Invoice

### Activation
- Navigate to `/dashboard/pos?edit=<invoiceId>`
- The POS detects the `?edit=` URL parameter and loads the invoice into cart

### Process
1. Load invoice + items from Supabase
2. Rebuild CartItem[] from `invoice_items`
3. Original stock adjustments are **reversed** before re-applying new quantities
4. Original Khata balance is reversed if it was a credit invoice
5. Edit history is maintained in `invoices.edit_history` (JSONB array)
6. After save, URL is cleaned (`window.history.replaceState`)

---

## Receipt & Quotation PDF

### Thermal Receipt Preview
After successful checkout, a simulated thermal receipt modal opens:
- Shows invoice ID, date, customer name, payment mode
- Itemized table with qty and amounts
- Tax, discount, totals
- Print button: replaces page body with receipt HTML and calls `window.print()`

### Quotation PDF (Estimate)
- Generates a **jsPDF** A4 PDF with `jspdf-autotable`
- Labeled as "ESTIMATE / QUOTATION" (not a financial invoice)
- Includes all cart items, subtotal, tax, discount, grand total
- Downloads as `estimate_<timestamp>.pdf`

---

## Real-Time Sync

Uses Supabase Realtime subscriptions:
```ts
supabase.channel(`pos-realtime-${shopId}`)
  .on("postgres_changes", { event: "UPDATE", table: "products" }, fetchData)
  .on("postgres_changes", { event: "*", table: "register_sessions" }, fetchData)
  .subscribe()
```

When stock changes in another session or device, the POS automatically refreshes product data.

---

## Cash Account Integration

- User selects a **cash account** to deposit payment into (from `cash_accounts` table)
- Defaults to the account named "Cash in Hand" if it exists
- On checkout: account balance is incremented and a transaction logged in `account_transactions`:
  ```ts
  {
    type: "deposit",
    amount: cashReceived,
    ref_type: "invoice",
    ref_id: invoiceId,
    remarks: `POS Sale #${invoiceId.slice(0, 8)}`
  }
  ```

---

## Data Types & Architecture

### DBProduct
```ts
{
  id, name, code, unit,
  sale_price_single, purchase_price_single,
  current_stock, category_id,
  product_barcodes: [{ barcode }],
  product_variants: [{
    id, packing_name, sale_price, purchase_price,
    stock_quantity, product_barcodes: [{ barcode }]
  }]
}
```

### CartItem
```ts
{
  productId, variantId?, name, packingName?,
  price,          // current selling price
  purchasePrice,  // cost price for loss detection
  quantity, stock,
  isAutoSubunit?, conversionFactor?, unitType?
}
```

### State Architecture
Single monolithic functional component with grouped useState hooks:
- **Product/catalog state**: products, categories, allUnits, loading
- **Filter state**: searchQuery, selectedCategoryId, page
- **Cart state**: cart, isCartFocused, selectedCartItemIndex
- **Checkout state**: discount, taxRate, paymentMode, receivedAmount
- **Session state**: activeSession, openingFloat, shiftInvoices
- **UI state**: layoutView, allowPriceEdit, isSearchDropdownOpen
- **Modal states**: various isXxxOpen booleans

### Key Computed Values
```ts
const subtotal = cart.reduce((acc, item) => acc + item.price * item.quantity, 0);
const taxAmount = (subtotal * taxRate) / 100;
const total = Math.max(0, subtotal + taxAmount - discount);

// Search autocomplete (memoized)
const autocompleteResults = useMemo(
  () => searchQuery.trim() ? filteredProducts.slice(0, 10) : [],
  [filteredProducts, searchQuery]
);
```

---

*Last Updated: June 2025 | Hisab X POS Terminal v2.0*
