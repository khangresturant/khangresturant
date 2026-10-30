import Link from "next/link";
import { ArrowRight, Pill, ChefHat, Store, Scissors, Smartphone, Leaf, Fuel } from "lucide-react";
import { MockupBanner, MockupFooter, MockupNav } from "@/components/landing/mockups/MockupChrome";

const VERTICALS = [
  { id: "pharmacy", name: "Pharmacy", icon: Pill, color: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  { id: "restaurant", name: "Restaurant", icon: ChefHat, color: "bg-rose-100 text-rose-700 border-rose-200" },
  { id: "supermarket", name: "Karyana / Mart", icon: Store, color: "bg-sky-100 text-sky-700 border-sky-200" },
  { id: "tailor", name: "Tailor", icon: Scissors, color: "bg-amber-100 text-amber-700 border-amber-200" },
  { id: "electronics", name: "Mobile Shop", icon: Smartphone, color: "bg-blue-100 text-blue-700 border-blue-200" },
  { id: "fertilizer", name: "Fertilizer", icon: Leaf, color: "bg-lime-100 text-lime-700 border-lime-200" },
  { id: "fuel", name: "Petrol Pump", icon: Fuel, color: "bg-orange-100 text-orange-700 border-orange-200" },
];

/** Design 2 — pehle industry choose karo */
export default function Mockup02Industry() {
  return (
    <div className="min-h-screen bg-white text-slate-900">
      <MockupBanner label="Design 2 — Industry Picker (Light)" />
      <MockupNav accent="emerald" />

      <section className="py-16 lg:py-20">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <h1 className="text-4xl lg:text-5xl font-black text-slate-900 mb-4">
              Pehle apni dukaan ka type chunein
            </h1>
            <p className="text-lg text-slate-600">
              Har business ke liye alag features — pharmacy mein expiry, restaurant mein KOT,
              karyana mein scale barcode.
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 mb-12">
            {VERTICALS.map((v) => {
              const Icon = v.icon;
              return (
                <Link
                  key={v.id}
                  href={`/register?industry=${v.id}`}
                  className={`p-6 rounded-2xl border-2 ${v.color} hover:scale-[1.02] transition-transform text-center group`}
                >
                  <Icon size={32} className="mx-auto mb-3" />
                  <p className="font-black text-sm">{v.name}</p>
                  <p className="text-[10px] opacity-70 mt-1 group-hover:underline">Is ke liye shuru karein →</p>
                </Link>
              );
            })}
          </div>

          <div className="bg-slate-50 rounded-3xl p-8 lg:p-12 border border-slate-200 grid lg:grid-cols-2 gap-10 items-center">
            <div>
              <span className="text-xs font-bold uppercase text-emerald-600 bg-emerald-100 px-2 py-1 rounded">
                Example: Pharmacy selected
              </span>
              <h2 className="text-2xl font-black mt-4 mb-3">Medical store ke liye tayyar POS</h2>
              <ul className="space-y-2 text-sm text-slate-700">
                {["Batch & expiry alerts", "Narcotics register", "Box to strip conversion", "Doctor Rx log"].map((f) => (
                  <li key={f} className="flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> {f}
                  </li>
                ))}
              </ul>
              <Link
                href="/register?industry=pharmacy"
                className="inline-flex mt-6 px-5 py-3 bg-emerald-600 text-white font-bold rounded-xl items-center gap-2"
              >
                Pharmacy Free Trial <ArrowRight size={16} />
              </Link>
            </div>
            <img
              src="/images/theaccounts_pos_dashboard_monitor.png"
              alt="Pharmacy POS"
              className="rounded-2xl border border-slate-200 shadow-xl"
            />
          </div>
        </div>
      </section>

      <section id="pricing" className="py-16 bg-emerald-50/50 border-y border-emerald-100">
        <div className="max-w-3xl mx-auto px-4 text-center">
          <h2 className="text-2xl font-black mb-6">Ek hi pricing — har industry ke liye</h2>
          <p className="text-slate-600 mb-6">Free trial · JazzCash / EasyPaisa · No credit card</p>
          <Link href="/register" className="px-8 py-4 bg-emerald-600 text-white font-black rounded-2xl inline-block">
            Abhi Register Karein
          </Link>
        </div>
      </section>

      <MockupFooter />
    </div>
  );
}
