"use client";

import React from "react";
import Link from "next/link";
import { Scale, ArrowLeft, Mail, Phone, MapPin, FileText } from "lucide-react";

export default function TermsPage() {
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
            <FileText size={180} />
          </div>

          <div className="mb-8 border-b border-slate-100 pb-6">
            <h1 className="text-3xl font-black text-slate-900 tracking-tight">Terms & Conditions</h1>
            <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mt-1.5">Last Updated: July 15, 2026</p>
          </div>

          <div className="space-y-6 text-sm leading-relaxed">
            <section className="space-y-2.5">
              <h2 className="text-lg font-black text-slate-800 tracking-tight">1. Introduction</h2>
              <p>
                Welcome to The Accounts, a bilingual Point of Sale (POS) and lightweight Enterprise Resource Planning (ERP) platform designed for small and medium-sized enterprises (SMEs). By accessing or using our website, cloud synchronization networks, and application dashboards, you agree to comply with and be bound by these Terms & Conditions.
              </p>
            </section>

            <section className="space-y-2.5">
              <h2 className="text-lg font-black text-slate-800 tracking-tight">2. Business Model</h2>
              <p>
                The Accounts operates on a **Software-as-a-Service (SaaS) subscription model**. We license our cloud-synchronized terminal software to retail and commerce businesses.
              </p>
              <ul className="list-disc pl-5 space-y-1 text-slate-600 font-medium">
                <li>We do not sell physical hardware or physical goods. All of our services are delivered digitally.</li>
                <li>Merchants subscribe to our platform under recurring monthly or yearly billing cycles (e.g., Starter or Premium plans).</li>
                <li>Subscriptions can be cancelled at any time by the business owner via the dashboard billing panel.</li>
              </ul>
            </section>

            <section className="space-y-2.5">
              <h2 className="text-lg font-black text-slate-800 tracking-tight">3. Payment Gateway Intended Use Case</h2>
              <p>
                To facilitate active software licenses, The Accounts integrates third-party payment gateways (such as Safepay) to process payment transactions.
              </p>
              <ul className="list-disc pl-5 space-y-1 text-slate-600 font-medium">
                <li><strong>Gateway Purpose:</strong> The payment gateway is utilized exclusively to charge and collect recurring subscription license fees from registered merchants who wish to activate or renew their software tiers.</li>
                <li><strong>Customer Checkout Process:</strong> During the subscription payment flow, the merchant selects their desired licensing tier (Starter or Premium) in the Billing Panel and clicks "Buy Subscription". The interface securely redirects them to the payment gateway's hosted page where they enter their credentials (credit/debit card, mobile wallet details, etc.). Upon verification, the gateway returns a callback to our server, instantly provisioning or extending their software license.</li>
                <li><strong>No Storefront Payments:</strong> The payment gateway on the platform is *not* used by the retail customers of the shops themselves; it is only used by the shop *owners* to pay for their ERP software licenses.</li>
              </ul>
            </section>

            <section className="space-y-2.5">
              <h2 className="text-lg font-black text-slate-800 tracking-tight">4. Account Obligations</h2>
              <p>
                Registered business owners are responsible for maintaining the confidentiality of their login credentials. Any staff member accounts created under your shop ID are subject to permissions gates configured by your superadmin panel. You are responsible for all entries (invoices, expenses, ledgers) committed to the database.
              </p>
            </section>

            <section className="space-y-2.5">
              <h2 className="text-lg font-black text-slate-800 tracking-tight">5. Service Limitations</h2>
              <p>
                While we employ offline database queues (IndexedDB) to keep registers running during local network failures, complete ledger sync requires an active internet connection. We are not responsible for transaction mismatch issues resulting from hardware failures (e.g., barcode scanners or digital scale misconfigurations).
              </p>
            </section>

            <section className="space-y-2.5">
              <h2 className="text-lg font-black text-slate-800 tracking-tight">6. Contact Information</h2>
              <p>
                For questions regarding our terms of service, billing policies, or subscription renewals, please get in touch with us:
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
