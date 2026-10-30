"use client";

import type { SupabaseClient } from "@supabase/supabase-js";

/** Matches src/views/fast_food_order_view.py order lifecycle */
export type RestaurantOrderStatus =
  | "pending"
  | "preparing"
  | "ready"
  | "delivered"
  | "bill_printed"
  | "settled"
  | "cancelled";

export type RestaurantPaymentStatus = "pending" | "paid" | "partial" | "unpaid" | "cancelled";

export type RestaurantServiceType = "dining" | "takeaway" | "delivery";

export const RESTAURANT_ORDER_STATUS_LABELS: Record<
  RestaurantOrderStatus,
  { en: string; ur: string; color: string }
> = {
  pending: { en: "Pending", ur: "زیر التوا", color: "bg-slate-100 text-slate-700 border-slate-200" },
  preparing: { en: "Preparing", ur: "تیاری", color: "bg-amber-50 text-amber-800 border-amber-200" },
  ready: { en: "Ready", ur: "تیار", color: "bg-orange-50 text-orange-800 border-orange-200" },
  delivered: { en: "Served", ur: "سرو", color: "bg-violet-50 text-violet-800 border-violet-200" },
  bill_printed: { en: "Bill Printed", ur: "بل پرنٹ", color: "bg-blue-50 text-blue-800 border-blue-200" },
  settled: { en: "Completed", ur: "مکمل", color: "bg-emerald-50 text-emerald-800 border-emerald-200" },
  cancelled: { en: "Cancelled", ur: "منسوخ", color: "bg-red-50 text-red-800 border-red-200" },
};

export const PAYMENT_STATUS_LABELS: Record<string, { en: string; ur: string; color: string }> = {
  pending: { en: "Unpaid", ur: "ادائیگی باقی", color: "bg-amber-50 text-amber-800" },
  paid: { en: "Paid", ur: "ادا شدہ", color: "bg-emerald-50 text-emerald-800" },
  partial: { en: "Partial", ur: "جزوی", color: "bg-blue-50 text-blue-800" },
  unpaid: { en: "Credit", ur: "ادھار", color: "bg-violet-50 text-violet-800" },
  cancelled: { en: "Cancelled", ur: "منسوخ", color: "bg-red-50 text-red-800" },
};

export const RESTAURANT_SERVICE_LABELS: Record<RestaurantServiceType, { en: string; ur: string }> = {
  dining: { en: "Dine-In", ur: "ڈائن ان" },
  takeaway: { en: "Takeaway", ur: "ٹیک اوے" },
  delivery: { en: "Delivery", ur: "ڈیلیوری" },
};

export const ACTIVE_ORDER_STATUSES: RestaurantOrderStatus[] = [
  "pending",
  "preparing",
  "ready",
  "delivered",
  "bill_printed",
];

export const ORDER_STATUS_FLOW: RestaurantOrderStatus[] = [
  "pending",
  "preparing",
  "ready",
  "delivered",
  "bill_printed",
  "settled",
];

export function getPaymentStatus(invoice: {
  status: string;
  restaurant_order_status?: string | null;
}): RestaurantPaymentStatus {
  if (invoice.restaurant_order_status === "cancelled") return "cancelled";
  if (invoice.status === "paid") return "paid";
  if (invoice.status === "partial") return "partial";
  if (invoice.status === "unpaid") return "unpaid";
  return "pending";
}

export function canPrintGuestBill(status: RestaurantOrderStatus | null | undefined): boolean {
  if (!status || status === "cancelled" || status === "settled" || status === "bill_printed") return false;
  return ["pending", "preparing", "ready", "delivered"].includes(status);
}

export function canSettleOrder(status: RestaurantOrderStatus | null | undefined): boolean {
  return status === "bill_printed";
}

/** Order History: mark paid only after guest bill is printed (same as POS settle). */
export function canMarkPaidInHistory(
  orderStatus: RestaurantOrderStatus | null | undefined,
  invoiceStatus: string
): boolean {
  if (invoiceStatus !== "draft") return false;
  if (!orderStatus || orderStatus === "cancelled" || orderStatus === "settled") return false;
  return orderStatus === "bill_printed";
}

/** Daily order number like Python: YYMMDD-001 */
export async function generateDailyOrderNumber(
  supabase: SupabaseClient,
  shopId: string
): Promise<string> {
  const today = new Date();
  const prefix = `${String(today.getFullYear()).slice(2)}${String(today.getMonth() + 1).padStart(2, "0")}${String(today.getDate()).padStart(2, "0")}`;
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString();
  const end = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1).toISOString();

  const { count } = await supabase
    .from("invoices")
    .select("id", { count: "exact", head: true })
    .eq("shop_id", shopId)
    .not("service_type", "is", null)
    .gte("created_at", start)
    .lt("created_at", end);

  const seq = ((count || 0) + 1).toString().padStart(3, "0");
  return `${prefix}-${seq}`;
}

