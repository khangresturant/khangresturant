"use client";
import Link from "next/link";
import { ArrowRight, CheckCircle2, Printer, WifiOff, MessageCircle, TrendingUp } from "lucide-react";
import { MockupBanner, MockupFooter, MockupNav } from "@/components/landing/mockups/MockupChrome";

/** Design 1 — current style refined, light indigo */
export default function Mockup01Trusted() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <MockupBanner label="Design 1 — Trusted Upgrade (Light)" />
      <MockupNav />

      <section className="bg-white border-b border-slate-100">
        <div className="max-w-6xl mx-auto px-4 py-3 flex flex-wrap justify-center gap-6 text-xs font-bold text-slate-600">
          {["100% Offline POS", "FBR Ready", "WhatsApp Bills", "Thermal Print"].map((t) => (
            <span key={t} className="flex items-center gap-1.5">
              <CheckCircle2 size={14} className="text-emerald-500" /> {t}
            </span>
          ))}
        </div>
      </section>

      <section className="py-16 lg:py-24 bg-gradient-to-b from-white to-indigo-50/50">
        <div className="max-w-6xl mx-auto px-4 grid lg:grid-cols-2 gap-12 items-center">
          <div className="space-y-6">
            <span className="inline-block px-3 py-1 rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold">
              Pakistan ka #1 Offline POS
            </span>
            <h1 className="text-4xl lg:text-5xl font-black leading-tight text-slate-900">
              Dukaan ka billing, udhaar aur munafa —{" "}
              <span className="text-indigo-600">sab ek jagah</span>
            </h1>
            <p className="text-lg text-slate-600 leading-relaxed">
              Barcode scan, internet ke baghair bill, WhatsApp receipt, rozana profit report.
              Pharmacy, restaurant, karyana — har business ke liye.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link href="/register" className="px-6 py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-2xl flex items-center gap-2">
                14 Din Free Trial <ArrowRight size={18} />
              </Link>
              <a href="#demo" className="px-6 py-3.5 bg-white border-2 border-slate-200 font-bold rounded-2xl">
                Demo Dekhein
              </a>
            </div>
          </div>
          <div id="demo" className="relative">
            <img
              src="/images/theaccounts_pos_dashboard_monitor.png"
              alt="POS Dashboard"
              className="rounded-2xl border border-slate-200 shadow-2xl w-full"
            />
            <div className="absolute -bottom-4 -left-4 bg-white rounded-xl p-4 shadow-lg border border-slate-100 max-w-[200px]">
              <p className="text-xs font-bold text-emerald-600 flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" /> Live POS
              </p>
              <p className="text-2xl font-black text-slate-900 mt-1">Rs 12,450</p>
              <p className="text-[10px] text-slate-500">Aaj ki sale</p>
            </div>
          </div>
        </div>
      </section>

      <section id="features" className="py-20 bg-slate-50">
        <div className="max-w-6xl mx-auto px-4">
          <h2 className="text-3xl font-black text-center mb-12">Kyun The Accounts?</h2>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              { icon: WifiOff, title: "Offline Billing", desc: "Net band ho to bhi sale chalegi. Online aate hi sync." },
              { icon: MessageCircle, title: "WhatsApp Receipt", desc: "1 click se customer ko PDF bill bhejein." },
              { icon: TrendingUp, title: "Daily P&L", desc: "Roz ka munafa aur kharcha ek report mein." },
            ].map(({ icon: Icon, title, desc }) => (
              <div key={title} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                <div className="h-10 w-10 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center mb-4">
                  <Icon size={22} />
                </div>
                <h3 className="font-black text-lg mb-2">{title}</h3>
                <p className="text-sm text-slate-600">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="pricing" className="py-20 bg-white">
        <div className="max-w-6xl mx-auto px-4 text-center">
          <h2 className="text-3xl font-black mb-4">Simple Pricing</h2>
          <p className="text-slate-600 mb-10">Free se shuru karein — upgrade jab zaroorat ho</p>
          <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
            {[
              { name: "Free", price: "Rs 0", highlight: false },
              { name: "Starter", price: "Rs 1,500/mo", highlight: true },
              { name: "Premium", price: "Rs 3,500/mo", highlight: false },
            ].map((p) => (
              <div
                key={p.name}
                className={`p-6 rounded-2xl border-2 ${p.highlight ? "border-indigo-500 bg-indigo-50/50 shadow-lg scale-105" : "border-slate-200 bg-white"}`}
              >
                <p className="font-black text-xl">{p.name}</p>
                <p className="text-3xl font-black text-indigo-600 my-3">{p.price}</p>
                <Link href="/register" className="block py-2.5 rounded-xl bg-indigo-600 text-white font-bold text-sm">
                  Start
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      <MockupFooter />
    </div>
  );
}
