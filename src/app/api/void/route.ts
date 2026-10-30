import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// ─── POST /api/void ───────────────────────────────────────────────────────────
// Atomically voids an invoice and reverses all stock movements.
// Calls atomic_void_invoice PostgreSQL stored procedure.

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

  // ── Parse body ────────────────────────────────────────────────────────────
  let invoiceId: string, reason: string;
  try {
    const body = await req.json();
    invoiceId = body.invoice_id;
    reason    = body.reason || "Voided by operator";
    if (!invoiceId) throw new Error("invoice_id is required.");
  } catch (e: any) {
    return NextResponse.json(
      { success: false, data: null, error: { code: "INVALID_PAYLOAD", message: e.message }, timestamp },
      { status: 400 }
    );
  }

  // ── Call atomic void RPC ──────────────────────────────────────────────────
  const { data: rpcData, error: rpcError } = await supabase.rpc("atomic_void_invoice", {
    p_invoice_id: invoiceId,
    p_reason:     reason,
  });

  if (rpcError) {
    const msg  = rpcError.message || "";
    const code = msg.includes("INVOICE_NOT_FOUND") ? "INVOICE_NOT_FOUND"
               : msg.includes("ALREADY_VOIDED")    ? "ALREADY_VOIDED"
               : "VOID_FAILED";

    return NextResponse.json(
      { success: false, data: null, error: { code, message: msg }, timestamp },
      { status: 422 }
    );
  }

  if (rpcData?.status === "failed") {
    return NextResponse.json(
      {
        success: false, data: null,
        error: { code: "VOID_RPC_FAILED", message: rpcData.error || "Unknown RPC error." },
        timestamp,
      },
      { status: 422 }
    );
  }

  return NextResponse.json({
    success: true,
    data: { invoice_id: invoiceId, status: "voided" },
    error: null,
    timestamp,
  });
}
