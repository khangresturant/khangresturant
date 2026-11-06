import type { SupabaseClient } from "@supabase/supabase-js";
import { isLocalSqliteEnabled } from "@/lib/config";
import { isFlame9Brand } from "@/lib/deployment/flame9-brand";
import { staffPhone } from "@/lib/restaurant-riders";

export type KitchenTicketLine = {
  product_id: string;
  quantity: number;
  remarks?: string | null;
};

/** Local/mock Supabase has no realtime - poll KDS/KOT screens. */
export function shouldPollKitchenLive(): boolean {
  return (
    isFlame9Brand() ||
    isLocalSqliteEnabled() ||
    process.env.NEXT_PUBLIC_USE_MOCK === "true"
  );
}

export const KITCHEN_POLL_INTERVAL_MS = 4000;

export async function countKitchenTicketsForInvoice(
  supabase: SupabaseClient,
  invoiceId: string
): Promise<number> {
  const { data } = await supabase
    .from("kitchen_orders")
    .select("id")
    .eq("invoice_id", invoiceId)
    .not("status", "eq", "voided");
  return data?.length ?? 0;
}

/** Create a KOT + line items and mark invoice as preparing. */
export async function dispatchKitchenTicket(
  supabase: SupabaseClient,
  params: {
    shopId: string;
    invoiceId: string;
    tableId: string | null;
    waiterId: string | null;
    lines: KitchenTicketLine[];
    stationId?: string | null;
    kitchenHub?: string | null;
  }
): Promise<{ kotId: string }> {
  if (!params.lines.length) {
    throw new Error("No items to send to kitchen.");
  }

  const kotBase = {
    shop_id: params.shopId,
    table_id: params.tableId,
    invoice_id: params.invoiceId,
    status: "cooking" as const,
    waiter_id: params.waiterId,
  };

  let newKot: { id: string } | null = null;
  let kotErr: { message?: string } | null = null;

  ({ data: newKot, error: kotErr } = await supabase
    .from("kitchen_orders")
    .insert({
      ...kotBase,
      ...(params.stationId ? { station_id: params.stationId } : {}),
      ...(params.kitchenHub ? { kitchen_hub: params.kitchenHub } : {}),
    })
    .select("id")
    .single());

  if (
    kotErr &&
    (kotErr.message?.includes("station_id") ||
      kotErr.message?.includes("kitchen_hub") ||
      kotErr.message?.includes("schema cache"))
  ) {
    ({ data: newKot, error: kotErr } = await supabase
      .from("kitchen_orders")
      .insert(kotBase)
      .select("id")
      .single());
  }

  if (kotErr || !newKot?.id) {
    throw new Error(kotErr?.message || "Failed to create kitchen ticket.");
  }

  const { error: itemsErr } = await supabase.from("kitchen_order_items").insert(
    params.lines.map((line) => ({
      kitchen_order_id: newKot!.id,
      product_id: line.product_id,
      quantity: line.quantity,
      remarks: line.remarks || null,
    }))
  );

  if (itemsErr) throw itemsErr;

  // POSRESTURANT: ticket sits in kitchen queue as pending until cook starts.
  await supabase
    .from("invoices")
    .update({ restaurant_order_status: "pending" })
    .eq("id", params.invoiceId);

  return { kotId: newKot.id };
}

/** Load a kitchen ticket for thermal reprint (KDS / order history). */
export async function loadKitchenTicketForPrint(
  supabase: SupabaseClient,
  kitchenOrderId: string
): Promise<{
  kotId: string;
  orderNumber: string | null;
  tableName: string;
  serviceType: string;
  customerName: string | null;
  customerPhone: string | null;
  customerAddress: string | null;
  specialInstructions: string | null;
  waiterName: string | null;
  riderName: string | null;
  riderPhone: string | null;
  items: { name: string; quantity: number; remarks?: string | null; sizeLabel?: string | null }[];
} | null> {
  const { data: ko, error } = await supabase
    .from("kitchen_orders")
    .select(`
      id,
      invoice_id,
      waiter_id,
      restaurant_tables ( name ),
      kitchen_order_items (
        quantity,
        remarks,
        products ( name )
      )
    `)
    .eq("id", kitchenOrderId)
    .maybeSingle();

  if (error || !ko) return null;

  let invoice: {
    order_number?: string | null;
    service_type?: string | null;
    customer_name?: string | null;
    customer_phone?: string | null;
    customer_address?: string | null;
    special_instructions?: string | null;
    waiter_id?: string | null;
    rider_id?: string | null;
  } | null = null;
  if (ko.invoice_id) {
    const { data: inv } = await supabase
      .from("invoices")
      .select(
        "order_number, service_type, customer_name, customer_phone, customer_address, special_instructions, waiter_id, rider_id"
      )
      .eq("id", ko.invoice_id)
      .maybeSingle();
    invoice = inv;
  }

  const waiterId = ko.waiter_id || invoice?.waiter_id;
  let waiterName: string | null = null;
  if (waiterId) {
    const { data: w } = await supabase
      .from("user_profiles")
      .select("name")
      .eq("id", waiterId)
      .maybeSingle();
    waiterName = w?.name || null;
  }

  let riderName: string | null = null;
  let riderPhone: string | null = null;
  if (invoice?.rider_id) {
    const { data: r } = await supabase
      .from("user_profiles")
      .select("name, phone, permissions")
      .eq("id", invoice.rider_id)
      .maybeSingle();
    riderName = r?.name || null;
    riderPhone = staffPhone(r);
  }

  const tableName =
    (ko as { restaurant_tables?: { name?: string } | null }).restaurant_tables?.name ||
    (invoice?.service_type === "delivery"
      ? "Delivery"
      : invoice?.service_type === "takeaway"
        ? "Takeaway"
        : "Counter");

  return {
    kotId: ko.id,
    orderNumber: invoice?.order_number || null,
    tableName,
    serviceType: invoice?.service_type || "takeaway",
    customerName: invoice?.customer_name || null,
    customerPhone: invoice?.customer_phone || null,
    customerAddress: invoice?.customer_address || null,
    specialInstructions: invoice?.special_instructions || null,
    waiterName,
    riderName,
    riderPhone,
    items: (
      (ko as {
        kitchen_order_items?: {
          quantity: number;
          remarks?: string | null;
          products?: { name?: string } | null;
        }[];
      }).kitchen_order_items || []
    ).map((item) => ({
      name: item.products?.name || "Item",
      quantity: Number(item.quantity) || 0,
      remarks: item.remarks || null,
    })),
  };
}

export async function loadLatestKOTForInvoice(
  supabase: SupabaseClient,
  invoiceId: string
): Promise<string | null> {
  const { data } = await supabase
    .from("kitchen_orders")
    .select("id")
    .eq("invoice_id", invoiceId)
    .not("status", "eq", "voided")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data?.id || null;
}
