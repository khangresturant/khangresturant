import { NextRequest, NextResponse } from "next/server";
import type { AuthContext } from "@/lib/auth/apiAuth";
import { requireSuperAdmin } from "@/lib/auth/apiAuth";

/** Tables that offline sync may INSERT/UPDATE/DELETE (never arbitrary client names). */
export const SYNC_MUTABLE_TABLES = new Set([
  "products",
  "parties",
  "categories",
  "units",
  "expenses",
  "credit_transactions",
  "cash_accounts",
  "account_transactions",
  "invoice_items",
  "product_variants",
  "product_barcodes",
  "brands",
  "shelves",
  // Showroom Offline Tables
  "showroom_vehicles",
  "showroom_parties",
  "showroom_installments",
  "showroom_installment_schedules",
  "showroom_sales",
  "showroom_investors",
  "showroom_investor_transactions",
  "showroom_rentals",
  "showroom_vehicle_expenses",
]);

export function isSyncTableAllowed(tableName: string): boolean {
  return SYNC_MUTABLE_TABLES.has(tableName);
}

/**
 * Cron jobs: `Authorization: Bearer <CRON_SECRET>` or `?secret=<CRON_SECRET>`.
 * Manual runs: authenticated platform superadmin (admin UI while logged in).
 */
export async function authorizeCronOrSuperAdmin(
  req: NextRequest
): Promise<{ ok: true } | { ok: false; response: NextResponse }> {
  const cronSecret = process.env.CRON_SECRET?.trim();
  if (cronSecret) {
    const authHeader = req.headers.get("authorization");
    const bearer =
      authHeader?.startsWith("Bearer ") ? authHeader.slice(7).trim() : null;
    const querySecret = new URL(req.url).searchParams.get("secret")?.trim();
    if (bearer === cronSecret || querySecret === cronSecret) {
      return { ok: true };
    }
  }

  const admin = await requireSuperAdmin();
  if (admin.ok) return { ok: true };

  if (!cronSecret) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          error: {
            code: "FORBIDDEN",
            message:
              "Cron access denied. Set CRON_SECRET for scheduled jobs or sign in as platform admin.",
          },
        },
        { status: 403 }
      ),
    };
  }

  return { ok: false, response: admin.response };
}

/** Allowed image extensions for admin QR uploads. */
export const ADMIN_UPLOAD_EXTENSIONS = new Set(["png", "jpg", "jpeg", "webp", "gif"]);

export function sanitizeUploadBasename(name: string): string {
  return name.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 64) || "upload";
}
