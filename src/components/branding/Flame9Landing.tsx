"use client";

import Image from "next/image";
import Link from "next/link";
import { Flame, UtensilsCrossed, Coffee, ChefHat, ArrowRight } from "lucide-react";
import { FLAME9 } from "@/lib/deployment/flame9-brand";

export default function Flame9Landing() {
  return (
    <div
      className="min-h-screen text-[var(--flame9-cream)]"
      style={{
        background: `radial-gradient(ellipse 120% 80% at 50% -20%, ${FLAME9.colors.ember}33, transparent 55%), linear-gradient(165deg, ${FLAME9.colors.coal} 0%, #1a120e 45%, ${FLAME9.colors.coal} 100%)`,
      }}
    >
      <header className="max-w-6xl mx-auto px-4 py-6 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Image
            src={FLAME9.logoPath}
            alt={FLAME9.fullName}
            width={56}
            height={56}
            className="rounded-2xl ring-2 ring-[var(--flame9-flame)]/40 bg-white/5 object-contain p-1"
            priority
          />
          <div>
            <p className="font-display text-2xl md:text-3xl tracking-wide leading-none text-white">
              {FLAME9.name}
            </p>
            <p className="text-xs md:text-sm font-semibold text-[var(--flame9-ember)] mt-1">
              Pizza House &amp; Café
            </p>
          </div>
        </div>
        <Link
          href="/login"
          className="inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-bold text-white shadow-lg transition hover:scale-[1.02]"
          style={{
            background: `linear-gradient(135deg, ${FLAME9.colors.flame}, ${FLAME9.colors.flameDark})`,
            boxShadow: `0 12px 40px ${FLAME9.colors.flame}55`,
          }}
        >
          Staff Login <ArrowRight size={16} />
        </Link>
      </header>

      <main className="max-w-6xl mx-auto px-4 pb-16">
        <section className="grid lg:grid-cols-2 gap-10 items-center pt-8 md:pt-14">
          <div className="space-y-6">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-bold uppercase tracking-widest text-[var(--flame9-ember)]">
              <Flame size={14} /> {FLAME9.tagline}
            </span>
            <h1 className="font-display text-4xl md:text-6xl leading-[0.95] text-white">
              Pizza, café &amp; kitchen — one POS desk.
            </h1>
            <p className="text-base md:text-lg text-white/70 max-w-lg leading-relaxed">
              Tables, takeaway, KDS, deals &amp; billing — built for Flame 9 Pizza House &amp; Café. Permanent
              in-house license — no subscription plans.
            </p>
            <div className="flex flex-wrap gap-3 pt-2">
              <Link
                href="/dashboard/restaurant/pos"
                className="rounded-2xl px-6 py-3 font-bold text-sm text-[var(--flame9-coal)] bg-[var(--flame9-cream)] hover:bg-white transition"
              >
                Open Restaurant POS
              </Link>
              <Link
                href="/login"
                className="rounded-2xl px-6 py-3 font-bold text-sm border border-white/20 text-white hover:bg-white/10 transition"
              >
                Dashboard
              </Link>
            </div>
          </div>

          <div className="relative">
            <div
              className="absolute -inset-4 rounded-[2rem] blur-3xl opacity-40"
              style={{ background: FLAME9.colors.flame }}
            />
            <div className="relative rounded-[2rem] border border-white/10 bg-white/5 p-8 backdrop-blur-sm">
              <div className="grid grid-cols-2 gap-4">
                {[
                  { icon: UtensilsCrossed, label: "Dine-in & tables" },
                  { icon: Coffee, label: "Café & takeaway" },
                  { icon: ChefHat, label: "Kitchen KDS / KOT" },
                  { icon: Flame, label: "Deals & combos" },
                ].map(({ icon: Icon, label }) => (
                  <div
                    key={label}
                    className="rounded-2xl border border-white/10 bg-black/20 p-4 flex flex-col gap-2"
                  >
                    <Icon className="text-[var(--flame9-flame)]" size={22} />
                    <span className="text-sm font-bold text-white/90">{label}</span>
                  </div>
                ))}
              </div>
              <p className="mt-6 text-center text-[11px] font-semibold uppercase tracking-wider text-white/40">
                Powered by The Accounts · Restaurant module only
              </p>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
