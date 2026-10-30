import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export function MockupBanner({ label }: { label: string }) {
  return (
    <div className="sticky top-0 z-[100] bg-amber-400 text-amber-950 text-center py-2 px-4 text-sm font-bold border-b border-amber-500/30">
      MOCKUP PREVIEW — {label} — Yeh abhi live site nahi hai
      <Link
        href="/preview/landing"
        className="ml-3 underline hover:no-underline inline-flex items-center gap-1"
      >
        <ArrowLeft size={14} />
        Sab designs dekhein
      </Link>
    </div>
  );
}

export function MockupNav({ accent = "indigo" }: { accent?: "indigo" | "emerald" | "sky" | "violet" }) {
  const btn =
    accent === "emerald"
      ? "bg-emerald-600 hover:bg-emerald-700"
      : accent === "sky"
        ? "bg-sky-600 hover:bg-sky-700"
        : accent === "violet"
          ? "bg-violet-600 hover:bg-violet-700"
          : "bg-indigo-600 hover:bg-indigo-700";

  return (
    <header className="bg-white/95 backdrop-blur border-b border-slate-200 sticky top-[41px] z-50">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <img src="/the-accounts-official-logo.png" alt="" className="h-10 w-10" />
          <div>
            <p className="font-black text-slate-900 text-sm leading-tight">The Accounts</p>
            <p className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider">POS & ERP</p>
          </div>
        </div>
        <nav className="hidden md:flex gap-6 text-sm font-semibold text-slate-600">
          <a href="#features" className="hover:text-indigo-600">Features</a>
          <a href="#pricing" className="hover:text-indigo-600">Pricing</a>
          <a href="#faq" className="hover:text-indigo-600">FAQ</a>
        </nav>
        <div className="flex gap-2">
          <Link href="/login" className="px-3 py-2 text-sm font-bold text-slate-700">
            Login
          </Link>
          <Link href="/register" className={`px-4 py-2 text-sm font-bold text-white rounded-xl ${btn}`}>
            Free Trial
          </Link>
        </div>
      </div>
    </header>
  );
}

export function MockupFooter() {
  return (
    <footer className="bg-white border-t border-slate-200 py-10">
      <div className="max-w-6xl mx-auto px-4 text-center text-sm text-slate-500">
        <p className="font-bold text-slate-800 mb-1">The Accounts — Mockup Preview</p>
        <p>© 2026 · theaccounts.cloud</p>
      </div>
    </footer>
  );
}
