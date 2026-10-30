"use client";

import Image from "next/image";
import Link from "next/link";
import { Bebas_Neue, DM_Sans } from "next/font/google";
import { Eye, EyeOff, Loader2, Shield, UtensilsCrossed } from "lucide-react";
import { FLAME9, getFlame9AdminEmailHint } from "@/lib/deployment/flame9-brand";
import { isLocalSqliteEnabled } from "@/lib/config";
import { FLAME9_LOCAL_LOGINS } from "@/lib/local-sqlite/seed-data";

const display = Bebas_Neue({ subsets: ["latin"], weight: "400", variable: "--font-flame9-display" });
const body = DM_Sans({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-flame9-body" });

type Props = {
  email: string;
  password: string;
  loading: boolean;
  showPassword: boolean;
  onEmail: (v: string) => void;
  onPassword: (v: string) => void;
  onTogglePassword: () => void;
  onSubmit: (e: React.FormEvent) => void;
  onFillSuperAdmin: () => void;
  onFillStaffDemo: () => void;
};

export function Flame9LoginView({
  email,
  password,
  loading,
  showPassword,
  onEmail,
  onPassword,
  onTogglePassword,
  onSubmit,
  onFillSuperAdmin,
  onFillStaffDemo,
}: Props) {
  const adminHint = getFlame9AdminEmailHint();

  return (
    <div
      className={`${display.variable} ${body.variable} ${body.className} min-h-[100svh] text-[var(--flame9-cream,#fff8f0)]`}
      style={{
        background: `radial-gradient(ellipse 100% 70% at 50% -10%, ${FLAME9.colors.ember}40, transparent 50%), linear-gradient(180deg, ${FLAME9.colors.coal} 0%, #1a120e 100%)`,
      }}
    >
      <header className="mx-auto flex max-w-5xl items-center justify-between px-5 py-6">
        <Link href="/" className="flex items-center gap-3">
          <Image src={FLAME9.logoPath} alt="" width={52} height={52} className="rounded-xl ring-1 ring-[#FF4D00]/40 bg-black/20 object-contain p-1" priority />
          <div>
            <p className="font-display text-2xl leading-none text-white">{FLAME9.name}</p>
            <p className="text-[11px] font-semibold text-[#FF8A3D]">Pizza House &amp; Café</p>
          </div>
        </Link>
      </header>

      <main className="mx-auto grid max-w-5xl gap-10 px-5 pb-16 lg:grid-cols-2 lg:items-center">
        <div className="hidden lg:block space-y-4">
          <p className="text-sm font-semibold text-white/50 uppercase tracking-widest">Staff &amp; Admin</p>
          <h1 className="font-display text-5xl leading-[0.95] text-white">Login reset — fresh session</h1>
          <p className="text-white/65 max-w-md leading-relaxed">
            Cached shop IDs, impersonation, and WhatsApp drafts are cleared on this screen. Super Admin opens SaaS
            control; staff goes straight to Restaurant POS.
          </p>
          <ul className="text-xs font-semibold space-y-2 text-[#FF8A3D]/90">
            <li>• WhatsApp billing reminders: off for Flame 9</li>
            <li>• No public signup — owner accounts only</li>
            <li>• Inner theme: Flame 9 Ember sidebar</li>
          </ul>
        </div>

        <div className="mx-auto w-full max-w-md rounded-[1.5rem] border border-white/10 bg-black/30 p-8 backdrop-blur-md shadow-2xl">
          <h2 className="font-display text-3xl text-white text-center lg:text-left">Sign in</h2>
          <p className="text-sm text-white/55 mt-2 mb-6 text-center lg:text-left">Use your owner or staff email</p>

          <div className="flex flex-wrap gap-2 mb-5">
            <button
              type="button"
              onClick={onFillSuperAdmin}
              className="inline-flex items-center gap-1.5 rounded-full border border-[#FF4D00]/40 bg-[#FF4D00]/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide text-[#FF8A3D] hover:bg-[#FF4D00]/20"
            >
              <Shield size={12} /> Super Admin
            </button>
            <button
              type="button"
              onClick={onFillStaffDemo}
              className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide text-white/70 hover:bg-white/10"
            >
              <UtensilsCrossed size={12} /> Restaurant staff
            </button>
          </div>

          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="text-[11px] font-bold uppercase tracking-wide text-white/45">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => onEmail(e.target.value)}
                placeholder={adminHint}
                required
                autoComplete="username"
                className="mt-1.5 h-12 w-full rounded-xl border border-white/10 bg-black/40 px-4 text-white outline-none focus:border-[#FF4D00] focus:ring-2 focus:ring-[#FF4D00]/30"
              />
            </div>
            <div>
              <label htmlFor="password" className="text-[11px] font-bold uppercase tracking-wide text-white/45">
                Password
              </label>
              <div className="relative mt-1.5">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => onPassword(e.target.value)}
                  required
                  minLength={6}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  className="h-12 w-full rounded-xl border border-white/10 bg-black/40 px-4 pr-11 text-white outline-none focus:border-[#FF4D00] focus:ring-2 focus:ring-[#FF4D00]/30"
                />
                <button
                  type="button"
                  onClick={onTogglePassword}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white"
                  aria-label="Toggle password"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-xl font-bold text-[#14110F] disabled:opacity-60"
              style={{ background: `linear-gradient(135deg, ${FLAME9.colors.flame}, ${FLAME9.colors.ember})` }}
            >
              {loading ? <Loader2 className="animate-spin" size={20} /> : "Login"}
            </button>
          </form>

          <p className="mt-5 text-center text-[11px] text-white/40">
            {isLocalSqliteEnabled() ? (
              <>
                Local SQLite logins — Admin:{" "}
                <span className="text-[#FF8A3D]">{FLAME9_LOCAL_LOGINS.admin.email}</span> /{" "}
                <span className="text-[#FF8A3D]">{FLAME9_LOCAL_LOGINS.admin.password}</span>
                <br />
                Staff: <span className="text-[#FF8A3D]">{FLAME9_LOCAL_LOGINS.staff.email}</span> /{" "}
                <span className="text-[#FF8A3D]">{FLAME9_LOCAL_LOGINS.staff.password}</span>
              </>
            ) : (
              <>
                Super Admin email hint: <span className="text-[#FF8A3D]">{adminHint}</span>
              </>
            )}
          </p>
        </div>
      </main>
    </div>
  );
}
