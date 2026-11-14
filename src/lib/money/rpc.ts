import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  PartyPaymentPayload,
  PosCheckoutPayload,
  PosCheckoutResult,
  ReceivePurchasePayload,
} from "./types";

/**
 * Feature flag: set NEXT_PUBLIC_USE_MONEY_RPCS=false to fall back to legacy multi-step writes.
 * Default: enabled (true).
 */
export function isMoneyRpcEnabled(): boolean {
  return process.env.NEXT_PUBLIC_USE_MONEY_RPCS !== "false";
}

function rpcErrorMessage(error: { message?: string; details?: string; hint?: string }): string {
  const parts = [error.message, error.details, error.hint].filter(Boolean);
  return parts.join(" - ") || "Money RPC failed";
}

async function parseMoneyApiJson(res: Response): Promise<Record<string, unknown> | null> {
  const text = await res.text();
  if (!text.trim()) return null;
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    throw new Error(`Server returned invalid JSON (HTTP ${res.status})`);
  }
}

async function receivePurchaseViaSupabaseRpc(
  supabase: SupabaseClient,
  payload: ReceivePurchasePayload
): Promise<{ purchase_order_id: string; ok?: boolean; idempotent?: boolean }> {
  const { data, error } = await supabase.rpc("receive_purchase", { p_payload: payload });
  if (error) throw new Error(rpcErrorMessage(error));
  const row = (data ?? {}) as { purchase_order_id?: string; idempotent?: boolean };
  return {
    purchase_order_id: row.purchase_order_id ?? payload.purchase_order_id ?? "",
    ok: true,
    idempotent: row.idempotent,
  };
}

export async function posCheckout(
  supabase: SupabaseClient,
  payload: PosCheckoutPayload
): Promise<PosCheckoutResult> {
  const res = await fetch("/api/checkout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  
  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.error?.message || "Checkout failed");
  }
  
  return {
    invoice_id: json.data?.invoice_id,
    created_at: json.timestamp || new Date().toISOString(),
    status: "completed",
  } as PosCheckoutResult;
}



export async function voidInvoiceRpc(
  supabase: SupabaseClient,
  invoiceId: string,
  reason = "Voided by operator"
): Promise<{ invoice_id: string; voided?: boolean; already_voided?: boolean }> {
  // ── Primary path: /api/void (atomic_void_invoice - stock + credit reversal) ──
  try {
    const res = await fetch("/api/void", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ invoice_id: invoiceId, reason }),
    });
    const json = await res.json();
    if (res.ok && json.success) {
      return { invoice_id: invoiceId, voided: true };
    }
    // Surface structured error codes (ALREADY_VOIDED, INVOICE_NOT_FOUND)
    if (json?.error?.code === "ALREADY_VOIDED") {
      return { invoice_id: invoiceId, already_voided: true };
    }
    throw new Error(json?.error?.message || "VOID_API_FAILED");
  } catch (apiErr: any) {
    // If the fetch itself failed (network error / route not deployed yet), fall back
    if (apiErr.message === "VOID_API_FAILED" || apiErr.message?.includes("ALREADY_VOIDED")) {
      throw apiErr; // real error - don't swallow
    }
    console.warn("[voidInvoiceRpc] /api/void unavailable, falling back to void_invoice RPC:", apiErr.message);
  }

  // ── Fallback: original void_invoice Supabase RPC ─────────────────────────
  const { data, error } = await supabase.rpc("void_invoice", {
    p_invoice_id: invoiceId,
  });
  if (error) throw new Error(rpcErrorMessage(error));
  return data as any;
}


export async function restoreInvoiceRpc(
  supabase: SupabaseClient,
  invoiceId: string
): Promise<{ invoice_id: string; restored?: boolean; already_active?: boolean }> {
  const { data, error } = await supabase.rpc("restore_invoice", {
    p_invoice_id: invoiceId,
  });
  if (error) throw new Error(rpcErrorMessage(error));
  return data as any;
}

export async function applyPartyPaymentRpc(
  supabase: SupabaseClient,
  payload: PartyPaymentPayload
): Promise<{ transaction_id: string; ok: boolean }> {
  const { data, error } = await supabase.rpc("apply_party_payment", {
    p_payload: payload,
  });
  if (error) throw new Error(rpcErrorMessage(error));
  return data as any;
}

export async function receivePurchaseRpc(
  supabase: SupabaseClient,
  payload: ReceivePurchasePayload
): Promise<{ purchase_order_id: string; ok?: boolean; idempotent?: boolean }> {
  try {
    const res = await fetch("/api/purchase/receive", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(payload),
    });

    const json = await parseMoneyApiJson(res);
    if (!json) {
      return receivePurchaseViaSupabaseRpc(supabase, payload);
    }

    if (!res.ok || !json.success) {
      const errBody = json.error as { message?: string } | undefined;
      throw new Error(errBody?.message || "Purchase receiving failed");
    }

    const data = json.data as { purchase_order_id?: string } | undefined;
    return {
      purchase_order_id: data?.purchase_order_id ?? payload.purchase_order_id ?? "",
      ok: true,
    };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("invalid JSON") || msg.includes("Empty response") || msg.includes("Failed to fetch")) {
      return receivePurchaseViaSupabaseRpc(supabase, payload);
    }
    throw e instanceof Error ? e : new Error(msg);
  }
}

/**
 * Atomic update of an existing purchase order.
 * Reverses previous stock/accounting and applies updated items/totals atomically.
 */
export async function updatePurchaseRpc(
  _client: SupabaseClient,
  payload: ReceivePurchasePayload
): Promise<{ purchase_order_id: string; ok?: boolean; updated?: boolean }> {
  const res = await fetch("/api/purchase/update", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const json = await parseMoneyApiJson(res);
  if (!json) {
    throw new Error("Empty response from purchase update API");
  }
  if (!res.ok || !json.success) {
    const errBody = json.error as { message?: string } | undefined;
    throw new Error(errBody?.message || "Purchase update failed");
  }

  const data = json.data as { purchase_order_id?: string } | undefined;
  return {
    purchase_order_id: data?.purchase_order_id ?? payload.purchase_order_id ?? "",
    ok: true,
    updated: true,
  };
}

