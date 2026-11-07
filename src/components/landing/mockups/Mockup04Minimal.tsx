"use client";
import Link from "next/link";
import { ArrowRight, WifiOff, Printer, FileText } from "lucide-react";
import { MockupBanner, MockupFooter, MockupNav } from "@/components/landing/mockups/MockupChrome";

/** Design 4 — minimal, lots of white space */
export default function Mockup04Minimal() {
  return (
    <div className="min-h-screen bg-white text-slate-900">
      <MockupBanner label="Design 4 — Minimal Clean (Light)" />
      <header className="max-w-3xl mx-auto px-4 py-6 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <img src="/the-accounts-official-logo.png" alt="" className="h-8 w-8" />
          <span className="font-black">The Accounts</span>
        </div>
        <Link href="/register" className="text-sm font-bold text-sky-600">
          Start free →
        </Link>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-20 lg:py-32 text-center">
        <h1 className="text-5xl lg:text-6xl font-black tracking-tight text-slate-900 mb-6 leading-[1.1]">
          POS + Udhaar + Hisaab
        </h1>
        <p className="text-xl text-slate-500 mb-12 max-w-lg mx-auto leading-relaxed">
          Offline bill. Thermal print. Rozana munafa. Bas itna hi — aur kuch nahi chahiye.
        </p>

        <Link
          href="/register"
          className="inline-flex px-10 py-4 bg-sky-600 hover:bg-sky-700 text-white font-bold text-lg rounded-full shadow-lg shadow-sky-600/25"
        >
          Free shuru karein
        </Link>

        <div className="mt-16 mb-20">
          <img
            src="/images/pos_terminal_3d.png"
            alt="POS"
            className="mx-auto max-w-md w-full drop-shadow-2xl"
          />
        </div>

        <div className="grid sm:grid-cols-3 gap-8 text-left max-w-2xl mx-auto">
          {[
            { icon: WifiOff, t: "Offline", d: "Net band = sale band nahi" },
            { icon: Printer, t: "Print", d: "58mm / 80mm thermal" },
            { icon: FileText, t: "Khata", d: "Customer udhaar ledger" },
          ].map(({ icon: Icon, t, d }) => (
            <div key={t}>
              <Icon size={24} className="text-sky-600 mb-2" />
              <p className="font-black">{t}</p>
              <p className="text-sm text-slate-500">{d}</p>
            </div>
          ))}
        </div>
      </main>

      <section id="pricing" className="border-t border-slate-100 py-16 bg-slate-50/50">
        <div className="max-w-3xl mx-auto px-4 text-center">
          <p className="text-4xl font-black text-sky-600 mb-2">Rs 0</p>
          <p className="text-slate-600 mb-6">14 din free · phir Rs 1,500/month</p>
          <Link href="/register" className="text-sky-600 font-bold inline-flex items-center gap-1">
            Details <ArrowRight size={16} />
          </Link>
        </div>
      </section>

      <MockupFooter />
    </div>
  );
}
