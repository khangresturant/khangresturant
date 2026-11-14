import "server-only";
import { readTableRows, writeTableRows } from "@/lib/local-sqlite/database";
import { ensureTableSeeded } from "@/lib/local-sqlite/seed";
import { applyPurchaseLineStockWac } from "@/lib/inventory/weighted-average-cost";
import type { ReceivePurchasePayload } from "@/lib/money/types";

function mockUuid(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function tableRows(tableName: string): Record<string, unknown>[] {
  ensureTableSeeded(tableName);
  return readTableRows(tableName) as Record<string, unknown>[];
}

function writeTable(tableName: string, rows: Record<string, unknown>[]): void {
  writeTableRows(tableName, rows);
}

/** Server-side atomic stock-in for local SQLite (mirrors receive_purchase RPC). */
export function receivePurchaseLocal(
  payload: ReceivePurchasePayload & { purchase_order_id?: string | null }
): { purchase_order_id: string; status?: string; ok: boolean; idempotent?: boolean } {
  const shopIdVal = payload.shop_id;
  if (!shopIdVal) throw new Error("shop_id required");

  const poId = payload.purchase_order_id || mockUuid("po");
  const orders = tableRows("purchase_orders");
  if (orders.some((row) => row.id === poId)) {
    return { purchase_order_id: poId, idempotent: true, ok: true, status: payload.status };
  }

  const total = Number(payload.total_amount ?? 0);
  const paid = Number(payload.paid_amount ?? 0);
  const creditAmount = Math.max(0, total - paid);

  orders.push({
    id: poId,
    shop_id: shopIdVal,
    supplier_id: payload.supplier_id ?? null,
    total_amount: total,
    paid_amount: paid,
    discount: Number(payload.discount ?? 0),
    tax_amount: Number(payload.tax_amount ?? 0),
    status: payload.status ?? "PAID",
    payment_mode: payload.payment_mode ?? "cash",
    notes: payload.notes ?? null,
    invoice_number: payload.invoice_number ?? null,
    is_voided: false,
    account_id: paid > 0 ? payload.account_id ?? null : null,
    created_at: new Date().toISOString(),
  });
  writeTable("purchase_orders", orders);

  if (creditAmount > 0 && payload.supplier_id) {
    const parties = tableRows("parties");
    const nextParties = parties.map((party) => {
      if (party.id !== payload.supplier_id) return party;
      const inc = party.type === "dual" ? -creditAmount : creditAmount;
      return { ...party, current_balance: Number(party.current_balance ?? 0) + inc };
    });
    writeTable("parties", nextParties);

    const credits = tableRows("credit_transactions");
    credits.push({
      id: mockUuid("cr"),
      shop_id: shopIdVal,
      customer_id: payload.supplier_id,
      amount: creditAmount,
      transaction_type: "charge",
      remarks: `Purchase Order #${poId.slice(0, 8).toUpperCase()}`,
      created_at: new Date().toISOString(),
    });
    writeTable("credit_transactions", credits);
  }

  if (paid > 0 && payload.account_id) {
    const accounts = tableRows("cash_accounts");
    const nextAccounts = accounts.map((acc) => {
      if (acc.id !== payload.account_id || acc.shop_id !== shopIdVal) return acc;
      return { ...acc, current_balance: Number(acc.current_balance ?? 0) - paid };
    });
    writeTable("cash_accounts", nextAccounts);

    const accTx = tableRows("account_transactions");
    accTx.push({
      id: mockUuid("atx"),
      shop_id: shopIdVal,
      account_id: payload.account_id,
      type: "withdrawal",
      amount: paid,
      ref_type: "purchase",
      ref_id: poId,
      remarks: `Purchase #${poId.slice(0, 8).toUpperCase()}`,
      created_at: new Date().toISOString(),
    });
    writeTable("account_transactions", accTx);
  }

  const poItems = tableRows("purchase_order_items");
  const products = tableRows("products");
  const variants = tableRows("product_variants");

  for (const item of payload.items ?? []) {
    const qty = Number(item.quantity ?? 0);
    const bonus = Number(item.bonus_quantity ?? 0);
    const purchasePrice = Number(item.purchase_price ?? 0);

    poItems.push({
      id: mockUuid("poi"),
      purchase_order_id: poId,
      product_id: item.product_id,
      variant_id: item.variant_id ?? null,
      quantity: qty,
      unit_price: purchasePrice,
      purchase_price: purchasePrice,
      subtotal: purchasePrice * qty,
      bonus_quantity: bonus,
      discount_amount: Number(item.discount_amount ?? 0),
      batch_number: item.batch_number ?? null,
      expiry_date: item.expiry_date ?? null,
    });

    applyPurchaseLineStockWac(item, products, variants);
  }

  writeTable("purchase_order_items", poItems);
  writeTable("products", products);
  writeTable("product_variants", variants);

  return {
    purchase_order_id: poId,
    ok: true,
    status: payload.status,
  };
}

export function localShopExists(shopId: string): boolean {
  const shops = tableRows("shops") as { id?: string }[];
  return shops.some((s) => s.id === shopId);
}
