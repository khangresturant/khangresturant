"use client";

import React from "react";
import Link from "next/link";
import { Scale, ArrowLeft, Mail, Phone, MapPin, RefreshCw } from "lucide-react";

export default function RefundPolicyPage() {
  return (
    <div className="min-h-screen bg-[#fafafa] font-sans text-slate-700 relative overflow-hidden selection:bg-indigo-150">
      {/* Background Mesh Gradients */}
      <div className="absolute top-0 inset-x-0 h-[400px] bg-gradient-to-br from-blue-100/40 via-indigo-100/30 to-pink-100/20 opacity-80 blur-3xl -z-10 pointer-events-none" />
      <div className="absolute inset-0 bg-[radial-gradient(#6366f1_0.08rem,transparent_0.08rem)] [background-size:2rem_2rem] opacity-[0.05] pointer-events-none" />

      {/* Header / Nav */}
      <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-slate-200/60">
        <div className="max-w-6xl mx-auto px-6 h-20 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 group">
            <div className="w-9 h-9 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-xl flex items-center justify-center shadow-md">
              <Scale size={16} className="text-white" />
            </div>
            <span className="font-extrabold text-xl text-slate-900 tracking-tight">
              The <span className="text-indigo-600">Accounts</span>
            </span>
          </Link>
          <Link href="/">
            <button className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-black uppercase tracking-wider text-slate-600 hover:text-indigo-650 hover:bg-slate-50 border border-slate-250/60 rounded-xl transition cursor-pointer">
              <ArrowLeft size={13} /> Back to Home
            </button>
          </Link>
        </div>
      </nav>

      {/* Content Container */}
      <div className="max-w-4xl mx-auto px-6 py-12">
        <div className="bg-white border border-slate-200 rounded-[2.5rem] p-8 md:p-12 shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8 text-indigo-500/10 pointer-events-none">
            <RefreshCw size={180} className="animate-spin-slow" />
          </div>

          <div className="mb-8 border-b border-slate-100 pb-6">
            <h1 className="text-3xl font-black text-slate-900 tracking-tight">Refund Policy</h1>
            <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mt-1.5">Last Updated: July 15, 2026</p>
          </div>

          <div className="space-y-6 text-sm leading-relaxed">
            <section className="space-y-2.5">
              <h2 className="text-lg font-black text-slate-800 tracking-tight">1. Subscription Trial Period</h2>
              <p>
                To ensure The Accounts is the right fit for your retail or wholesale business, we offer a **14-day free trial** on all registration signups. During this trial period, you have unrestricted access to all software features (including variants cataloging, staff management, and double-entry accounting ledger integrations). No billing details or payment gateway authorizations are required for the trial.
              </p>
            </section>

            <section className="space-y-2.5">
              <h2 className="text-lg font-black text-slate-800 tracking-tight">2. Refund Eligibility Window</h2>
              <p>
                If you are unsatisfied with our SaaS services after subscribing to a paid plan (Starter or Premium), you may request a refund under the following conditions:
              </p>
              <ul className="list-disc pl-5 space-y-1 text-slate-600 font-medium">
                <li><strong>Refund Request Period:</strong> Refund requests must be submitted within **7 days** of the initial payment date of your subscription.</li>
                <li><strong>Subsequent Renewals:</strong> Monthly or yearly auto-renewals are not eligible for refunds. You can cancel your subscription at any time to prevent future billing.</li>
                <li><strong>Applicability:</strong> Refunds are only applicable to your first subscription setup fee and do not apply if a customer cancels and registers a new store under a different ID.</li>
              </ul>
            </section>

            <section className="space-y-2.5">
              <h2 className="text-lg font-black text-slate-800 tracking-tight">3. How Refunds are Processed</h2>
              <p>
                To request a refund, please send an email to our support team at **usmanmalikg7867@gmail.com** containing your account login email, shop name, and transaction reference ID.
              </p>
              <p>
                Once approved, refunds are processed automatically by our billing team. The funds will be credited back to your original payment method (e.g., the credit/debit card or mobile wallet used at checkout) within **5 to 10 business days**, depending on your bank's processing cycles.
              </p>
            </section>

            <section className="space-y-2.5">
              <h2 className="text-lg font-black text-slate-800 tracking-tight">4. Cancellation and Account State</h2>
              <p>
                Upon the successful processing of a refund, your shop's subscription tier will be downgraded to the "Free" tier. You will still have read-only access to historical transaction ledgers, but billing, POS registers checkout, and sync modules will be locked until a new license is purchased.
              </p>
            </section>

            <section className="space-y-2.5">
              <h2 className="text-lg font-black text-slate-800 tracking-tight">5. Contact Support</h2>
              <p>
                If you have any issues with your billing transaction or need to dispute a double charge, please reach out to us:
              </p>
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-2.5 max-w-md font-semibold text-xs mt-3">
                <div className="flex items-center gap-2.5 text-slate-655">
                  <Mail size={14} className="text-indigo-650" />
                  <span>Email: usmanmalikg7867@gmail.com</span>
                </div>
                <div className="flex items-center gap-2.5 text-slate-655">
                  <Phone size={14} className="text-indigo-650" />
                  <span>Contact Number: +92 324 5836626</span>
                </div>
                <div className="flex items-start gap-2.5 text-slate-655">
                  <MapPin size={14} className="text-indigo-650 mt-0.5 shrink-0" />
                  <span>Address: Main Bazar Karampur, Tehsil Mailsi, District Vehari, Punjab, Pakistan</span>
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white py-8 text-center text-xs text-slate-400 font-bold uppercase tracking-wider mt-12">
        &copy; {new Date().getFullYear()} The Accounts. All Rights Reserved.
      </footer>
    </div>
  );
}