/** Map legacy status values to new ones */
export function normalizeOrderStatus(raw: string | null | undefined): RestaurantOrderStatus | null {
  if (!raw) return null;
  const map: Record<string, RestaurantOrderStatus> = {
    open: "pending",
    in_kitchen: "preparing",
    ready_to_bill: "delivered",
    pending: "pending",
    preparing: "preparing",
    ready: "ready",
    delivered: "delivered",
    bill_printed: "bill_printed",
    settled: "settled",
    cancelled: "cancelled",
  };
  return map[raw] || (raw as RestaurantOrderStatus);
}

export async function syncRestaurantOrderStatus(
  supabase: SupabaseClient,
  invoiceId: string
): Promise<RestaurantOrderStatus | null> {
  const { data: invoice } = await supabase
    .from("invoices")
    .select("restaurant_order_status, status")
    .eq("id", invoiceId)
    .maybeSingle();

  if (!invoice) return null;

  const current = normalizeOrderStatus(invoice.restaurant_order_status);
  if (current === "bill_printed" || current === "settled" || current === "cancelled") {
    return current;
  }
  if (invoice.status !== "draft") {
    return "settled";
  }

  const { data: kots } = await supabase
    .from("kitchen_orders")
    .select("status")
    .eq("invoice_id", invoiceId)
    .not("status", "eq", "voided");

  if (!kots || kots.length === 0) {
    return current || "pending";
  }

  const statuses = kots.map((k) => k.status);
  let next: RestaurantOrderStatus;

  if (statuses.some((s) => s === "cooking")) {
    next = "preparing";
  } else if (statuses.some((s) => s === "ready")) {
    next = "ready";
  } else if (statuses.every((s) => s === "served")) {
    next = "delivered";
  } else {
    next = current || "preparing";
  }

  if (next !== current) {
    await supabase.from("invoices").update({ restaurant_order_status: next }).eq("id", invoiceId);
  }

  return next;
}

export async function updateOrderStatus(
  supabase: SupabaseClient,
  invoiceId: string,
  newStatus: RestaurantOrderStatus
): Promise<void> {
  await supabase
    .from("invoices")
    .update({ restaurant_order_status: newStatus })
    .eq("id", invoiceId);
}

export async function markBillPrinted(
  supabase: SupabaseClient,
  invoiceId: string
): Promise<void> {
  await supabase
    .from("invoices")
    .update({
      restaurant_order_status: "bill_printed",
      bill_printed_at: new Date().toISOString(),
    })
    .eq("id", invoiceId);
}

export async function markOrderSettled(
  supabase: SupabaseClient,
  invoiceId: string
): Promise<void> {
  await supabase
    .from("invoices")
    .update({ restaurant_order_status: "settled" })
    .eq("id", invoiceId);
}

export type SettleRestaurantOrderInput = {
  shopId: string;
  invoiceId: string;
  items: { product_id: string; quantity: number; unit_price: number }[];
  netTotal: number;
  taxAmount: number;
  taxRate: number;
  discount: number;
  paymentMode: "cash" | "card" | "credit";
  receivedAmount: number;
  partyId: string | null;
  accountId: string | null;
  registerSessionId: string | null;
  waiterId?: string | null;
  riderId?: string | null;
  tableId?: string | null;
};

