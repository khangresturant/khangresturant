"use client";
import Link from "next/link";
import { ArrowRight, ScanLine, MessageCircle, BookOpen } from "lucide-react";
import { MockupBanner, MockupFooter } from "@/components/landing/mockups/MockupChrome";

/** Design 5 — Roman Urdu first, warm cream/green light theme */
export default function Mockup05UrduFirst() {
  return (
    <div className="min-h-screen bg-[#faf8f5] text-slate-900">
      <MockupBanner label="Design 5 — Urdu Roman First (Light)" />

      <header className="bg-[#faf8f5]/95 border-b border-stone-200 sticky top-[41px] z-50">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img src="/the-accounts-official-logo.png" alt="" className="h-10 w-10" />
            <div>
              <p className="font-black text-slate-900">The Accounts</p>
              <p className="text-[10px] font-bold text-green-700">Dukaan ka digital hisaab</p>
            </div>
          </div>
          <div className="flex gap-2 items-center">
            <span className="text-xs font-bold text-green-800 bg-green-100 px-2 py-1 rounded-lg">اردو</span>
            <Link href="/register" className="px-4 py-2 bg-green-700 hover:bg-green-800 text-white font-bold rounded-xl text-sm">
              Muft Trial
            </Link>
          </div>
        </div>
      </header>

      <section className="py-16 lg:py-24">
        <div className="max-w-6xl mx-auto px-4 grid lg:grid-cols-2 gap-12 items-center">
          <div className="space-y-6">
            <p className="text-green-800 font-bold text-sm">Pakistan ki har dukaan ke liye</p>
            <h1 className="text-4xl lg:text-[2.75rem] font-black leading-snug text-slate-900">
              Dukaan ka hisaab ab phone pe —
              <span className="text-green-700"> offline bhi chalega</span>
            </h1>
            <p className="text-lg text-stone-600 leading-relaxed">
              Scan karo, bill banao, udhaar likho, WhatsApp pe receipt bhejo.
              Karyana, pharmacy, tailor — sab ke liye aasan system.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link href="/register" className="px-6 py-3.5 bg-green-700 text-white font-black rounded-2xl flex items-center gap-2">
                Muft Trial Shuru Karein <ArrowRight size={18} />
              </Link>
            </div>
            <div className="flex gap-4 pt-2">
              <img src="/images/pos_terminal_isolated.png" alt="" className="h-16 opacity-80" />
              <div className="text-xs text-stone-500">
                <p className="font-bold text-stone-700">JazzCash · EasyPaisa · Bank</p>
                <p>Manual payment bhi accept</p>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {[
              { icon: ScanLine, title: "Barcode Scan", ur: "Tez billing counter pe" },
              { icon: MessageCircle, title: "WhatsApp Bill", ur: "Customer ko turant receipt" },
              { icon: BookOpen, title: "Udhaar Khata", ur: "Har customer ka ledger" },
              { icon: ArrowRight, title: "Rozana Munafa", ur: "1 click profit report" },
            ].map(({ icon: Icon, title, ur }) => (
              <div key={title} className="bg-white p-5 rounded-2xl border border-stone-200 shadow-sm">
                <Icon size={22} className="text-green-700 mb-2" />
                <p className="font-black text-sm">{title}</p>
                <p className="text-[11px] text-stone-500 mt-1">{ur}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16 bg-green-800 text-white">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h2 className="text-2xl font-black mb-4">Aaj hi 14 din muft try karein</h2>
          <p className="text-green-100 mb-6">Credit card ki zaroorat nahi · 2 minute mein setup</p>
          <Link href="/register" className="inline-block px-8 py-3 bg-white text-green-800 font-black rounded-xl">
            Register Karein
          </Link>
        </div>
      </section>

      <MockupFooter />
    </div>
  );
}
