import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isSuperAdmin } from "@/lib/auth/roles";
import { usesLocalDatabase } from "@/lib/config";

/**
 * Next.js 16 Proxy (formerly middleware).
 * - Refreshes Supabase session cookies
 * - Requires auth for /dashboard/*
 * - Requires superadmin for /admin/*
 * - Leaves public routes open
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

  if (usesLocalDatabase()) {
    return response;
  }

  if (!url || !anonKey) {
    return response;
  }

  const pathname = request.nextUrl.pathname;
  const isDashboard = pathname.startsWith("/dashboard");
  const isAdmin = pathname.startsWith("/admin");
  const isRegisterPage = pathname === "/register";
  const isLoginPage = pathname === "/login";
  const isAuthPage = isLoginPage || isRegisterPage;

  /** Local SQLite uses cookie/session auth, not Supabase JWT cookies. */
  if (usesLocalDatabase() && (isDashboard || isAdmin || isAuthPage)) {
    return response;
  }

  // Legacy mock-only flag (kept for compatibility)
  const isLocalFlame9Mode =
    process.env.NEXT_PUBLIC_USE_MOCK === "true" ||
    process.env.NEXT_PUBLIC_USE_LOCAL_SQLITE === "true" ||
    process.env.NEXT_PUBLIC_BRAND === "flame9";

  if (isLocalFlame9Mode && (isDashboard || isAdmin || isAuthPage)) {
    return response;
  }

  // 1. Session Cookie Check
  // If there are no auth-token cookies, we are definitely unauthenticated.
  // We can skip the expensive remote network request to Supabase Auth.
  const cookiesList = request.cookies.getAll();
  const hasSessionCookie = cookiesList.some(c => c.name.includes("auth-token"));

  if (!hasSessionCookie) {
    if (isDashboard || isAdmin) {
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = "/login";
      redirectUrl.searchParams.set("next", pathname);
      return NextResponse.redirect(redirectUrl);
    }
    return response;
  }

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });
        response = NextResponse.next({
          request: {
            headers: request.headers,
          },
        });
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
    global: {
      fetch: (input, init) => {
        return fetch(input, {
          ...init,
          signal: init?.signal || AbortSignal.timeout(10000),
        });
      },
    },
  });

  // Fast-path: If user already has cached shop verification cookie and session cookie,
  // let dashboard routes proceed quickly without blocking on remote auth server roundtrips
  const cachedHasShop =
    request.cookies.get("theaccounts_has_shop")?.value === "true" ||
    request.cookies.get("The Accounts_has_shop")?.value === "true";
  const cachedUserRole =
    request.cookies.get("theaccounts_user_role")?.value ||
    request.cookies.get("The Accounts_user_role")?.value;

  if (cachedHasShop && isDashboard && !isAdmin) {
    return response;
  }

  // Validate JWT with Auth server
  let user = null;
  let isExplicitAuthFailure = false;

  try {
    const { data, error } = await supabase.auth.getUser();
    if (data?.user) {
      user = data.user;
    } else if (error) {
      // Only mark as explicit failure if auth server confirmed invalid token (401/403)
      if ((error as any).status === 401 || (error as any).status === 403) {
        isExplicitAuthFailure = true;
      }
    }
  } catch (err: any) {
    // Network / timeout error (e.g. AbortError, TimeoutError)
    // If we have cached session, do NOT destroy cookies or block the user
    if (cachedHasShop) {
      return response;
    }
    user = null;
  }

  if (!user && isExplicitAuthFailure) {
    // Session token confirmed expired or invalid by server
    response.cookies.delete("theaccounts_has_shop");
    response.cookies.delete("theaccounts_user_role");
    response.cookies.delete("The Accounts_has_shop");
    response.cookies.delete("The Accounts_user_role");
    cookiesList.forEach(c => {
      if (c.name.includes("auth-token") || c.name.startsWith("sb-")) {
        response.cookies.delete(c.name);
      }
    });

    if (isDashboard || isAdmin) {
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = "/login";
      redirectUrl.searchParams.set("next", pathname);
      return NextResponse.redirect(redirectUrl);
    }
    return response;
  }

  // 2. Resolve shop mapping and role
  let hasShop = cachedHasShop;
  let userRole = cachedUserRole;
  let profile = null;

  if (user && (!hasShop || !userRole)) {
    try {
      const { data } = await supabase
        .from("user_profiles")
        .select("shop_id, role")
        .eq("id", user.id)
        .maybeSingle();
      profile = data;
      if (profile?.shop_id) {
        hasShop = true;
        response.cookies.set("theaccounts_has_shop", "true", { maxAge: 60 * 60 * 24 * 7, path: "/" });
        if (profile.role) {
          userRole = profile.role;
          response.cookies.set("theaccounts_user_role", profile.role, { maxAge: 60 * 60 * 24 * 7, path: "/" });
        }
      }
    } catch {
      // If DB fails, fallback to existing state
    }
  }

  // Case 1: Authenticated but has NO shop
  if (user && !hasShop) {
    if (!isRegisterPage) {
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = "/register";
      redirectUrl.search = "";
      const redirectResp = NextResponse.redirect(redirectUrl);
      redirectResp.cookies.set("theaccounts_has_shop", "false", { path: "/" });
      return redirectResp;
    }
    return response;
  }

  // Case 2: Authenticated and has shop
  if (isLoginPage) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/dashboard";
    redirectUrl.search = "";
    return NextResponse.redirect(redirectUrl);
  }

  // Protect admin specifically (must be superadmin)
  if (isAdmin) {
    let currentRole = userRole;
    if (!currentRole && profile) {
      currentRole = profile.role;
    }
    
    if (!user || !isSuperAdmin({ role: currentRole, email: user.email })) {
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = "/dashboard";
      redirectUrl.searchParams.set("error", "admin_forbidden");
      return NextResponse.redirect(redirectUrl);
    }
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match app routes that need session refresh / auth gates.
     * Exclude static assets and public receipt media.
     */
    "/dashboard/:path*",
    "/admin/:path*",
    "/login",
    "/register",
  ],
};
