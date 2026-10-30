"use client";

import React from "react";
import Link from "next/link";
import { Scale, ArrowLeft, Mail, Phone, MapPin, Send } from "lucide-react";

export default function ShippingPolicyPage() {
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
            <Send size={180} />
          </div>

          <div className="mb-8 border-b border-slate-100 pb-6">
            <h1 className="text-3xl font-black text-slate-900 tracking-tight">Shipping & Delivery Policy</h1>
            <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mt-1.5">Last Updated: July 15, 2026</p>
          </div>

          <div className="space-y-6 text-sm leading-relaxed">
            <section className="space-y-2.5">
              <h2 className="text-lg font-black text-slate-800 tracking-tight">1. Digital Delivery Model</h2>
              <p>
                The Accounts is a cloud-based Software-as-a-Service (SaaS) business operating terminal. We **do not sell, manufacture, or ship any physical products** (such as barcode scanners, thermal printers, scale indicators, or POS terminal monitors).
              </p>
              <p>
                Because all subscription plans and tools are 100% digital, there are no physical shipping logistics, dispatch notifications, or shipping fees associated with your purchase.
              </p>
            </section>

            <section className="space-y-2.5">
              <h2 className="text-lg font-black text-slate-800 tracking-tight">2. Instant Provisioning Flow</h2>
              <p>
                When you register a business and subscribe to a Starter or Premium plan:
              </p>
              <ul className="list-disc pl-5 space-y-1 text-slate-600 font-medium">
                <li><strong>Delivery Timing:</strong> Access to the paid tiers is provisioned **instantly** upon successful authorization of payment by our gateway providers (e.g., Safepay).</li>
                <li><strong>Access:</strong> Your user profile will be immediately updated to reflect the paid subscription, unlocking staff panels, multi-shop tabs, and financial general ledger access without any delay.</li>
                <li><strong>Email Confirmation:</strong> A payment receipt containing transaction reference details is sent to your registered account email address immediately upon checkout completion.</li>
              </ul>
            </section>

            <section className="space-y-2.5">
              <h2 className="text-lg font-black text-slate-800 tracking-tight">3. Technical Requirements for Activation</h2>
              <p>
                As this is a web-based and local-sync client application, you must have an active internet connection to download the initial database snapshots and sync your offline checkout queue. You do not need to install any physical drivers; all scale and scanner configurations run via web standard APIs in the browser.
              </p>
            </section>

            <section className="space-y-2.5">
              <h2 className="text-lg font-black text-slate-800 tracking-tight">4. Support and Technical Help</h2>
              <p>
                If your payment was completed but your subscription tier was not automatically updated in the Billing Panel, please contact our support team immediately. We will manually verify your payment and activate your license.
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
