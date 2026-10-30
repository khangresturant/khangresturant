import Link from "next/link";
import { ArrowRight, ShoppingCart, Package, Users, BarChart3 } from "lucide-react";
import { MockupBanner, MockupFooter, MockupNav } from "@/components/landing/mockups/MockupChrome";

const STEPS = [
  {
    n: 1,
    title: "POS Counter",
    desc: "Barcode scan, hold bill, cash/card/udhaar — counter tez chalega.",
    img: "/images/theaccounts_pos_dashboard_monitor.png",
    icon: ShoppingCart,
  },
  {
    n: 2,
    title: "Stock & Products",
    desc: "Low stock alert, batch expiry, purchase order — saman ka poora control.",
    img: "/images/ai_scanner_preview.png",
    icon: Package,
  },
  {
    n: 3,
    title: "Khata / Udhaar",
    desc: "Har customer ka balance, partial payment, WhatsApp reminder.",
    img: "/hero_preview.png",
    icon: Users,
  },
  {
    n: 4,
    title: "Reports & Munafa",
    desc: "Daily P&L, register closing, PDF export — hisaab clear.",
    img: "/images/theaccounts_pos_dashboard_monitor.png",
    icon: BarChart3,
  },
];

/** Design 6 — scroll tour of product steps */
export default function Mockup06ProductTour() {
  return (
    <div className="min-h-screen bg-white text-slate-900">
      <MockupBanner label="Design 6 — Product Tour (Light)" />
      <MockupNav accent="violet" />

      <section className="py-16 bg-violet-50/50 border-b border-violet-100">
        <div className="max-w-6xl mx-auto px-4 text-center">
          <h1 className="text-4xl font-black mb-4">Andar se dekhein kaise kaam karta hai</h1>
          <p className="text-slate-600 max-w-xl mx-auto mb-8">
            POS se le kar report tak — 4 steps mein poora system samjhein
          </p>
          <Link href="/register" className="px-6 py-3 bg-violet-600 text-white font-bold rounded-xl inline-flex items-center gap-2">
            Khud try karein <ArrowRight size={18} />
          </Link>
        </div>
      </section>

      {STEPS.map((step, idx) => {
        const Icon = step.icon;
        const flip = idx % 2 === 1;
        return (
          <section
            key={step.n}
            className={`py-20 ${idx % 2 === 0 ? "bg-white" : "bg-slate-50"}`}
          >
            <div className={`max-w-6xl mx-auto px-4 grid lg:grid-cols-2 gap-12 items-center ${flip ? "lg:[direction:rtl]" : ""}`}>
              <div className={flip ? "lg:[direction:ltr]" : ""}>
                <div className="flex items-center gap-3 mb-4">
                  <span className="h-10 w-10 rounded-full bg-violet-600 text-white font-black flex items-center justify-center">
                    {step.n}
                  </span>
                  <Icon size={24} className="text-violet-600" />
                </div>
                <h2 className="text-3xl font-black mb-3">{step.title}</h2>
                <p className="text-slate-600 text-lg leading-relaxed">{step.desc}</p>
              </div>
              <div className={flip ? "lg:[direction:ltr]" : ""}>
                <img
                  src={step.img}
                  alt={step.title}
                  className="rounded-2xl border border-slate-200 shadow-xl w-full"
                />
              </div>
            </div>
          </section>
        );
      })}

      <section className="py-16 bg-violet-600 text-white text-center">
        <h2 className="text-2xl font-black mb-4">Ready to start?</h2>
        <Link href="/register" className="inline-block px-8 py-3 bg-white text-violet-700 font-black rounded-xl">
          Free Trial
        </Link>
      </section>

      <MockupFooter />
    </div>
  );
}
