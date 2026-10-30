import Link from "next/link";
import { ArrowRight, ExternalLink } from "lucide-react";

const DESIGNS = [
  {
    id: "01",
    slug: "01",
    name: "Design 1 — Trusted Upgrade",
    desc: "Current jaisa light indigo style — polish, trust strip, POS screenshot, pricing. Sab se safe option.",
    colors: "White + Indigo",
    href: "/preview/landing/01",
  },
  {
    id: "02",
    slug: "02",
    name: "Design 2 — Industry Picker",
    desc: "Pehle pharmacy / karyana / restaurant choose karo — phir us industry ke features dikhein.",
    colors: "White + Emerald",
    href: "/preview/landing/02",
  },
  {
    id: "03",
    slug: "03",
    name: "Design 3 — Social Proof",
    desc: "Reviews, stars, before/after, WhatsApp support button. Ads se aane wale users ke liye.",
    colors: "White + Green",
    href: "/preview/landing/03",
  },
  {
    id: "04",
    slug: "04",
    name: "Design 4 — Minimal Clean",
    desc: "Bohot simple — kam text, ek screenshot, 3 bullets. Mobile pe tez load.",
    colors: "White + Sky Blue",
    href: "/preview/landing/04",
  },
  {
    id: "05",
    slug: "05",
    name: "Design 5 — Urdu Roman First",
    desc: "Roman Urdu hero, cream background, green accents — local dukaandar ke liye.",
    colors: "Cream + Green",
    href: "/preview/landing/05",
  },
  {
    id: "06",
    slug: "06",
    name: "Design 6 — Product Tour",
    desc: "POS → Stock → Khata → Report step by step scroll. Feature samjhane ke liye.",
    colors: "White + Violet",
    href: "/preview/landing/06",
  },
];

export default function LandingPreviewGallery() {
  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <div className="bg-indigo-600 text-white py-12 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <p className="text-indigo-200 text-sm font-bold uppercase tracking-wider mb-2">Landing page mockups</p>
          <h1 className="text-3xl lg:text-4xl font-black mb-3">6 light-theme designs — khud dekhein, phir approve karein</h1>
          <p className="text-indigo-100 max-w-2xl mx-auto">
            Neeche har card pe &ldquo;Poora page kholo&rdquo; click karein. Dark theme nahi hai kisi mein.
            Jo pasand aaye number bata dein (1–6).
          </p>
          <Link href="/" className="inline-block mt-6 text-sm underline text-indigo-200">
            ← Live homepage (abhi wala)
          </Link>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-12 grid md:grid-cols-2 gap-6">
        {DESIGNS.map((d) => (
          <article
            key={d.id}
            className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden hover:shadow-md transition-shadow"
          >
            <div className="h-36 bg-gradient-to-br from-slate-50 to-slate-100 border-b border-slate-100 flex items-center justify-center">
              <span className="text-6xl font-black text-slate-200">{d.id}</span>
            </div>
            <div className="p-6">
              <h2 className="font-black text-lg mb-2">{d.name}</h2>
              <p className="text-sm text-slate-600 mb-3 leading-relaxed">{d.desc}</p>
              <p className="text-xs font-bold text-indigo-600 mb-4">{d.colors}</p>
              <Link
                href={d.href}
                target="_blank"
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-sm"
              >
                Poora page kholo <ExternalLink size={16} />
              </Link>
            </div>
          </article>
        ))}
      </div>

      <div className="max-w-3xl mx-auto px-4 pb-16 text-center">
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 text-left">
          <p className="font-black text-amber-900 mb-2">Approve kaise karein?</p>
          <p className="text-sm text-amber-950/80">
            Message mein likhein: <strong>&ldquo;Design 2 implement karo&rdquo;</strong> ya{" "}
            <strong>&ldquo;Design 5 hero + Design 1 pricing&rdquo;</strong>. Tab main asli homepage replace karunga.
          </p>
        </div>
      </div>
    </div>
  );
}