/** Finalize payment — like src FastFoodOrderHistory.mark_order_paid */
export async function settleRestaurantOrder(
  supabase: SupabaseClient,
  input: SettleRestaurantOrderInput
): Promise<void> {
  // Phase 3 policy (RST-05): restaurant settle is online-only (no silent offline queue)
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    throw new Error(
      "Restaurant settlement requires an internet connection. Offline KOT/settle is blocked to protect kitchen and stock accuracy."
    );
  }

  const {
    shopId,
    invoiceId,
    items,
    netTotal,
    taxAmount,
    taxRate,
    discount,
    paymentMode,
    receivedAmount,
    partyId,
    accountId,
    registerSessionId,
    waiterId,
    riderId,
    tableId,
  } = input;

  const { data: invoiceRow } = await supabase
    .from("invoices")
    .select("restaurant_order_status, status")
    .eq("id", invoiceId)
    .maybeSingle();

  if (!invoiceRow) {
    throw new Error("Order not found.");
  }
  if (invoiceRow.status !== "draft") {
    throw new Error("This order is already paid or closed.");
  }
  const orderStatus = normalizeOrderStatus(invoiceRow.restaurant_order_status);
  if (!canSettleOrder(orderStatus)) {
    throw new Error(
      "Restaurant flow: send KOT to kitchen, print the guest bill, then mark paid. Inventory updates on payment."
    );
  }

  const { data: kitchenTickets } = await supabase
    .from("kitchen_orders")
    .select("id")
    .eq("invoice_id", invoiceId)
    .not("status", "eq", "voided");

  if (!kitchenTickets?.length) {
    throw new Error("No kitchen ticket for this order. Send KOT before settlement.");
  }

  const paidAmt = paymentMode === "credit" ? receivedAmount : netTotal;
  const remainingDue = Math.max(0, netTotal - paidAmt);

  await supabase.from("invoice_items").delete().eq("invoice_id", invoiceId);
  if (items.length > 0) {
    await supabase.from("invoice_items").insert(
      items.map((item) => ({
        invoice_id: invoiceId,
        product_id: item.product_id,
        quantity: item.quantity,
        unit_price: item.unit_price,
        subtotal: item.unit_price * item.quantity,
      }))
    );
  }

  const { error: invErr } = await supabase
    .from("invoices")
    .update({
      party_id: partyId,
      total_amount: netTotal,
      discount,
      tax_rate: taxRate,
      tax_amount: taxAmount,
      status: paymentMode === "credit" ? (receivedAmount > 0 ? "partial" : "unpaid") : "paid",
      paid_amount: paidAmt,
      payment_mode: paymentMode,
      register_session_id: registerSessionId,
      account_id: paymentMode !== "credit" ? accountId : null,
      waiter_id: waiterId || null,
      rider_id: riderId || null,
      restaurant_order_status: "settled",
    })
    .eq("id", invoiceId);

  if (invErr) throw invErr;

  for (const item of items) {
    const { data: recipeItems } = await supabase
      .from("product_recipes")
      .select("ingredient_product_id, quantity")
      .eq("parent_product_id", item.product_id);

    if (recipeItems && recipeItems.length > 0) {
      for (const rec of recipeItems) {
        await supabase.rpc("decrement_product_stock", {
          p_id: rec.ingredient_product_id,
          qty: Number(rec.quantity) * item.quantity,
        });
      }
    } else {
      await supabase.rpc("decrement_product_stock", {
        p_id: item.product_id,
        qty: item.quantity,
      });
    }
  }

  if ((paymentMode !== "credit" || paidAmt > 0) && accountId) {
    const { data: acc } = await supabase
      .from("cash_accounts")
      .select("current_balance")
      .eq("id", accountId)
      .maybeSingle();

    if (acc) {
      await supabase
        .from("cash_accounts")
        .update({ current_balance: Number(acc.current_balance || 0) + paidAmt })
        .eq("id", accountId);
    }

    await supabase.from("account_transactions").insert({
      shop_id: shopId,
      account_id: accountId,
      type: "deposit",
      amount: paidAmt,
      ref_type: "invoice",
      ref_id: invoiceId,
      remarks: `Restaurant Order Settlement #${invoiceId.slice(0, 8).toUpperCase()}`,
    });
  }

  if (paymentMode === "credit" && remainingDue > 0 && partyId) {
    await supabase.rpc("increment_party_balance", {
      p_id: partyId,
      amount: remainingDue,
    });

    await supabase.from("credit_transactions").insert({
      shop_id: shopId,
      customer_id: partyId,
      amount: remainingDue,
      transaction_type: "charge",
      remarks: `Credit sale — Restaurant Order #${invoiceId.slice(0, 8).toUpperCase()}`,
    });
  }

  if (tableId) {
    await supabase
      .from("restaurant_tables")
      .update({ active_invoice_id: null, status: "cleaning" })
      .eq("id", tableId);
  }
}

export async function cancelRestaurantOrder(
  supabase: SupabaseClient,
  invoiceId: string,
  tableId?: string | null
): Promise<void> {
  const { data: inv } = await supabase
    .from("invoices")
    .select("status, restaurant_order_status")
    .eq("id", invoiceId)
    .maybeSingle();

  if (inv?.status === "paid") {
    throw new Error("Paid orders cannot be cancelled.");
  }

  await supabase.from("kitchen_orders").update({ status: "voided" }).eq("invoice_id", invoiceId);

  await supabase
    .from("invoices")
    .update({ restaurant_order_status: "cancelled", status: "draft", paid_amount: 0 })
    .eq("id", invoiceId);

  if (tableId) {
    await supabase
      .from("restaurant_tables")
      .update({ active_invoice_id: null, status: "available" })
      .eq("id", tableId);
  }
}
