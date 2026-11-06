import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient, createServiceSupabaseClient } from "@/lib/supabase/server";
import { isSuperAdmin, isSaaSAdmin } from "@/lib/auth/roles";
import { notifySubscriptionActivated } from "@/lib/subscription/notify-subscription-email";

export async function requirePlatformAdmin() {
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

const SHOP_SELECT = `
  id,
  name,
  phone,
  industry_type,
  subscription_tier,
  subscription_expires_at,
  created_at,
  owner_id,
  allow_negative_stock,
  has_emi,
  has_payroll,
  has_tax,
  has_assets_rec,
  has_loyalty,
  referred_by_shop_id
`;

export async function GET() {
  const auth = await requirePlatformAdmin();
  if (!auth.ok) return auth.response;

  try {
    const db = createServiceSupabaseClient();

    const [{ data: shops, error: shopsErr }, { data: profiles, error: profilesErr }] =
      await Promise.all([
        db.from("shops").select(SHOP_SELECT).order("created_at", { ascending: false }),
        db.from("user_profiles").select("id, name, email, role, shop_id, created_at"),
      ]);

    if (shopsErr) throw shopsErr;
    if (profilesErr) throw profilesErr;

    const ownersById = new Map((profiles || []).map((p: any) => [p.id, p]));

    const enriched = (shops || []).map((shop: any) => {
      const owner =
        (shop.owner_id && ownersById.get(shop.owner_id)) ||
        (profiles || []).find(
          (p: any) =>
            p.shop_id === shop.id &&
            ["owner", "superadmin", "admin", "manager"].includes(String(p.role || "").toLowerCase())
        ) ||
        (profiles || []).find((p: any) => p.shop_id === shop.id);

      return {
        ...shop,
        owner: owner
          ? { id: owner.id, name: owner.name, email: owner.email, role: owner.role }
          : null,
      };
    });

    return NextResponse.json({ shops: enriched });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to load shops";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

const ALLOWED_SHOP_FIELDS = new Set([
  "subscription_tier",
  "subscription_expires_at",
  "allow_negative_stock",
  "has_emi",
  "has_payroll",
  "has_tax",
  "has_assets_rec",
  "has_loyalty",
  "industry_type",
  "name",
  "phone",
]);

export async function PATCH(request: NextRequest) {
  const auth = await requirePlatformAdmin();
  if (!auth.ok) return auth.response;

  try {
    const body = await request.json();
    const shopId = body?.shopId as string | undefined;
    const updates = body?.updates as Record<string, unknown> | undefined;

    if (!shopId || !updates || typeof updates !== "object") {
      return NextResponse.json({ error: "shopId and updates are required" }, { status: 400 });
    }

    const sanitized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(updates)) {
      if (ALLOWED_SHOP_FIELDS.has(key)) sanitized[key] = value;
    }

    if (Object.keys(sanitized).length === 0) {
      return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
    }

    const db = createServiceSupabaseClient();
    const { data, error } = await db
      .from("shops")
      .update(sanitized)
      .eq("id", shopId)
      .select(SHOP_SELECT)
      .single();

    if (error) throw error;

    const subscriptionUpdated =
      "subscription_tier" in sanitized || "subscription_expires_at" in sanitized;
    const tier = String(data.subscription_tier || "free");
    const expiry = data.subscription_expires_at;

    if (subscriptionUpdated && tier !== "free" && expiry) {
      const notify = await notifySubscriptionActivated({
        shopId: data.id,
        shopName: data.name,
        planId: tier,
        expiryDate: expiry,
        paymentMethod: "Admin Panel Activation",
      });
      if (!notify.sent) {
        console.warn("[admin/shops PATCH] Subscription updated but email not sent:", notify.error);
      }
    }

    return NextResponse.json({ shop: data, emailSent: subscriptionUpdated ? true : undefined });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to update shop";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
