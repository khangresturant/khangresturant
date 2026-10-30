import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { isSyncTableAllowed } from "@/lib/auth/apiSecurity";

interface SyncEvent {
  id: number;
  action:
    | "INSERT"
    | "UPDATE"
    | "DELETE"
    | "CHECKOUT"
    | "VOID"
    | "PURCHASE"
    | "PARTY_PAYMENT";
  tableName: string;
  payload: any;
  timestamp: string;
  retryCount: number;
  status: "pending" | "synced" | "dead";
  shopId?: string;
}

interface SyncResult {
  event_id: number;
  status: "synced" | "dead" | "skipped" | "pending";
  error?: string;
}

const MAX_RETRY_COUNT = 5;

async function resolveUserShopIds(
  supabase: any,
  userId: string
): Promise<{ activeShopId: string | null; allowed: Set<string> }> {
  const { data: profile } = await supabase
    .from("user_profiles")
    .select("shop_id, role")
    .eq("id", userId)
    .maybeSingle();

  const allowed = new Set<string>();
  if (profile?.shop_id) allowed.add(profile.shop_id);

  const { data: memberships } = await supabase
    .from("user_shops")
    .select("shop_id")
    .eq("user_id", userId);

  for (const m of memberships || []) {
    if (m.shop_id) allowed.add(m.shop_id);
  }

  return {
    activeShopId: profile?.shop_id || null,
    allowed,
  };
}

