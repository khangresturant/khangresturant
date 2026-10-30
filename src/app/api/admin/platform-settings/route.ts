import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient, createServiceSupabaseClient } from "@/lib/supabase/server";
import { isSuperAdmin, isSaaSAdmin } from "@/lib/auth/roles";
import { getPlatformShopId } from "@/lib/config";

async function requirePlatformAdmin() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return { ok: false as const, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  const allowed =
    isSaaSAdmin(user.email) || isSuperAdmin({ role: profile?.role, email: user.email });

  if (!allowed) {
    return { ok: false as const, response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }

  return { ok: true as const, user };
}

/**
 * Ensures the platform shop row exists in `shops` table before inserting/updating `company_details`.
 */
async function ensurePlatformShopExists(db: ReturnType<typeof createServiceSupabaseClient>, platformShopId: string) {
  const { data: existingShop } = await db
    .from("shops")
    .select("id")
    .eq("id", platformShopId)
    .maybeSingle();

  if (!existingShop) {
    const { error: insertShopErr } = await db.from("shops").insert({
      id: platformShopId,
      name: "The Accounts SaaS Platform",
      industry_type: "general",
      subscription_tier: "premium",
      subscription_expires_at: new Date(Date.now() + 3650 * 24 * 60 * 60 * 1000).toISOString(),
    });
    if (insertShopErr) {
      console.error("Error creating platform shop record:", insertShopErr);
    }
  }
}

export async function GET() {
  const auth = await requirePlatformAdmin();
  if (!auth.ok) return auth.response;

  try {
    const platformShopId = getPlatformShopId();
    if (!platformShopId) {
      return NextResponse.json({ error: "NEXT_PUBLIC_PLATFORM_SHOP_ID is not configured." }, { status: 500 });
    }

    const db = createServiceSupabaseClient();
    await ensurePlatformShopExists(db, platformShopId);

    const { data: companyDetails } = await db
      .from("company_details")
      .select("id, website")
      .eq("shop_id", platformShopId)
      .maybeSingle();

    let config: Record<string, any> = {};
    if (companyDetails?.website && companyDetails.website.startsWith("{")) {
      try {
        config = JSON.parse(companyDetails.website);
      } catch (e) {}
    }

    return NextResponse.json({ config });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to load platform settings" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await requirePlatformAdmin();
  if (!auth.ok) return auth.response;

  try {
    const platformShopId = getPlatformShopId();
    if (!platformShopId) {
      return NextResponse.json({ error: "NEXT_PUBLIC_PLATFORM_SHOP_ID is not configured." }, { status: 500 });
    }

    const body = await req.json();
    const db = createServiceSupabaseClient();

    // 1. Ensure platform shop exists in `shops` table to satisfy Foreign Key constraint
    await ensurePlatformShopExists(db, platformShopId);

    // 2. Fetch existing config
    const { data: existingCompany } = await db
      .from("company_details")
      .select("id, website")
      .eq("shop_id", platformShopId)
      .maybeSingle();

    let currentConfig: Record<string, any> = {};
    if (existingCompany?.website && existingCompany.website.startsWith("{")) {
      try {
        currentConfig = JSON.parse(existingCompany.website);
      } catch (e) {}
    }

    // 3. Merge new fields
    const updatedConfig = { ...currentConfig, ...body };

    // 4. Save to `company_details`
    if (existingCompany?.id) {
      const { error: updateErr } = await db
        .from("company_details")
        .update({ website: JSON.stringify(updatedConfig) })
        .eq("id", existingCompany.id);
      if (updateErr) throw updateErr;
    } else {
      const { error: insertErr } = await db
        .from("company_details")
        .insert({
          shop_id: platformShopId,
          name: "The Accounts SaaS Platform",
          website: JSON.stringify(updatedConfig),
        });
      if (insertErr) throw insertErr;
    }

    return NextResponse.json({ success: true, config: updatedConfig });
  } catch (err: any) {
    console.error("Failed to update platform settings:", err);
    return NextResponse.json({ error: err.message || "Failed to save platform settings" }, { status: 500 });
  }
}
