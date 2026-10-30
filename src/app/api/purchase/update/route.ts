import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { ReceivePurchasePayload } from "@/lib/money/types";

// ─── Standard JSON response helpers ──────────────────────────────────────────

function ok(data: object, status = 200) {
  return NextResponse.json({ success: true, data, timestamp: new Date().toISOString() }, { status });
}

function err(message: string, code: string, status = 400) {
  return NextResponse.json({ success: false, error: { message, code } }, { status });
}

// ─── POST /api/purchase/update ────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  // ── Auth ──────────────────────────────────────────────────────────────────
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (pairs) =>
          pairs.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          ),
      },
    }
  );

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return err("Unauthorized", "UNAUTHORIZED", 401);
  }

  // ── Parse payload ──────────────────────────────────────────────────────────
  let payload: ReceivePurchasePayload;
  try {
    payload = await req.json();
  } catch {
    return err("Invalid JSON body", "INVALID_JSON", 400);
  }

  // ── Validate required fields ───────────────────────────────────────────────
  if (!payload.purchase_order_id) {
    return err("purchase_order_id is required", "MISSING_PO_ID", 400);
  }
  if (!payload.shop_id) {
    return err("shop_id is required", "MISSING_SHOP_ID", 400);
  }
  if (!Array.isArray(payload.items) || payload.items.length === 0) {
    return err("At least one item is required", "EMPTY_ITEMS", 400);
  }
  if (typeof payload.total_amount !== "number" || payload.total_amount < 0) {
    return err("total_amount must be a non-negative number", "INVALID_TOTAL", 400);
  }

  // ── Shop ownership check ───────────────────────────────────────────────────
  const { data: shopRow, error: shopErr } = await supabase
    .from("shops")
    .select("id")
    .eq("id", payload.shop_id)
    .single();

  if (shopErr || !shopRow) {
    return err("Shop not found or access denied", "SHOP_NOT_FOUND", 403);
  }

  // ── Call atomic Postgres function ──────────────────────────────────────────
  const { data, error: rpcErr } = await supabase.rpc("atomic_update_purchase_order", {
    p_payload: {
      purchase_order_id: payload.purchase_order_id,
      shop_id:           payload.shop_id,
      supplier_id:       payload.supplier_id ?? null,
      total_amount:      payload.total_amount,
      paid_amount:       payload.paid_amount ?? 0,
      discount:          payload.discount ?? 0,
      tax_amount:        payload.tax_amount ?? 0,
      status:            payload.status,
      payment_mode:      payload.payment_mode,
      notes:             payload.notes ?? null,
      invoice_number:    payload.invoice_number ?? null,
      account_id:        payload.account_id ?? null,
      items:             payload.items,
    },
  });

  if (rpcErr) {
    const msg = rpcErr.message ?? "atomic_update_purchase_order failed";
    console.error("[/api/purchase/update] RPC error:", msg);
    return err(msg, "RPC_ERROR", 500);
  }

  const result = data as { status: string; purchase_order_id: string; error?: string };
  if (result.status === "failed") {
    return err(result.error || "Update purchase order failed", "UPDATE_FAILED", 400);
  }

  // Product batches update
  try {
    for (const item of payload.items) {
      if (item.batch_number?.trim()) {
        const bNum = item.batch_number.trim();
        const expDate = item.expiry_date || null;
        const totalReceivedQty = (Number(item.quantity) || 0) + (Number(item.bonus_quantity) || 0);

        const { data: existingBatch } = await supabase
          .from("product_batches")
          .select("id, stock_quantity")
          .eq("shop_id", payload.shop_id)
          .eq("product_id", item.product_id)
          .eq("batch_number", bNum)
          .maybeSingle();

        if (existingBatch) {
          if ((existingBatch.stock_quantity || 0) <= 0 && totalReceivedQty > 0) {
            await supabase
              .from("product_batches")
              .update({
                stock_quantity: totalReceivedQty,
                expiry_date: expDate || undefined,
                purchase_price: Number(item.purchase_price) || undefined
              })
              .eq("id", existingBatch.id);
          }
        } else {
          await supabase
            .from("product_batches")
            .insert({
              shop_id: payload.shop_id,
              product_id: item.product_id,
              variant_id: item.variant_id || null,
              batch_number: bNum,
              expiry_date: expDate,
              stock_quantity: totalReceivedQty,
              purchase_price: Number(item.purchase_price) || 0,
              sale_price: item.sale_price ? Number(item.sale_price) : null
            });
        }
      }
    }
  } catch (batchErr) {
    console.warn("[/api/purchase/update] Non-fatal batch sync notice:", batchErr);
  }

  return ok({
    purchase_order_id: result.purchase_order_id,
    status:            result.status,
    updated:           true,
  }, 200);
}
