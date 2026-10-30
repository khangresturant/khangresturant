"use client";

import React from "react";
import Link from "next/link";
import { Scale, ArrowLeft, Mail, Phone, MapPin, ShieldCheck } from "lucide-react";

export default function PrivacyPolicyPage() {
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
            <ShieldCheck size={180} />
          </div>

          <div className="mb-8 border-b border-slate-100 pb-6">
            <h1 className="text-3xl font-black text-slate-900 tracking-tight">Privacy Policy</h1>
            <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mt-1.5">Last Updated: July 15, 2026</p>
          </div>

          <div className="space-y-6 text-sm leading-relaxed">
            <section className="space-y-2.5">
              <h2 className="text-lg font-black text-slate-800 tracking-tight">1. Information We Collect</h2>
              <p>
                At The Accounts, we collect information to provide better services to our merchants. This includes:
              </p>
              <ul className="list-disc pl-5 space-y-1 text-slate-600 font-medium">
                <li><strong>Account Information:</strong> Your name, email address, password, and telephone number when you register a business.</li>
                <li><strong>Business Metadata:</strong> Shop name, shop address, contact number, industry vertical, and settings preferences.</li>
                <li><strong>Operational Data:</strong> Products catalog, inventory counts, invoice details, supplier profiles, and financial transaction records created during business operation.</li>
              </ul>
            </section>

            <section className="space-y-2.5">
              <h2 className="text-lg font-black text-slate-800 tracking-tight">2. How We Use Information</h2>
              <p>
                The information collected is used solely to run our Software-as-a-Service (SaaS) POS and ERP modules. Specifically, we use your data to:
              </p>
              <ul className="list-disc pl-5 space-y-1 text-slate-600 font-medium">
                <li>Create and manage your business accounts and provide secure access control.</li>
                <li>Process subscription licensing payments via our integrated payment gateways.</li>
                <li>Maintain localized database performance, run automatic general ledger accounting journals, and run offline synchronization safely.</li>
                <li>Diagnose operational errors, improve UI layouts, and provide support tickets assistance.</li>
              </ul>
            </section>

            <section className="space-y-2.5">
              <h2 className="text-lg font-black text-slate-800 tracking-tight">3. Data Security and Isolation</h2>
              <p>
                Your operational data is protected by strict **Row-Level Security (RLS)** protocols in our PostgreSQL database. This ensures your sales lists, supplier ledgers, and financial logs are completely isolated and accessible only to authenticated members of your specific shop ID.
              </p>
              <p>
                We do not sell, trade, or rent your business operational records or personal data to third parties. We use industry-standard encryption practices to protect your information both in transit and at rest.
              </p>
            </section>

            <section className="space-y-2.5">
              <h2 className="text-lg font-black text-slate-800 tracking-tight">4. Integrated Payment Process</h2>
              <p>
                When purchasing or renewing a subscription to The Accounts, payments are processed securely through certified payment gateways (e.g., Safepay). We do not store your credit card or billing details on our servers; all transaction processing is handled in compliance with international payment card standards (PCI-DSS).
              </p>
            </section>

            <section className="space-y-2.5">
              <h2 className="text-lg font-black text-slate-800 tracking-tight">5. Contact Information</h2>
              <p>
                If you have any questions about this Privacy Policy or how your data is handled, please feel free to contact us:
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
