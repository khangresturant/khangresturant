import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// ─── POST /api/checkout ───────────────────────────────────────────────────────
// Atomically creates invoice + items + stock_movements + credit update
// via a single PostgreSQL stored procedure (atomic_pos_checkout).
// All-or-nothing: if any part fails, the full transaction is rolled back.

export async function POST(req: NextRequest) {
  const timestamp = new Date().toISOString();
  const cookieStore = await cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch { /* server context */ }
        },
      },
    }
  );

  // ── Auth ──────────────────────────────────────────────────────────────────
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json(
      { success: false, data: null, error: { code: "UNAUTHORIZED", message: "Authentication required." }, timestamp },
      { status: 401 }
    );
  }

  // Query active shop_id from user_profiles table first
  const { data: profile } = await supabase
    .from("user_profiles")
    .select("shop_id")
    .eq("id", user.id)
    .maybeSingle();

  const shopId = profile?.shop_id || user.app_metadata?.shop_id;
  if (!shopId) {
    return NextResponse.json(
      { success: false, data: null, error: { code: "MISSING_TENANT_ID", message: "No shop assignment on user." }, timestamp },
      { status: 400 }
    );
  }

  // ── Parse & validate body ─────────────────────────────────────────────────
  let invoice: any, items: any[], payment: any;
  try {
    const body = await req.json();
    invoice = body.invoice;
    items   = body.items;
    payment = body.payment;

    if (!invoice?.id || !Array.isArray(items) || items.length === 0) {
      throw new Error("Missing invoice, items, or payment fields.");
    }
  } catch (e: any) {
    return NextResponse.json(
      { success: false, data: null, error: { code: "INVALID_PAYLOAD", message: e.message }, timestamp },
      { status: 400 }
    );
  }

  // Force server-side tenant scope
  invoice.shop_id = shopId;

  // ── Call atomic RPC ───────────────────────────────────────────────────────
  const { data: rpcData, error: rpcError } = await supabase.rpc("atomic_pos_checkout", {
    p_invoice: invoice,
    p_items:   items,
    p_payment: payment,
  });

  if (rpcError) {
    // Parse structured errors from the RPC RAISE EXCEPTION message
    const msg = rpcError.message || "";
    const code = msg.startsWith("INSUFFICIENT_STOCK")
      ? "INSUFFICIENT_STOCK"
      : "CHECKOUT_FAILED";

    return NextResponse.json(
      { success: false, data: null, error: { code, message: msg }, timestamp },
      { status: 422 }
    );
  }

  if (rpcData?.status === "failed") {
    return NextResponse.json(
      {
        success: false, data: null,
        error: { code: "CHECKOUT_RPC_FAILED", message: rpcData.error || "Unknown RPC error." },
        timestamp,
      },
      { status: 422 }
    );
  }

  // ── Optional: register with FBR if credentials are configured ────────────
  let fbrQrCode: string | null = null;
  if (process.env.FBR_POS_ID && process.env.FBR_AUTH_TOKEN) {
    try {
      const fbrRes = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL ? req.nextUrl.origin : ""}/api/fbr`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", Cookie: req.headers.get("cookie") || "" },
          body: JSON.stringify({
            invoiceNumber: invoice.id,
            invoiceDate:   new Date().toISOString(),
            totalAmount:   invoice.total_amount,
            totalTaxAmount: invoice.tax_amount || 0,
            items: items.map((i: any) => ({
              itemCode:    i.product_id,
              itemName:    i.name || "Item",
              quantity:    i.quantity,
              pcPrice:     i.unit_price,
              totalAmount: i.quantity * i.unit_price,
              taxRate:     0,
              taxAmount:   0,
            })),
          }),
        }
      );
      const fbrJson = await fbrRes.json();
      fbrQrCode = fbrJson?.data?.qrCodeUrl || null;
    } catch {
      // FBR failure is non-blocking — invoice is already committed
    }
  }

  return NextResponse.json({
    success: true,
    data: {
      invoice_id: rpcData?.invoice_id || invoice.id,
      fbr_qr_code: fbrQrCode,
    },
    error: null,
    timestamp,
  });
}
