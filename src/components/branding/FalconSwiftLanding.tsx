"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  UtensilsCrossed,
  ChefHat,
  Receipt,
  Tv,
  CheckCircle2,
  ArrowRight,
  ShieldCheck,
  Layers,
  LayoutGrid,
  LogIn,
  Printer,
  Smartphone,
} from "lucide-react";

const smoothEase = [0.16, 1, 0.3, 1] as const;

export default function FalconSwiftLanding() {
  return (
    <div className="min-h-screen bg-white text-slate-900 font-sans antialiased pb-16 md:pb-0 overflow-x-hidden selection:bg-slate-900 selection:text-white">
      
      {/* Top Application Header */}
      <motion.header
        initial={{ y: -24, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.6, ease: smoothEase }}
        className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 sm:h-20 flex items-center justify-between">
          
          {/* HD Brand Logo & Title */}
          <Link href="/" className="flex items-center gap-3 group">
            <motion.div
              whileHover={{ scale: 1.06, rotate: -2 }}
              whileTap={{ scale: 0.96 }}
              transition={{ duration: 0.2 }}
              className="relative h-10 w-10 sm:h-12 sm:w-12 shrink-0"
            >
              <Image
                src="/falcon-swift-hd.png"
                alt="Falcon Swift Logo"
                fill
                className="object-contain"
                priority
              />
            </motion.div>
            <div className="flex flex-col">
              <p className="text-xl font-extrabold tracking-tight text-slate-900 leading-tight group-hover:text-sky-700 transition-colors">
                Falcon Swift
              </p>
              <p className="text-xs font-semibold text-slate-500">
                Restaurant Operating System
              </p>
            </div>
          </Link>

          {/* Action Button */}
          <div className="flex items-center gap-3">
            <motion.div
              whileHover={{ scale: 1.03, y: -1 }}
              whileTap={{ scale: 0.97 }}
              transition={{ duration: 0.2 }}
            >
              <Link
                href="/login"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 shadow-xs transition"
              >
                Sign In
                <ArrowRight size={16} />
              </Link>
            </motion.div>
          </div>
        </div>
      </motion.header>

      {/* Main Content */}
      <main>
        
        {/* Hero Section */}
        <section className="bg-slate-50 border-b border-slate-200 pt-10 pb-14 sm:pt-16 sm:pb-20 relative">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid lg:grid-cols-12 gap-10 items-center">
              
              {/* Left Column: Heading & Value */}
              <div className="lg:col-span-7 space-y-6 text-center lg:text-left">
                
                <motion.div
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.1, ease: smoothEase }}
                  className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-md border border-slate-200 bg-white text-slate-800 text-xs font-bold uppercase tracking-wider shadow-xs"
                >
                  Restaurant Point of Sale
                </motion.div>

                <motion.h1
                  initial={{ opacity: 0, y: 22 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.7, delay: 0.18, ease: smoothEase }}
                  className="text-3xl sm:text-4xl lg:text-5xl font-black text-slate-900 tracking-tight leading-tight"
                >
                  High-speed POS, kitchen routing, and floor management.
                </motion.h1>

                <motion.p
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.7, delay: 0.26, ease: smoothEase }}
                  className="text-base sm:text-lg text-slate-600 max-w-2xl mx-auto lg:mx-0 leading-relaxed font-normal"
                >
                  Falcon Swift coordinates dining floor tables, routes tickets to kitchen stations, and accelerates counter checkout for restaurants, cafes, and bistros.
                </motion.p>

                {/* Primary Actions */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.7, delay: 0.34, ease: smoothEase }}
                  className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-3 pt-2"
                >
                  <motion.div
                    whileHover={{ scale: 1.025, y: -1 }}
                    whileTap={{ scale: 0.975 }}
                    transition={{ duration: 0.2 }}
                    className="w-full sm:w-auto"
                  >
                    <Link
                      href="/login"
                      className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-xl font-bold text-sm text-white bg-slate-900 hover:bg-slate-800 shadow-md transition"
                    >
                      <UtensilsCrossed size={18} />
                      Sign In to POS Terminal
                    </Link>
                  </motion.div>

                  <motion.div
                    whileHover={{ scale: 1.02, y: -1 }}
                    whileTap={{ scale: 0.98 }}
                    transition={{ duration: 0.2 }}
                    className="w-full sm:w-auto"
                  >
                    <a
                      href="#modules"
                      className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl font-semibold text-sm text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 transition"
                    >
                      System Features
                      <ArrowRight size={16} />
                    </a>
                  </motion.div>
                </motion.div>

                {/* Practical Capabilities List */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.8, delay: 0.42 }}
                  className="pt-4 grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-lg mx-auto lg:mx-0 text-left"
                >
                  <motion.div
                    whileHover={{ x: 2 }}
                    className="flex items-center gap-2 text-xs font-semibold text-slate-700"
                  >
                    <CheckCircle2 size={16} className="text-slate-900 shrink-0" />
                    Table Floor Management
                  </motion.div>
                  <motion.div
                    whileHover={{ x: 2 }}
                    className="flex items-center gap-2 text-xs font-semibold text-slate-700"
                  >
                    <CheckCircle2 size={16} className="text-slate-900 shrink-0" />
                    Kitchen Display Routing
                  </motion.div>
                  <motion.div
                    whileHover={{ x: 2 }}
                    className="flex items-center gap-2 text-xs font-semibold text-slate-700"
                  >
                    <CheckCircle2 size={16} className="text-slate-900 shrink-0" />
                    Offline POS Terminal
                  </motion.div>
                </motion.div>

              </div>

              {/* Right Column: Clean Visual Showcase */}
              <div className="lg:col-span-5">
                <motion.div
                  initial={{ opacity: 0, scale: 0.94, y: 30 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  transition={{ duration: 0.8, delay: 0.22, ease: smoothEase }}
                  whileHover={{ y: -4, boxShadow: "0 20px 35px -10px rgba(15, 23, 42, 0.1)" }}
                  className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-all"
                >
                  
                  {/* Clean Visual Header */}
                  <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                    <div className="flex items-center gap-3">
                      <motion.div
                        whileHover={{ scale: 1.08, rotate: 3 }}
                        transition={{ duration: 0.2 }}
                        className="relative h-10 w-10 shrink-0"
                      >
                        <Image
                          src="/falcon-swift-hd.png"
                          alt="Falcon Swift HD Logo"
                          fill
                          className="object-contain"
                        />
                      </motion.div>
                      <div>
                        <p className="text-sm font-bold text-slate-900">Falcon Swift Station</p>
                        <p className="text-xs text-slate-500">Restaurant Terminal</p>
                      </div>
                    </div>
                    <div className="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-md">
                      Online
                    </div>
                  </div>

                  {/* Chef Artwork Presentation */}
                  <motion.div
                    whileHover={{ scale: 1.01 }}
                    transition={{ duration: 0.3 }}
                    className="my-6 flex flex-col sm:flex-row items-center gap-6 bg-slate-50 p-5 rounded-xl border border-slate-100"
                  >
                    <motion.div
                      animate={{ y: [0, -3, 0] }}
                      transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                      className="relative h-44 w-32 shrink-0"
                    >
                      <Image
                        src="/chef-illustration.png"
                        alt="Restaurant Head Chef"
                        fill
                        className="object-contain"
                        priority
                      />
                    </motion.div>
                    <div className="space-y-2 text-left">
                      <p className="text-sm font-bold text-slate-900">
                        Kitchen and Floor Coordination
                      </p>
                      <p className="text-xs text-slate-600 leading-relaxed">
                        Orders punched at the counter or table-side route straight to kitchen cook screens and bar printers without delay.
                      </p>
                      <div className="pt-2">
                        <Link
                          href="/login"
                          className="inline-flex items-center gap-1.5 text-xs font-bold text-sky-700 hover:text-sky-800 group"
                        >
                          Launch Terminal
                          <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
                        </Link>
                      </div>
                    </div>
                  </motion.div>

                  {/* Real System Specifications */}
                  <div className="grid grid-cols-3 gap-2 text-center text-xs">
                    <motion.div
                      whileHover={{ scale: 1.03, backgroundColor: "#f1f5f9" }}
                      transition={{ duration: 0.2 }}
                      className="p-2.5 rounded-lg border border-slate-100 bg-slate-50"
                    >
                      <p className="text-slate-500">Floor Layout</p>
                      <p className="font-bold text-slate-900 mt-0.5">Dine-in Tables</p>
                    </motion.div>
                    <motion.div
                      whileHover={{ scale: 1.03, backgroundColor: "#f1f5f9" }}
                      transition={{ duration: 0.2 }}
                      className="p-2.5 rounded-lg border border-slate-100 bg-slate-50"
                    >
                      <p className="text-slate-500">Kitchen View</p>
                      <p className="font-bold text-slate-900 mt-0.5">Station KDS</p>
                    </motion.div>
                    <motion.div
                      whileHover={{ scale: 1.03, backgroundColor: "#f1f5f9" }}
                      transition={{ duration: 0.2 }}
                      className="p-2.5 rounded-lg border border-slate-100 bg-slate-50"
                    >
                      <p className="text-slate-500">Checkout</p>
                      <p className="font-bold text-slate-900 mt-0.5">Thermal ESC/POS</p>
                    </motion.div>
                  </div>

                </motion.div>
              </div>

            </div>
          </div>
        </section>

        {/* Core Restaurant Modules */}
        <section id="modules" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20">
          
          <motion.div
            initial={{ opacity: 0, y: 22 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.6, ease: smoothEase }}
            className="max-w-3xl mx-auto text-center mb-12 space-y-2"
          >
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              Restaurant System Capabilities
            </h2>
            <p className="text-sm sm:text-base text-slate-600">
              Core operational modules designed for front of house, back of house, and counter billing.
            </p>
          </motion.div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            
            {/* Capability 1 */}
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.5, delay: 0.05, ease: smoothEase }}
              whileHover={{ y: -5, borderColor: "#cbd5e1", boxShadow: "0 12px 24px -6px rgba(15, 23, 42, 0.08)" }}
              className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs transition-all group"
            >
              <div className="h-10 w-10 rounded-lg bg-slate-100 text-slate-900 flex items-center justify-center mb-4 group-hover:bg-slate-900 group-hover:text-white transition-colors">
                <LayoutGrid size={20} />
              </div>
              <h3 className="text-base font-bold text-slate-900 mb-2">Table Floor Management</h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                Visual floor map showing occupied, reserved, bill-raised, and cleaning dining tables with split check and transfer support.
              </p>
            </motion.div>

            {/* Capability 2 */}
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.5, delay: 0.12, ease: smoothEase }}
              whileHover={{ y: -5, borderColor: "#cbd5e1", boxShadow: "0 12px 24px -6px rgba(15, 23, 42, 0.08)" }}
              className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs transition-all group"
            >
              <div className="h-10 w-10 rounded-lg bg-slate-100 text-slate-900 flex items-center justify-center mb-4 group-hover:bg-slate-900 group-hover:text-white transition-colors">
                <Tv size={20} />
              </div>
              <h3 className="text-base font-bold text-slate-900 mb-2">Kitchen Display Screens</h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                Digital order monitors for chefs with color-coded preparation timers, station filtering, and dish status updates.
              </p>
            </motion.div>

            {/* Capability 3 */}
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.5, delay: 0.19, ease: smoothEase }}
              whileHover={{ y: -5, borderColor: "#cbd5e1", boxShadow: "0 12px 24px -6px rgba(15, 23, 42, 0.08)" }}
              className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs transition-all group"
            >
              <div className="h-10 w-10 rounded-lg bg-slate-100 text-slate-900 flex items-center justify-center mb-4 group-hover:bg-slate-900 group-hover:text-white transition-colors">
                <ChefHat size={20} />
              </div>
              <h3 className="text-base font-bold text-slate-900 mb-2">Kitchen Order Tickets</h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                Automated KOT print routing to kitchen cook stations and beverage counters immediately when staff confirms an order.
              </p>
            </motion.div>

            {/* Capability 4 */}
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.5, delay: 0.26, ease: smoothEase }}
              whileHover={{ y: -5, borderColor: "#cbd5e1", boxShadow: "0 12px 24px -6px rgba(15, 23, 42, 0.08)" }}
              className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs transition-all group"
            >
              <div className="h-10 w-10 rounded-lg bg-slate-100 text-slate-900 flex items-center justify-center mb-4 group-hover:bg-slate-900 group-hover:text-white transition-colors">
                <Layers size={20} />
              </div>
              <h3 className="text-base font-bold text-slate-900 mb-2">Recipe Stock Tracking</h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                Bill of materials calculation to deduct raw ingredients like cheese, meats, and sauces accurately per meal prepared.
              </p>
            </motion.div>

            {/* Capability 5 */}
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.5, delay: 0.33, ease: smoothEase }}
              whileHover={{ y: -5, borderColor: "#cbd5e1", boxShadow: "0 12px 24px -6px rgba(15, 23, 42, 0.08)" }}
              className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs transition-all group"
            >
              <div className="h-10 w-10 rounded-lg bg-slate-100 text-slate-900 flex items-center justify-center mb-4 group-hover:bg-slate-900 group-hover:text-white transition-colors">
                <Receipt size={20} />
              </div>
              <h3 className="text-base font-bold text-slate-900 mb-2">High Speed Billing</h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                Cash, card, and split payment settlement with fast thermal receipt generation on 80mm and 58mm ESC/POS hardware.
              </p>
            </motion.div>

            {/* Capability 6 */}
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.5, delay: 0.40, ease: smoothEase }}
              whileHover={{ y: -5, borderColor: "#cbd5e1", boxShadow: "0 12px 24px -6px rgba(15, 23, 42, 0.08)" }}
              className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs transition-all group"
            >
              <div className="h-10 w-10 rounded-lg bg-slate-100 text-slate-900 flex items-center justify-center mb-4 group-hover:bg-slate-900 group-hover:text-white transition-colors">
                <ShieldCheck size={20} />
              </div>
              <h3 className="text-base font-bold text-slate-900 mb-2">Offline Resilience</h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                Continuous operation during local network drops with local transaction queue and automatic cloud synchronization.
              </p>
            </motion.div>

          </div>
        </section>

        {/* Hardware Support */}
        <section className="bg-slate-50 border-y border-slate-200 py-12">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
              className="text-center mb-8"
            >
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600">
                Restaurant Hardware Support
              </h3>
            </motion.div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
              <motion.div
                initial={{ opacity: 0, y: 18 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: 0.05 }}
                whileHover={{ y: -3, backgroundColor: "#ffffff", boxShadow: "0 6px 16px -4px rgba(15, 23, 42, 0.06)" }}
                className="bg-white p-4 rounded-xl border border-slate-200 transition-all"
              >
                <Printer size={22} className="mx-auto text-slate-800 mb-2" />
                <p className="text-xs font-bold text-slate-900">Thermal Printers</p>
                <p className="text-[11px] text-slate-500 mt-0.5">80mm and 58mm ESC/POS</p>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 18 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: 0.12 }}
                whileHover={{ y: -3, backgroundColor: "#ffffff", boxShadow: "0 6px 16px -4px rgba(15, 23, 42, 0.06)" }}
                className="bg-white p-4 rounded-xl border border-slate-200 transition-all"
              >
                <Tv size={22} className="mx-auto text-slate-800 mb-2" />
                <p className="text-xs font-bold text-slate-900">KDS Screens</p>
                <p className="text-[11px] text-slate-500 mt-0.5">Kitchen Monitors</p>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 18 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: 0.19 }}
                whileHover={{ y: -3, backgroundColor: "#ffffff", boxShadow: "0 6px 16px -4px rgba(15, 23, 42, 0.06)" }}
                className="bg-white p-4 rounded-xl border border-slate-200 transition-all"
              >
                <Smartphone size={22} className="mx-auto text-slate-800 mb-2" />
                <p className="text-xs font-bold text-slate-900">Floor Devices</p>
                <p className="text-[11px] text-slate-500 mt-0.5">Waitstaff Tablets</p>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 18 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: 0.26 }}
                whileHover={{ y: -3, backgroundColor: "#ffffff", boxShadow: "0 6px 16px -4px rgba(15, 23, 42, 0.06)" }}
                className="bg-white p-4 rounded-xl border border-slate-200 transition-all"
              >
                <ShieldCheck size={22} className="mx-auto text-slate-800 mb-2" />
                <p className="text-xs font-bold text-slate-900">Cash Drawers</p>
                <p className="text-[11px] text-slate-500 mt-0.5">Standard RJ11</p>
              </motion.div>
            </div>
          </div>
        </section>

        {/* Clean Sign In CTA Banner */}
        <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 24 }}
            whileInView={{ opacity: 1, scale: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.6, ease: smoothEase }}
            className="rounded-2xl border border-slate-200 bg-white p-8 sm:p-12 text-center shadow-xs"
          >
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight mb-3">
              Ready to open your restaurant terminal?
            </h2>
            <p className="text-slate-600 text-sm sm:text-base max-w-xl mx-auto mb-6">
              Sign in with your staff account to begin managing tables, routing kitchen tickets, and settling customer bills.
            </p>
            <div>
              <motion.div
                whileHover={{ scale: 1.03, y: -1 }}
                whileTap={{ scale: 0.97 }}
                transition={{ duration: 0.2 }}
                className="inline-block"
              >
                <Link
                  href="/login"
                  className="inline-flex items-center gap-2 px-8 py-3.5 rounded-xl font-bold text-sm text-white bg-slate-900 hover:bg-slate-800 shadow-sm transition"
                >
                  Sign In to Terminal
                  <ArrowRight size={16} />
                </Link>
              </motion.div>
            </div>
          </motion.div>
        </section>

      </main>

      {/* Clean Footer */}
      <footer className="border-t border-slate-200 bg-white py-8 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="relative h-6 w-6 shrink-0">
              <Image
                src="/falcon-swift-hd.png"
                alt="Falcon Swift Logo"
                fill
                className="object-contain"
              />
            </div>
            <p className="font-bold text-slate-800">Falcon Swift</p>
            <p className="text-slate-500">: Restaurant POS and Operations</p>
          </div>
          <p>© {new Date().getFullYear()} Falcon Swift. All rights reserved.</p>
          <div>
            <Link href="/login" className="font-semibold text-slate-900 hover:underline">
              Terminal Sign In
            </Link>
          </div>
        </div>
      </footer>

      {/* Mobile App Bottom Navigation Bar */}
      <motion.div
        initial={{ y: 60, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.3 }}
        className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-md border-t border-slate-200 shadow-lg px-6 py-2"
      >
        <div className="grid grid-cols-3 items-center text-center">
          <Link
            href="/"
            className="flex flex-col items-center gap-1 text-slate-900 font-semibold"
          >
            <UtensilsCrossed size={18} />
            <p className="text-[10px]">Overview</p>
          </Link>
          <a
            href="#modules"
            className="flex flex-col items-center gap-1 text-slate-600 hover:text-slate-900 font-medium"
          >
            <LayoutGrid size={18} />
            <p className="text-[10px]">Modules</p>
          </a>
          <Link
            href="/login"
            className="flex flex-col items-center gap-1 text-slate-900 font-bold"
          >
            <LogIn size={18} />
            <p className="text-[10px]">Sign In</p>
          </Link>
        </div>
      </motion.div>

    </div>
  );
}
