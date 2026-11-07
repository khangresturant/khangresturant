"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Outfit } from "next/font/google";
import { motion } from "framer-motion";
import {
  Eye,
  EyeOff,
  Loader2,
  UtensilsCrossed,
  Tv,
  ShieldCheck,
  ArrowRight,
  ArrowLeft,
} from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { isLocalSqliteEnabled } from "@/lib/config";
import { FLAME9_LOCAL_LOGINS } from "@/lib/local-sqlite/seed-data";
import { persistLocalAuthCookie } from "@/lib/local-sqlite/local-auth";

const loginFont = Outfit({
  subsets: ["latin"],
  variable: "--font-landing",
  display: "swap",
  weight: ["400", "500", "600", "700"],
});

const smoothEase = [0.16, 1, 0.3, 1] as const;

export default function LoginPage() {
  const supabase = createClient();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (isLocalSqliteEnabled()) {
      try {
        const raw = sessionStorage.getItem("mock_auth_session");
        if (raw) persistLocalAuthCookie(JSON.parse(raw));
      } catch {
        /* ignore */
      }
    }
  }, []);

  const routeAfterLogin = async () => {
    try {
      const searchParams = new URLSearchParams(window.location.search);
      const nextParam = searchParams.get("next");
      const targetDestination =
        nextParam && nextParam.startsWith("/dashboard")
          ? nextParam
          : "/dashboard/restaurant/pos";

      if (isLocalSqliteEnabled()) {
        window.location.assign(targetDestination);
        return;
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        window.location.assign(targetDestination);
        return;
      }

      // Fetch user profile
      const { data: profile } = await supabase
        .from("user_profiles")
        .select("role, shop_id")
        .eq("id", user.id)
        .maybeSingle();

      let targetShopId = profile?.shop_id;

      // If user has no direct shop_id, resolve their active business shop
      if (!targetShopId) {
        const { data: uShop } = await supabase
          .from("user_shops")
          .select("shop_id")
          .eq("user_id", user.id)
          .limit(1)
          .maybeSingle();

        if (uShop?.shop_id) {
          targetShopId = uShop.shop_id;
        } else {
          const { data: ownedShop } = await supabase
            .from("shops")
            .select("id")
            .eq("owner_id", user.id)
            .limit(1)
            .maybeSingle();

          if (ownedShop?.id) {
            targetShopId = ownedShop.id;
          } else {
            // Find active restaurant shop
            const { data: restShop } = await supabase
              .from("shops")
              .select("id")
              .eq("industry_type", "restaurant")
              .limit(1)
              .maybeSingle();

            if (restShop?.id) {
              targetShopId = restShop.id;
            } else {
              const { data: anyShop } = await supabase
                .from("shops")
                .select("id")
                .limit(1)
                .maybeSingle();
              if (anyShop?.id) {
                targetShopId = anyShop.id;
              }
            }
          }
        }
      }

      // Clear any leftover impersonation flags so normal business mode is active
      if (typeof window !== "undefined") {
        localStorage.removeItem("is_impersonating");
        localStorage.removeItem("impersonated_shop_id");
        localStorage.removeItem("impersonated_shop_name");
        localStorage.removeItem("impersonated_user_name");
        localStorage.removeItem("hisabx_shop_context");
        localStorage.removeItem("The Accounts_shop_context");
        if (targetShopId) {
          localStorage.setItem("current_shop_id", targetShopId);
          localStorage.setItem("active_shop_id", targetShopId);
        }
      }

      // Sync user profile to ensure direct assignment to the target shop
      if (targetShopId && (!profile?.shop_id || profile.shop_id !== targetShopId)) {
        try {
          await supabase
            .from("user_profiles")
            .update({ shop_id: targetShopId })
            .eq("id", user.id);
        } catch {
          // Ignore profile sync errors if permissions are restricted
        }
      }

      // Always enter inside the business terminal
      window.location.assign(targetDestination);
    } catch {
      window.location.assign("/dashboard/restaurant/pos");
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        const isNetworkErr =
          error.message === "Failed to fetch" ||
          error.message?.toLowerCase().includes("fetch") ||
          error.message?.toLowerCase().includes("timeout") ||
          (error as { status?: number })?.status === 0;

        toast.error("Sign in failed", {
          description: isNetworkErr
            ? "Check email and password (local: admin@flame9.pizza / admin123)."
            : error.message,
        });
        return;
      }

      toast.success("Welcome back", {
        description: "Launching Falcon Swift Restaurant Terminal...",
      });

      await routeAfterLogin();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Connection failed";
      toast.error("Sign in failed", { description: message });
    } finally {
      setLoading(false);
    }
  };

  if (!mounted) {
    return (
      <div className="flex min-h-[100svh] flex-col items-center justify-center bg-white text-slate-700">
        <Loader2 className="h-8 w-8 animate-spin text-slate-900" />
      </div>
    );
  }

  return (
    <div
      className={`${loginFont.variable} ${loginFont.className} min-h-[100svh] bg-slate-50 text-slate-900 font-sans antialiased overflow-x-hidden selection:bg-slate-900 selection:text-white`}
    >
      {/* Top Header */}
      <motion.header
        initial={{ y: -24, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.6, ease: smoothEase }}
        className="bg-white border-b border-slate-200"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 sm:h-20 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3 group">
            <motion.div
              whileHover={{ scale: 1.06, rotate: -2 }}
              whileTap={{ scale: 0.96 }}
              transition={{ duration: 0.2 }}
              className="relative h-10 w-10 sm:h-12 sm:w-12 shrink-0"
            >
              <Image
                src="/falcon-swift-hd.png"
                alt="Falcon Swift Logo"
                fill
                className="object-contain"
                priority
              />
            </motion.div>
            <div className="flex flex-col">
              <p className="text-xl font-extrabold tracking-tight text-slate-900 leading-tight group-hover:text-sky-700 transition-colors">
                Falcon Swift
              </p>
              <p className="text-xs font-semibold text-slate-500">
                Restaurant Terminal
              </p>
            </div>
          </Link>

          <div>
            <motion.div
              whileHover={{ x: -2 }}
              transition={{ duration: 0.2 }}
            >
              <Link
                href="/"
                className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-slate-600 hover:text-slate-900 transition py-2 px-3 rounded-lg hover:bg-slate-100"
              >
                <ArrowLeft size={16} />
                Return to Home
              </Link>
            </motion.div>
          </div>
        </div>
      </motion.header>

      {/* Main Grid: Responsive 2-Col on Desktop, Mobile-App View on Mobile */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-14">
        <div className="grid lg:grid-cols-12 gap-10 items-center">
          
          {/* Left Column: Visual Brand Info */}
          <div className="hidden lg:block lg:col-span-7 space-y-6">
            
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.1, ease: smoothEase }}
              className="text-3xl sm:text-4xl lg:text-5xl font-black text-slate-900 tracking-tight leading-tight"
            >
              Sign in to manage dining tables, kitchen tickets, and billing.
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.18, ease: smoothEase }}
              className="text-base text-slate-600 max-w-xl leading-relaxed"
            >
              Workstation access for restaurant managers, counter cashiers, waitstaff, and kitchen cook monitors.
            </motion.p>

            {/* Chef Station Card */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 24 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ duration: 0.75, delay: 0.25, ease: smoothEase }}
              whileHover={{ y: -4, boxShadow: "0 16px 30px -8px rgba(15, 23, 42, 0.08)" }}
              className="rounded-2xl border border-slate-200 bg-white p-5 max-w-lg shadow-xs flex items-center gap-5 transition-all"
            >
              <motion.div
                animate={{ y: [0, -3, 0] }}
                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                className="relative h-28 w-24 shrink-0"
              >
                <Image
                  src="/chef-illustration.png"
                  alt="Restaurant Chef"
                  fill
                  className="object-contain"
                  priority
                />
              </motion.div>
              <div className="space-y-2 text-xs">
                <p className="font-bold text-slate-900 text-sm">Falcon Swift Operations</p>
                <div className="flex items-center gap-2 text-slate-600 font-medium">
                  <UtensilsCrossed size={15} className="text-slate-800 shrink-0" />
                  Live Table Floor and Split Bills
                </div>
                <div className="flex items-center gap-2 text-slate-600 font-medium">
                  <Tv size={15} className="text-slate-800 shrink-0" />
                  Kitchen Display Monitor Workflows
                </div>
                <div className="flex items-center gap-2 text-slate-600 font-medium">
                  <ShieldCheck size={15} className="text-slate-800 shrink-0" />
                  Local Offline POS Resilience
                </div>
              </div>
            </motion.div>

          </div>

          {/* Right Column: Clean White Sign In Form */}
          <div className="lg:col-span-5 w-full max-w-md mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 24, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.7, delay: 0.15, ease: smoothEase }}
              className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 shadow-sm"
            >
              
              {/* Card Header */}
              <div className="mb-6">
                <div className="flex items-center gap-3 mb-1">
                  <motion.div
                    whileHover={{ scale: 1.08, rotate: 3 }}
                    transition={{ duration: 0.2 }}
                    className="relative h-9 w-9 shrink-0"
                  >
                    <Image
                      src="/falcon-swift-hd.png"
                      alt="Falcon Swift"
                      fill
                      className="object-contain"
                    />
                  </motion.div>
                  <div>
                    <h2 className="text-xl font-bold tracking-tight text-slate-900">
                      Terminal Sign In
                    </h2>
                    <p className="text-xs text-slate-500">
                      Falcon Swift POS
                    </p>
                  </div>
                </div>
              </div>

              {/* Form Inputs */}
              <form onSubmit={handleLogin} className="space-y-4">
                
                <div className="space-y-1.5">
                  <label htmlFor="email" className="block text-xs font-bold text-slate-700">
                    Staff Email or Terminal ID
                  </label>
                  <input
                    id="email"
                    type="email"
                    placeholder="staff@falconswift.pos"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                    className="h-12 w-full rounded-xl border border-slate-300 bg-white px-3.5 text-sm text-slate-900 outline-none transition focus:border-slate-900 focus:ring-2 focus:ring-slate-100 placeholder:text-slate-400"
                  />
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label htmlFor="password" className="block text-xs font-bold text-slate-700">
                      Terminal Password
                    </label>
                    <Link
                      href="/forgot-password"
                      className="text-xs font-semibold text-slate-700 hover:underline"
                    >
                      Forgot password?
                    </Link>
                  </div>
                  <div className="relative">
                    <input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      autoComplete="current-password"
                      className="h-12 w-full rounded-xl border border-slate-300 bg-white px-3.5 pr-11 text-sm text-slate-900 outline-none transition focus:border-slate-900 focus:ring-2 focus:ring-slate-100 placeholder:text-slate-400"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>

                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  transition={{ duration: 0.2 }}
                  type="submit"
                  disabled={loading}
                  className="w-full inline-flex items-center justify-center gap-2 h-12 rounded-xl bg-slate-900 hover:bg-slate-800 font-bold text-sm text-white shadow-xs transition disabled:opacity-60 disabled:cursor-not-allowed mt-2"
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Authorizing Terminal...
                    </>
                  ) : (
                    <>
                      Sign In to Terminal
                      <ArrowRight size={16} />
                    </>
                  )}
                </motion.button>
              </form>

              {/* Quick Demo Access - Commented out as requested */}
              {/*
              <div className="mt-6 pt-4 border-t border-slate-100 text-center">
                <p className="text-xs text-slate-500 mb-2">Need quick demo access?</p>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  transition={{ duration: 0.2 }}
                  type="button"
                  onClick={() => {
                    setEmail(FLAME9_LOCAL_LOGINS.admin.email);
                    setPassword(FLAME9_LOCAL_LOGINS.admin.password);
                    toast.success("Demo credentials loaded", {
                      description: "Click Sign In to Terminal to proceed.",
                    });
                  }}
                  className="text-xs font-semibold text-slate-800 hover:underline"
                >
                  Autofill Restaurant Demo Login
                </motion.button>
              </div>
              */}

              {/* Register link - Commented out as requested */}
              {/*
              <div className="mt-6 pt-4 border-t border-slate-100 text-center">
                <p className="text-xs text-slate-500">
                  Don&apos;t have a business account?{" "}
                  <Link href="/register" className="font-semibold text-slate-900 hover:underline">
                    Register your restaurant
                  </Link>
                </p>
              </div>
              */}

              {/* Bottom Copyright */}
              <div className="mt-6 pt-3 text-center text-xs text-slate-400">
                <p>© {new Date().getFullYear()} Falcon Swift. All rights reserved.</p>
              </div>

            </motion.div>
          </div>

        </div>
      </main>

    </div>
  );
}
