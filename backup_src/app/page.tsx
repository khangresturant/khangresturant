"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowRight, Globe, Store, Smartphone, ShieldCheck, Zap, Server, Code, CheckCircle2 } from "lucide-react";
import { motion } from "framer-motion";

const industries = [
  "Tailor Boutique", "Supermarket", "Pharmacy", "Smart Fuel Station", 
  "EMI Store", "Restaurant", "Grain Market", "Mobile Repair", 
  "Dairy Farm", "Apparel Brand", "Rentals", "Hardware", 
  "Gyms", "Auto Parts", "Agri Inputs"
];

export default function PremiumLandingPage() {
  return (
    <div className="min-h-screen bg-[#fafafa] font-sans text-zinc-900 selection:bg-blue-200 overflow-x-hidden relative">
      
      {/* Premium Background Mesh Gradients */}
      <div className="fixed top-0 -left-40 w-[500px] h-[500px] bg-blue-300 rounded-full mix-blend-multiply filter blur-[128px] opacity-30 animate-blob pointer-events-none"></div>
      <div className="fixed top-0 -right-40 w-[500px] h-[500px] bg-purple-300 rounded-full mix-blend-multiply filter blur-[128px] opacity-30 animate-blob animation-delay-2000 pointer-events-none"></div>
      <div className="fixed -bottom-40 left-20 w-[500px] h-[500px] bg-indigo-300 rounded-full mix-blend-multiply filter blur-[128px] opacity-30 animate-blob animation-delay-4000 pointer-events-none"></div>

      <div className="relative z-10">
        {/* Navigation */}
        <nav suppressHydrationWarning className="w-full flex items-center justify-between p-6 max-w-7xl mx-auto sticky top-0 bg-[#fafafa]/80 backdrop-blur-xl z-50 border-b border-zinc-200/50">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 bg-gradient-to-br from-zinc-800 to-zinc-950 rounded-2xl flex items-center justify-center shadow-xl shadow-zinc-200 border border-white/20 backdrop-blur-md transform transition-transform hover:rotate-6 duration-300">
              <span className="text-white font-black text-2xl tracking-tighter">HX</span>
            </div>
            <span className="text-2xl font-black tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-zinc-800 to-zinc-600 hidden sm:block">Hisab X</span>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/login">
              <Button variant="ghost" className="font-bold text-zinc-600 hover:text-zinc-900 hover:bg-zinc-200/50 rounded-full px-6 transition-all duration-300">
                Admin Login
              </Button>
            </Link>
            <Button className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold rounded-full px-8 shadow-lg shadow-blue-200 transition-all hover:shadow-xl hover:-translate-y-0.5 border border-blue-500/50 hidden sm:flex">
              Start for Free
            </Button>
          </div>
        </nav>

        {/* SECTION 1: Massive Hero Section */}
        <section className="max-w-7xl mx-auto px-6 pt-32 pb-40 text-center">
          <motion.div 
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
            className="space-y-12 max-w-5xl mx-auto"
          >
            <motion.div 
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="inline-flex items-center rounded-full border border-blue-200/50 bg-white/60 backdrop-blur-md px-6 py-2.5 text-sm font-bold text-blue-800 shadow-sm mb-4 hover:bg-white transition-colors cursor-pointer"
            >
              <Globe className="mr-2 h-4 w-4 text-blue-600 animate-pulse" />
              The Global Operating System for MSMEs
            </motion.div>
            
            <h1 className="text-6xl md:text-8xl lg:text-[7rem] font-black tracking-tighter text-zinc-900 leading-[1.05]">
              Run your business <br className="hidden md:block"/>
              <span className="relative inline-block mt-2">
                <span className="relative z-10 text-transparent bg-clip-text bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600">
                  with zero paperwork.
                </span>
                <span className="absolute -bottom-4 left-0 w-full h-8 bg-blue-200/30 -z-10 rounded-full blur-xl"></span>
              </span>
            </h1>
            
            <p className="text-xl md:text-3xl text-zinc-600 max-w-4xl mx-auto leading-relaxed font-medium">
              From Tailor boutiques to Smart Fuel Stations, Hisab X is the AI-powered ERP & POS ecosystem built for <span className="font-bold text-zinc-900">15+ industries</span> worldwide. 
            </p>
            
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.6 }}
              className="flex flex-col sm:flex-row items-center justify-center gap-6 pt-10"
            >
              <Button className="group relative overflow-hidden bg-zinc-900 hover:bg-zinc-800 text-white font-bold rounded-full px-12 py-8 text-xl shadow-2xl transition-all hover:-translate-y-1">
                <span className="relative z-10 flex items-center">
                  Launch your free shop
                  <ArrowRight className="ml-3 h-6 w-6 transition-transform group-hover:translate-x-2" />
                </span>
                <div className="absolute inset-0 h-full w-full bg-gradient-to-r from-blue-600 to-purple-600 opacity-0 group-hover:opacity-30 transition-opacity duration-300"></div>
              </Button>
            </motion.div>
          </motion.div>
        </section>

        {/* SECTION 2: Infinite Marquee */}
        <section className="relative flex overflow-x-hidden border-y border-zinc-200/50 bg-white/40 backdrop-blur-md py-8">
          <div className="animate-marquee whitespace-nowrap flex items-center">
            {[...industries, ...industries, ...industries].map((industry, index) => (
              <span key={index} className="mx-12 text-3xl font-black text-zinc-300 uppercase tracking-widest hover:text-zinc-400 transition-colors cursor-default">
                {industry}
              </span>
            ))}
          </div>
        </section>

        {/* SECTION 3: Massive Bento Grid Features */}
        <section className="max-w-7xl mx-auto px-6 py-40">
          <div className="text-center mb-20 space-y-6">
            <h2 className="text-5xl md:text-6xl font-black tracking-tight text-zinc-900">Enterprise power, <br/> MSME simplicity.</h2>
            <p className="text-xl text-zinc-500 max-w-2xl mx-auto font-medium">Everything you need to automate your store, from offline billing to live cloud synchronization.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Feature 1 (Large) */}
            <motion.div 
              whileInView={{ opacity: 1, y: 0 }}
              initial={{ opacity: 0, y: 40 }}
              viewport={{ once: true }}
              className="col-span-1 md:col-span-2 row-span-2 bg-gradient-to-br from-white to-zinc-50 rounded-[2.5rem] p-12 border border-zinc-200/60 shadow-xl shadow-zinc-200/50 flex flex-col justify-between group hover:border-blue-300 transition-colors duration-500 relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-96 h-96 bg-blue-100 rounded-full mix-blend-multiply filter blur-3xl opacity-50 group-hover:opacity-100 transition-opacity duration-500"></div>
              <div className="relative z-10">
                <div className="h-20 w-20 rounded-3xl bg-blue-100 flex items-center justify-center mb-10 transform transition-transform group-hover:scale-110 duration-500">
                  <Zap className="h-10 w-10 text-blue-600" />
                </div>
                <h3 className="text-4xl font-black text-zinc-900 mb-6 leading-tight">Offline-First <br/> Architecture</h3>
                <p className="text-zinc-500 text-xl font-medium leading-relaxed max-w-md">
                  Lightning fast local database operations. Keep selling even when your internet drops. Hisab X auto-syncs to the Supabase cloud the moment you're back online.
                </p>
              </div>
            </motion.div>

            {/* Feature 2 */}
            <motion.div 
              whileInView={{ opacity: 1, y: 0 }}
              initial={{ opacity: 0, y: 40 }}
              viewport={{ once: true }}
              className="col-span-1 bg-white rounded-[2.5rem] p-10 border border-zinc-200/60 shadow-lg shadow-zinc-200/30 group hover:border-indigo-300 transition-colors duration-500 relative overflow-hidden"
            >
               <div className="h-16 w-16 rounded-3xl bg-indigo-100 flex items-center justify-center mb-8 transform transition-transform group-hover:scale-110 duration-500">
                  <Smartphone className="h-8 w-8 text-indigo-600" />
                </div>
                <h3 className="text-3xl font-bold text-zinc-900 mb-4">WhatsApp Bills</h3>
                <p className="text-zinc-500 text-lg font-medium">Send professional PDF receipts directly to customers via native WhatsApp intents. Zero API costs.</p>
            </motion.div>

            {/* Feature 3 */}
            <motion.div 
              whileInView={{ opacity: 1, y: 0 }}
              initial={{ opacity: 0, y: 40 }}
              viewport={{ once: true }}
              className="col-span-1 bg-white rounded-[2.5rem] p-10 border border-zinc-200/60 shadow-lg shadow-zinc-200/30 group hover:border-purple-300 transition-colors duration-500 relative overflow-hidden"
            >
               <div className="h-16 w-16 rounded-3xl bg-purple-100 flex items-center justify-center mb-8 transform transition-transform group-hover:scale-110 duration-500">
                  <ShieldCheck className="h-8 w-8 text-purple-600" />
                </div>
                <h3 className="text-3xl font-bold text-zinc-900 mb-4">Auto Backup</h3>
                <p className="text-zinc-500 text-lg font-medium">Securely backup your entire shop's data and receipt images directly to your personal Google Drive.</p>
            </motion.div>

            {/* Feature 4 (Full Width) */}
            <motion.div 
              whileInView={{ opacity: 1, y: 0 }}
              initial={{ opacity: 0, y: 40 }}
              viewport={{ once: true }}
              className="col-span-1 md:col-span-3 bg-zinc-900 rounded-[2.5rem] p-12 border border-zinc-800 shadow-2xl flex flex-col md:flex-row items-center justify-between group overflow-hidden relative"
            >
              <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>
              <div className="relative z-10 md:w-1/2 space-y-6">
                <div className="h-16 w-16 rounded-3xl bg-zinc-800 flex items-center justify-center mb-4 border border-zinc-700">
                  <Server className="h-8 w-8 text-white" />
                </div>
                <h3 className="text-4xl font-black text-white">Hardware Ready</h3>
                <p className="text-zinc-400 text-xl font-medium">Direct ESC/POS commands for thermal printers, native weighing scale integration, and barcode scanner support via Google ML Kit.</p>
              </div>
              <div className="relative z-10 md:w-1/3 mt-10 md:mt-0 flex justify-center">
                 <div className="h-40 w-40 rounded-full bg-blue-500/20 blur-3xl absolute"></div>
                 <Code className="h-40 w-40 text-blue-400 relative z-10" />
              </div>
            </motion.div>
          </div>
        </section>

        {/* SECTION 4: Pricing Tiers */}
        <section className="bg-white border-y border-zinc-200/50 py-40">
          <div className="max-w-7xl mx-auto px-6">
            <div className="text-center mb-24 space-y-6">
              <h2 className="text-5xl md:text-6xl font-black tracking-tight text-zinc-900">SaaS Plans built <br/> for the real world.</h2>
              <p className="text-xl text-zinc-500 max-w-2xl mx-auto font-medium">Subscriptions are tied to the business, not the user account.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              {/* Free Plan */}
              <div className="bg-zinc-50 rounded-3xl p-8 border border-zinc-200 hover:border-blue-300 transition-colors">
                <h3 className="text-2xl font-bold text-zinc-900 mb-2">Lifetime Free</h3>
                <div className="text-4xl font-black text-zinc-900 mb-6">$0<span className="text-lg text-zinc-500 font-medium">/mo</span></div>
                <ul className="space-y-4 mb-8">
                  <li className="flex items-center text-zinc-600"><CheckCircle2 className="h-5 w-5 mr-3 text-zinc-400" /> Mobile App Only</li>
                  <li className="flex items-center text-zinc-600"><CheckCircle2 className="h-5 w-5 mr-3 text-zinc-400" /> 1 User (Owner)</li>
                  <li className="flex items-center text-zinc-600"><CheckCircle2 className="h-5 w-5 mr-3 text-zinc-400" /> Ad-Supported</li>
                </ul>
                <Button variant="outline" className="w-full rounded-full h-12 font-bold">Start Free</Button>
              </div>

              {/* Basic Plan */}
              <div className="bg-white rounded-3xl p-8 border border-zinc-200 hover:border-blue-300 transition-colors shadow-lg">
                <h3 className="text-2xl font-bold text-blue-600 mb-2">Basic</h3>
                <div className="text-4xl font-black text-zinc-900 mb-6">$1<span className="text-lg text-zinc-500 font-medium">/mo</span></div>
                <ul className="space-y-4 mb-8">
                  <li className="flex items-center text-zinc-600"><CheckCircle2 className="h-5 w-5 mr-3 text-blue-500" /> Ad-Free Experience</li>
                  <li className="flex items-center text-zinc-600"><CheckCircle2 className="h-5 w-5 mr-3 text-blue-500" /> WhatsApp Bills</li>
                  <li className="flex items-center text-zinc-600"><CheckCircle2 className="h-5 w-5 mr-3 text-blue-500" /> Personal Cloud Backup</li>
                  <li className="flex items-center text-zinc-600"><CheckCircle2 className="h-5 w-5 mr-3 text-blue-500" /> 1 Additional Staff</li>
                </ul>
                <Button className="w-full rounded-full h-12 font-bold bg-blue-600 hover:bg-blue-700">Choose Basic</Button>
              </div>

              {/* Advanced Plan */}
              <div className="bg-zinc-900 rounded-3xl p-8 border border-zinc-800 hover:border-indigo-500 transition-colors shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500 rounded-full mix-blend-screen filter blur-3xl opacity-50"></div>
                <div className="inline-block px-3 py-1 bg-indigo-500 text-white text-xs font-bold rounded-full mb-4">MOST POPULAR</div>
                <h3 className="text-2xl font-bold text-white mb-2">Advanced</h3>
                <div className="text-4xl font-black text-white mb-6">$5<span className="text-lg text-zinc-400 font-medium">/mo</span></div>
                <ul className="space-y-4 mb-8">
                  <li className="flex items-center text-zinc-300"><CheckCircle2 className="h-5 w-5 mr-3 text-indigo-400" /> All Platforms (Web/PC)</li>
                  <li className="flex items-center text-zinc-300"><CheckCircle2 className="h-5 w-5 mr-3 text-indigo-400" /> Live Cloud Sync</li>
                  <li className="flex items-center text-zinc-300"><CheckCircle2 className="h-5 w-5 mr-3 text-indigo-400" /> Double-Entry P&L</li>
                  <li className="flex items-center text-zinc-300"><CheckCircle2 className="h-5 w-5 mr-3 text-indigo-400" /> Up to 5 Users</li>
                </ul>
                <Button className="w-full rounded-full h-12 font-bold bg-white text-zinc-900 hover:bg-zinc-200">Choose Advanced</Button>
              </div>

              {/* Enterprise Plan */}
              <div className="bg-zinc-50 rounded-3xl p-8 border border-zinc-200 hover:border-purple-300 transition-colors">
                <h3 className="text-2xl font-bold text-zinc-900 mb-2">Enterprise VIP</h3>
                <div className="text-3xl font-black text-zinc-900 mb-7 mt-1">Custom Pricing</div>
                <ul className="space-y-4 mb-8">
                  <li className="flex items-center text-zinc-600"><CheckCircle2 className="h-5 w-5 mr-3 text-purple-500" /> Unlimited Branches</li>
                  <li className="flex items-center text-zinc-600"><CheckCircle2 className="h-5 w-5 mr-3 text-purple-500" /> IoT Integrations</li>
                  <li className="flex items-center text-zinc-600"><CheckCircle2 className="h-5 w-5 mr-3 text-purple-500" /> Biometric Attendance</li>
                </ul>
                <Button variant="outline" className="w-full rounded-full h-12 font-bold mt-11">Contact Sales</Button>
              </div>
            </div>
          </div>
        </section>

        {/* SECTION 5: Final CTA */}
        <section className="max-w-5xl mx-auto px-6 py-40 text-center">
          <div className="bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-700 rounded-[3rem] p-16 md:p-24 shadow-2xl relative overflow-hidden">
             <div className="absolute top-0 right-0 w-96 h-96 bg-white rounded-full mix-blend-overlay filter blur-3xl opacity-20"></div>
             <h2 className="text-5xl md:text-7xl font-black text-white mb-8 relative z-10 leading-tight">Ready to transform <br/> your business?</h2>
             <Button className="bg-white text-blue-600 hover:bg-zinc-100 font-bold rounded-full px-12 py-8 text-xl shadow-xl transition-all hover:-translate-y-1 relative z-10">
                Get Started Now
             </Button>
          </div>
        </section>

        {/* Footer */}
        <footer className="w-full border-t border-zinc-200/50 bg-[#fafafa] py-16 text-center relative z-10">
          <div className="h-12 w-12 bg-zinc-900 rounded-xl flex items-center justify-center mx-auto mb-6">
             <span className="text-white font-black text-xl tracking-tighter">HX</span>
          </div>
          <p className="text-sm font-bold text-zinc-400 uppercase tracking-widest">
            &copy; {new Date().getFullYear()} Hisab X Global. Empowering MSMEs.
          </p>
        </footer>
      </div>
    </div>
  );
}
