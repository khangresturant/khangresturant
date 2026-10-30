import { NextResponse } from "next/server";
import type { User } from "@supabase/supabase-js";
import { createServerSupabaseClient, createServiceSupabaseClient } from "@/lib/supabase/server";
import { isSuperAdmin } from "@/lib/auth/roles";

export type AuthContext = {
  user: User;
  shopId: string | null;
  role: string | null;
  isSuperAdmin: boolean;
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>;
};

export type AuthResult =
  | { ok: true; ctx: AuthContext }
  | { ok: false; response: NextResponse };

/**
 * Require a valid Supabase session for an API route.
 * Loads user_profiles for shop_id + role.
 */
export async function requireApiUser(): Promise<AuthResult> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "Authentication required." } },
        { status: 401 }
      ),
    };
  }

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("shop_id, role")
    .eq("id", user.id)
    .maybeSingle();

  const role = profile?.role ?? null;
  const shopId = profile?.shop_id ?? null;
  const superAdmin = isSuperAdmin({ role, email: user.email });

  return {
    ok: true,
    ctx: {
      user,
      shopId,
      role,
      isSuperAdmin: superAdmin,
      supabase,
    },
  };
}

/**
 * Resolve the tenant shop for an authenticated API call.
 * Prefers an explicit shop id when the caller has access; otherwise profile shop.
 */
export async function resolveApiShopId(
  ctx: AuthContext,
  preferredShopId?: string | null
): Promise<{ shopId: string } | { error: NextResponse }> {
  const timestamp = new Date().toISOString();

  if (preferredShopId) {
    const access = await requireShopAccess(ctx, preferredShopId);
    if (!access.ok) return { error: access.response };
    return { shopId: preferredShopId };
  }

  if (ctx.shopId) {
    return { shopId: ctx.shopId };
  }

  const { data: membership } = await ctx.supabase
    .from("user_shops")
    .select("shop_id")
    .eq("user_id", ctx.user.id)
    .limit(1)
    .maybeSingle();

  if (membership?.shop_id) {
    return { shopId: membership.shop_id };
  }

  return {
    error: NextResponse.json(
      {
        success: false,
        data: null,
        error: { code: "MISSING_TENANT_ID", message: "Shop assignment missing." },
        timestamp,
      },
      { status: 400 }
    ),
  };
}

/** Require authenticated user AND superadmin role. */
export async function requireSuperAdmin(): Promise<AuthResult> {
  const result = await requireApiUser();
  if (!result.ok) return result;
  if (!result.ctx.isSuperAdmin) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: { code: "FORBIDDEN", message: "Superadmin access required." } },
        { status: 403 }
      ),
    };
  }
  return result;
}

/**
 * Ensure the caller may act on a shop:
 * - superadmin: any shop
 * - otherwise: profile.shop_id or membership in user_shops
 */
export async function requireShopAccess(
  ctx: AuthContext,
  targetShopId: string | null | undefined
): Promise<AuthResult> {
  if (!targetShopId) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: { code: "BAD_REQUEST", message: "shopId is required." } },
        { status: 400 }
      ),
    };
  }

  if (ctx.isSuperAdmin) {
    return { ok: true, ctx };
  }

  if (ctx.shopId === targetShopId) {
    return { ok: true, ctx };
  }

  const { data: membership } = await ctx.supabase
    .from("user_shops")
    .select("shop_id")
    .eq("user_id", ctx.user.id)
    .eq("shop_id", targetShopId)
    .maybeSingle();

  if (membership?.shop_id) {
    return { ok: true, ctx };
  }

  return {
    ok: false,
    response: NextResponse.json(
      { error: { code: "FORBIDDEN", message: "No access to this shop." } },
      { status: 403 }
    ),
  };
}

export { createServiceSupabaseClient };
