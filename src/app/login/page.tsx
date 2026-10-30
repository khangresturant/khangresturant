"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Outfit } from "next/font/google";
import { motion } from "framer-motion";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { useLanguage } from "@/context/LanguageContext";
import { isSuperAdmin } from "@/lib/auth/roles";
import { isFlame9Brand, getFlame9AdminEmailHint } from "@/lib/deployment/flame9-brand";
import { isLocalSqliteEnabled } from "@/lib/config";
import { FLAME9_LOCAL_LOGINS } from "@/lib/local-sqlite/seed-data";
import { Flame9LoginView } from "@/components/branding/Flame9LoginView";

const loginFont = Outfit({
  subsets: ["latin"],
  variable: "--font-landing",
  display: "swap",
  weight: ["400", "500", "600", "700"],
});

const ease = [0.22, 1, 0.36, 1] as const;

export default function LoginPage() {
  const supabase = createClient();
  const router = useRouter();
  const { t, language, setLanguage } = useLanguage();
  const flame9 = isFlame9Brand();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (!flame9) return;
    const hint = isLocalSqliteEnabled() ? FLAME9_LOCAL_LOGINS.admin.email : getFlame9AdminEmailHint();
    if (hint) setEmail(hint);
  }, [flame9]);

  const routeAfterLogin = async () => {
    // Hard navigation so dashboard picks up mock session reliably
    if (isLocalSqliteEnabled()) {
      window.location.assign("/dashboard/restaurant/pos");
      return;
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      window.location.assign("/dashboard/restaurant/pos");
      return;
    }

    const { data: profile } = await supabase
      .from("user_profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    if (isSuperAdmin({ role: profile?.role, email: user.email })) {
      window.location.assign("/admin/shops");
      return;
    }
    window.location.assign("/dashboard/restaurant/pos");
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
        toast.error(t("login_failed"), {
          description: isNetworkErr
            ? "Cannot connect to server. Check internet or Supabase URL in .env.local."
            : error.message,
        });
        return;
      }

      toast.success(t("login_success"), {
        description: flame9 ? "Flame 9 — session reset OK" : t("admin_mode"),
      });

      if (flame9) {
        await routeAfterLogin();
      } else {
        router.push("/dashboard");
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Connection failed";
      const isNetworkErr =
        message === "Failed to fetch" ||
        message.toLowerCase().includes("fetch") ||
        message.toLowerCase().includes("timeout");
      toast.error(t("login_failed"), {
        description: isNetworkErr
          ? "Cannot connect to server. Check internet or Supabase URL in .env.local."
          : message,
      });
    } finally {
      setLoading(false);
    }
  };

  if (!mounted) {
    return (
      <div
        className={`flex min-h-[100svh] flex-col items-center justify-center ${
          flame9 ? "bg-[#14110F]" : "landing-labs bg-[var(--labs-bg,#f6f7f9)]"
        }`}
      >
        <Loader2 className={`h-7 w-7 animate-spin ${flame9 ? "text-[#FF4D00]" : "text-[var(--labs-accent,#0b57d0)]"}`} />
      </div>
    );
  }

  if (flame9) {
    return (
      <Flame9LoginView
        email={email}
        password={password}
        loading={loading}
        showPassword={showPassword}
        onEmail={setEmail}
        onPassword={setPassword}
        onTogglePassword={() => setShowPassword((v) => !v)}
        onSubmit={handleLogin}
        onFillSuperAdmin={() =>
          setEmail(isLocalSqliteEnabled() ? FLAME9_LOCAL_LOGINS.admin.email : getFlame9AdminEmailHint())
        }
        onFillStaffDemo={() => {
          setEmail(isLocalSqliteEnabled() ? FLAME9_LOCAL_LOGINS.staff.email : "");
          toast.message("Staff email", { description: "Enter the email your owner created for POS staff." });
        }}
      />
    );
  }

  return (
    <div
      className={`${loginFont.variable} ${loginFont.className} landing-labs relative min-h-[100svh] overflow-hidden bg-[var(--labs-bg)] text-[var(--labs-ink)] antialiased selection:bg-indigo-600 selection:text-white`}
    >
      {/* Atmosphere */}
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <div className="labs-grid absolute inset-0 opacity-40" />
        <div className="absolute -left-[18%] top-[-12%] h-[48vw] w-[48vw] rounded-full bg-[radial-gradient(circle_at_center,rgba(11,87,208,0.13),transparent_68%)]" />
        <div className="absolute -right-[12%] bottom-[-8%] h-[40vw] w-[40vw] rounded-full bg-[radial-gradient(circle_at_center,rgba(15,157,88,0.08),transparent_70%)]" />
      </div>

      {/* Top bar */}
      <header className="relative z-20 mx-auto flex w-full max-w-[1120px] items-center justify-between px-5 py-5 sm:px-8">
        <Link href="/" className="group flex items-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/the-accounts-brand.png"
            alt="The Accounts"
            className="h-10 w-auto max-w-[180px] object-contain transition-transform duration-300 group-hover:scale-[1.02]"
          />
        </Link>

        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-full border border-[var(--labs-line)] bg-white/80 p-1 backdrop-blur-sm">
            <button
              type="button"
              onClick={() => setLanguage("en")}
              className={`rounded-full px-3 py-1.5 text-[12px] font-medium transition-colors ${
                language === "en"
                  ? "bg-[var(--labs-ink)] text-white"
                  : "text-[var(--labs-muted)] hover:text-[var(--labs-ink)]"
              }`}
            >
              EN
            </button>
            <button
              type="button"
              onClick={() => setLanguage("ur")}
              className={`rounded-full px-3 py-1.5 text-[12px] font-medium transition-colors ${
                language === "ur"
                  ? "bg-[var(--labs-ink)] text-white"
                  : "text-[var(--labs-muted)] hover:text-[var(--labs-ink)]"
              }`}
            >
              اردو
            </button>
          </div>
          <Link
            href="/register"
            className="hidden h-9 items-center rounded-full bg-[var(--labs-ink)] px-4 text-[13px] font-medium text-white transition-transform hover:scale-[1.02] sm:inline-flex"
          >
            Get started
          </Link>
        </div>
      </header>

      <main className="relative z-10 mx-auto grid min-h-[calc(100svh-88px)] w-full max-w-[1120px] items-center gap-10 px-5 pb-12 pt-4 sm:px-8 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease }}
          className="hidden lg:block"
        >
          <p className="text-[13px] font-medium tracking-[0.04em] text-[var(--labs-muted)]">Welcome back</p>
          <h1 className="mt-4 max-w-[11ch] text-[clamp(2.8rem,5vw,4.6rem)] font-semibold leading-[0.95] tracking-[-0.05em]">
            Sign in to your workspace
          </h1>
          <p className="mt-5 max-w-[28rem] text-[16px] leading-relaxed text-[var(--labs-muted)]">
            POS, inventory, khata, and accounts — ready when you are.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.75, ease, delay: 0.08 }}
          className="mx-auto w-full max-w-[420px] lg:mx-0 lg:justify-self-end"
        >
          <div className="mb-8 text-center lg:hidden">
            <h1 className="text-[2rem] font-semibold tracking-[-0.04em]">{t("login_title")}</h1>
            <p className="mt-2 text-[14px] text-[var(--labs-muted)]">{t("login_subtitle")}</p>
          </div>

          <div className="rounded-[1.35rem] border border-[var(--labs-line)] bg-white/80 p-7 backdrop-blur-xl sm:p-8">
            <div className="mb-7 hidden lg:block">
              <h2 className="text-[1.55rem] font-semibold tracking-[-0.03em]">{t("login_title")}</h2>
              <p className="mt-1.5 text-[14px] text-[var(--labs-muted)]">{t("login_subtitle")}</p>
            </div>

            <form onSubmit={handleLogin} className="space-y-5">
              <div className="space-y-2">
                <label htmlFor="email" className="block text-[12px] font-medium text-[var(--labs-muted)]">
                  {t("email_label")}
                </label>
                <input
                  id="email"
                  type="email"
                  placeholder="you@business.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  className="h-12 w-full rounded-xl border border-[var(--labs-line)] bg-[var(--labs-bg)] px-4 text-[15px] text-[var(--labs-ink)] outline-none transition-[border,box-shadow] placeholder:text-[var(--labs-muted)]/70 focus:border-[var(--labs-accent)] focus:shadow-[0_0_0_3px_var(--labs-accent-soft)]"
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <label htmlFor="password" className="block text-[12px] font-medium text-[var(--labs-muted)]">
                    {t("password_label")}
                  </label>
                  <Link href="/forgot-password" className="text-[12px] font-medium text-[var(--labs-accent)] hover:underline">
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
                    minLength={8}
                    autoComplete="current-password"
                    className="h-12 w-full rounded-xl border border-[var(--labs-line)] bg-[var(--labs-bg)] px-4 pr-11 text-[15px] text-[var(--labs-ink)] outline-none transition-[border,box-shadow] focus:border-[var(--labs-accent)] focus:shadow-[0_0_0_3px_var(--labs-accent-soft)]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[var(--labs-muted)] transition-colors hover:text-[var(--labs-ink)]"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[var(--labs-accent)] text-[15px] font-medium text-white transition-transform duration-300 hover:scale-[1.015] active:scale-[0.985] disabled:cursor-not-allowed disabled:opacity-70"
              >
                {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : t("login_btn")}
              </button>
            </form>

            <p className="mt-6 text-center text-[13px] text-[var(--labs-muted)]">
              New business?{" "}
              <Link href="/register" className="font-medium text-[var(--labs-accent)] hover:underline">
                Create an account
              </Link>
            </p>
          </div>

          <p className="mt-8 text-center text-[12px] text-[var(--labs-muted)]">© 2026 theaccounts.cloud</p>
        </motion.div>
      </main>
    </div>
  );
}
