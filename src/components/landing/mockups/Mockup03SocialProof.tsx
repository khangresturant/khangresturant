import Link from "next/link";
import { ArrowRight, Star, Quote } from "lucide-react";
import { MockupBanner, MockupFooter, MockupNav } from "@/components/landing/mockups/MockupChrome";

const REVIEWS = [
  { name: "Ahmed — Lahore Pharmacy", text: "Pehle register book thi, ab expiry alert mil jati hai. Offline bhi chalta hai.", stars: 5 },
  { name: "Fatima — Karachi Restaurant", text: "KOT aur table map se kitchen ka kaam half ho gaya.", stars: 5 },
  { name: "Hassan — Faisalabad Mart", text: "Udhaar ka hisab aur WhatsApp bill — customers khush.", stars: 5 },
];

/** Design 3 — testimonials & trust, light green accents */
export default function Mockup03SocialProof() {
  return (
    <div className="min-h-screen bg-white text-slate-900">
      <MockupBanner label="Design 3 — Social Proof (Light)" />
      <MockupNav accent="emerald" />

      <section className="py-20 bg-gradient-to-b from-emerald-50/80 to-white">
        <div className="max-w-6xl mx-auto px-4 text-center">
          <div className="flex justify-center gap-1 mb-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <Star key={i} size={24} className="text-amber-400 fill-amber-400" />
            ))}
          </div>
          <p className="text-sm font-bold text-emerald-700 mb-2">4.9 / 5 — dukaandar reviews</p>
          <h1 className="text-4xl lg:text-5xl font-black text-slate-900 max-w-3xl mx-auto mb-6">
            Hazaron dukaandar apna hisaab The Accounts se chala rahe hain
          </h1>
          <p className="text-lg text-slate-600 max-w-xl mx-auto mb-8">
            Asli POS, asli offline billing, asli WhatsApp receipts — Pakistan ki dukaan ke liye banaya gaya.
          </p>
          <Link
            href="/register"
            className="inline-flex px-8 py-4 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-2xl items-center gap-2 shadow-lg shadow-emerald-600/20"
          >
            2 Minute Mein Free Trial <ArrowRight size={20} />
          </Link>
          <p className="text-xs text-slate-500 mt-4">JazzCash · EasyPaisa · Bank transfer accepted</p>
        </div>
      </section>

      <section className="py-16 -mt-8">
        <div className="max-w-6xl mx-auto px-4 grid md:grid-cols-3 gap-6">
          {REVIEWS.map((r) => (
            <div key={r.name} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-md">
              <Quote size={28} className="text-emerald-200 mb-3" />
              <p className="text-sm text-slate-700 leading-relaxed mb-4">&ldquo;{r.text}&rdquo;</p>
              <div className="flex gap-0.5 mb-2">
                {Array.from({ length: r.stars }).map((_, i) => (
                  <Star key={i} size={14} className="text-amber-400 fill-amber-400" />
                ))}
              </div>
              <p className="text-xs font-bold text-slate-900">{r.name}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="py-16 bg-slate-50">
        <div className="max-w-6xl mx-auto px-4 grid lg:grid-cols-2 gap-10 items-center">
          <div className="bg-white p-6 rounded-2xl border-2 border-red-100">
            <p className="text-xs font-bold text-red-600 uppercase mb-2">Pehle (Purana tareeqa)</p>
            <ul className="text-sm text-slate-600 space-y-2">
              <li>• Register book mein udhaar</li>
              <li>• Expiry miss ho jati hai</li>
              <li>• Munafa pata nahi kitna</li>
            </ul>
          </div>
          <div className="bg-white p-6 rounded-2xl border-2 border-emerald-200">
            <p className="text-xs font-bold text-emerald-600 uppercase mb-2">Ab (The Accounts)</p>
            <ul className="text-sm text-slate-700 space-y-2 font-medium">
              <li>✓ Digital khata + WhatsApp reminder</li>
              <li>✓ Batch expiry color alerts</li>
              <li>✓ 1-click daily profit report</li>
            </ul>
          </div>
        </div>
      </section>

      <section className="py-12 bg-emerald-600 text-white text-center">
        <p className="font-black text-xl mb-4">WhatsApp pe sawaal hai?</p>
        <a href="https://wa.me/923001234567" className="inline-block px-6 py-3 bg-white text-emerald-700 font-bold rounded-xl">
          WhatsApp Support
        </a>
      </section>

      <MockupFooter />
    </div>
  );
}