export async function POST(req: NextRequest) {
  const timestamp = new Date().toISOString();
  const cookieStore = await cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            /* Server Component context */
          }
        },
      },
    }
  );

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json(
      {
        success: false,
        data: null,
        error: {
          code: "UNAUTHORIZED",
          message: "Authentication required.",
        },
        timestamp,
      },
      { status: 401 }
    );
  }

  const { activeShopId, allowed } = await resolveUserShopIds(supabase, user.id);
  if (!activeShopId && allowed.size === 0) {
    return NextResponse.json(
      {
        success: false,
        data: null,
        error: {
          code: "MISSING_TENANT_ID",
          message: "User has no shop assignment.",
        },
        timestamp,
      },
      { status: 400 }
    );
  }

  let events: SyncEvent[];
  let bodyShopId: string | null = null;
  try {
    const body = await req.json();
    events = body.events;
    bodyShopId = body.shop_id || null;
    if (!events || !Array.isArray(events)) throw new Error("events must be an array");
  } catch (e: any) {
    return NextResponse.json(
      {
        success: false,
        data: null,
        error: { code: "INVALID_PAYLOAD", message: e.message },
        timestamp,
      },
      { status: 400 }
    );
  }

  // Session shop for this flush (prefer client-declared active shop if allowed)
  const sessionShopId =
    bodyShopId && allowed.has(bodyShopId)
      ? bodyShopId
      : activeShopId || [...allowed][0];

  const results: SyncResult[] = [];

  for (const event of events) {
    const { id: eventId, action, tableName, payload, retryCount } = event;
    const eventShopId =
      event.shopId || payload?.shop_id || sessionShopId || null;

    if (retryCount >= MAX_RETRY_COUNT) {
      results.push({
        event_id: eventId,
        status: "dead",
        error: `Max retries (${MAX_RETRY_COUNT}) exceeded.`,
      });
      continue;
    }

    // Cross-shop isolation: never apply another shop's payload
    if (!eventShopId || !allowed.has(eventShopId)) {
      results.push({
        event_id: eventId,
        status: "skipped",
        error: `Shop isolation: event shop ${eventShopId} not allowed for user.`,
      });
      continue;
    }

    if (sessionShopId && eventShopId !== sessionShopId) {
      results.push({
        event_id: eventId,
        status: "skipped",
        error: `Shop isolation: event belongs to ${eventShopId}, session is ${sessionShopId}.`,
      });
      continue;
    }

    // Normalize tenant — never rewrite to a different shop
    if (action === "CHECKOUT" && payload.invoice) {
      payload.invoice.shop_id = eventShopId;
      payload.invoice.updated_at = new Date().toISOString();
    } else {
      payload.shop_id = eventShopId;
      payload.updated_at = new Date().toISOString();
    }

    if (payload.client_meta || action === "CHECKOUT") {
      const clientMeta = payload.client_meta || payload.side_effects?.client_meta || {};
      const updatedMeta = {
        ...clientMeta,
        synced_at: timestamp,
        is_offline_creation: true,
      };
      if (payload.side_effects) {
        payload.side_effects.client_meta = updatedMeta;
      } else {
        payload.client_meta = updatedMeta;
      }
    }

    try {
      if (action === "CHECKOUT") {
        if (!payload.invoice || !payload.items || !payload.payment) {
          throw new Error("Invalid checkout event payload: missing invoice, items, or payment nested structures.");
        }

        const r2 = await supabase.rpc("atomic_pos_checkout", {
          p_invoice: payload.invoice,
          p_items: payload.items,
          p_payment: payload.payment,
        });

        if (r2.error || r2.data?.status === "failed") {
          throw new Error(r2.error?.message || r2.data?.error || "CHECKOUT_RPC_FAILED");
        }

        results.push({ event_id: eventId, status: "synced" });
        continue;
      }


      if (action === "VOID") {
        let r = await supabase.rpc("void_invoice", {
          p_invoice_id: payload.invoice_id,
        });
        if (r.error) {
          r = await supabase.rpc("atomic_void_invoice", {
            p_invoice_id: payload.invoice_id,
            p_reason: payload.reason || "Offline void",
          });
        }
        if (r.error || r.data?.status === "failed") {
          throw new Error(r.error?.message || r.data?.error || "VOID_RPC_FAILED");
        }
        results.push({ event_id: eventId, status: "synced" });
        continue;
      }

      if (action === "PURCHASE") {
        const r = await supabase.rpc("receive_purchase", {
          p_payload: payload,
        });
        if (r.error) throw new Error(r.error.message);
        results.push({ event_id: eventId, status: "synced" });
        continue;
      }

      if (action === "PARTY_PAYMENT") {
        const r = await supabase.rpc("apply_party_payment", {
          p_payload: payload,
        });
        if (r.error) throw new Error(r.error.message);
        results.push({ event_id: eventId, status: "synced" });
        continue;
      }

      if (
        action === "INSERT" ||
        action === "UPDATE" ||
        action === "DELETE"
      ) {
        if (!isSyncTableAllowed(tableName)) {
          results.push({
            event_id: eventId,
            status: "skipped",
            error: `Table "${tableName}" is not allowed for offline sync.`,
          });
          continue;
        }
      }

      if (tableName === "invoice_items" && payload.product_id) {
        const { data: prod } = await supabase
          .from("products")
          .select("id")
          .eq("id", payload.product_id)
          .maybeSingle();

        if (!prod) {
          results.push({
            event_id: eventId,
            status: "dead",
            error: `Product ${payload.product_id} missing. Cannot insert invoice item.`,
          });
          continue;
        }
      }

      if (
        tableName === "parties" &&
        action === "UPDATE" &&
        payload.current_balance !== undefined
      ) {
        const { data: currentParty } = await supabase
          .from("parties")
          .select("current_balance")
          .eq("id", payload.id)
          .single();

        if (currentParty) {
          payload.current_balance = Number(currentParty.current_balance || 0);
        }
      }

      if (action === "INSERT") {
        const { error } = await supabase.from(tableName).upsert(payload, { onConflict: "id" });
        if (error) throw new Error(error.message);
      } else if (action === "UPDATE") {
        const { error } = await supabase
          .from(tableName)
          .update(payload)
          .eq("id", payload.id);
        if (error) throw new Error(error.message);
      } else if (action === "DELETE") {
        let { error } = await supabase
          .from(tableName)
          .update({ deleted_at: new Date().toISOString() })
          .eq("id", payload.id);
        if (error && error.message.includes("deleted_at")) {
          const hardDel = await supabase.from(tableName).delete().eq("id", payload.id);
          error = hardDel.error;
        }
        if (error) throw new Error(error.message);
      }

      results.push({ event_id: eventId, status: "synced" });
    } catch (err: any) {
      const willDie = retryCount + 1 >= MAX_RETRY_COUNT;
      results.push({
        event_id: eventId,
        status: willDie ? "dead" : "pending",
        error: err.message,
      });
    }
  }

  const syncedCount = results.filter((r) => r.status === "synced").length;
  const deadCount = results.filter((r) => r.status === "dead").length;
  const retryCount = results.filter((r) => r.status === "pending").length;
  const skippedCount = results.filter((r) => r.status === "skipped").length;

  return NextResponse.json({
    success: true,
    data: {
      synced: syncedCount,
      dead: deadCount,
      retry: retryCount,
      skipped: skippedCount,
      results,
    },
    error: null,
    timestamp,
  });
}
