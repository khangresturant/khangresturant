import type { SupabaseClient } from "@supabase/supabase-js";
import { isLocalSqliteEnabled } from "@/lib/config";
import { isFlame9Brand } from "@/lib/deployment/flame9-brand";

export type KitchenTicketLine = {
  product_id: string;
  quantity: number;
  remarks?: string | null;
};

/** Local/mock Supabase has no realtime — poll KDS/KOT screens. */
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

  await supabase
    .from("invoices")
    .update({ restaurant_order_status: "preparing" })
    .eq("id", params.invoiceId);

  return { kotId: newKot.id };
}
