"use client";

import React, { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { 
  Sparkles, ShieldCheck, ArrowRight, Award, CheckCircle2, 
  Crown, Star, MessageCircle, FileText, Check, Phone,
  Building2, Car, Scale, DollarSign, ChevronRight, Lock
} from "lucide-react";
import { VipNav } from "@/components/vip/VipNav";

export default function RoyalGoldExecutiveVipPage() {
  const [selectedPill, setSelectedPill] = useState("showroom");

  return (
    <div className="min-h-screen bg-[#070B12] text-slate-100 font-sans selection:bg-amber-400 selection:text-slate-950 overflow-x-hidden">
      <VipNav theme="gold" activeConcept="royal" />

      {/* Royal Ambient Glows */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[550px] bg-gradient-to-b from-amber-500/10 via-yellow-600/5 to-transparent blur-[160px] pointer-events-none" />

      {/* Hero Section */}
      <section className="relative pt-16 pb-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto relative z-10">
          <div className="text-center max-w-4xl mx-auto mb-14">
            {/* Executive Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-bold mb-6 shadow-xl shadow-amber-950/40 backdrop-blur-md">
              <Crown className="w-3.5 h-3.5 text-amber-400" />
              <span>The Executive Operating System for Pakistani & Gulf Businesses</span>
            </div>

            {/* Regal Typography */}
            <h1 className="text-4xl sm:text-6xl lg:text-7xl font-black tracking-tight text-white leading-[1.08] mb-6">
              بڑے اور باوقار کاروباری اداروں کا <br />
              <span className="bg-gradient-to-r from-amber-300 via-amber-400 to-yellow-500 bg-clip-text text-transparent">
                سب سے معتبر کلاؤڈ سسٹم
              </span>
            </h1>

            <p className="text-base sm:text-xl text-slate-300 max-w-2xl mx-auto leading-relaxed mb-10 font-normal">
              گاڑیوں کے شو رومز، بڑی ہول سیل مارکیٹس اور کامیاب ریٹیل برانڈز کا واحد اعتماد۔
              قانونی اقرار نامے، اقساط کا باقاعدہ شیڈول، اور 100% شفاف لیجر کا انتظام۔
            </p>

            {/* Royal Actions */}
            <div className="flex flex-wrap items-center justify-center gap-4">
              <Link
                href="/register"
                className="px-8 py-4 rounded-2xl bg-gradient-to-r from-amber-400 via-amber-500 to-yellow-500 hover:from-amber-300 hover:to-yellow-400 text-slate-950 font-black text-sm tracking-wide shadow-2xl shadow-amber-500/20 transition-all hover:scale-105 flex items-center gap-2 group"
              >
                <span>وی آئی پی فری ٹرائل شروع کریں</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </Link>

              <a
                href="https://wa.me/923004074760?text=Assalam-o-Alaikum%20Showroom%20aur%20Business%20ka%20Executive%20Setup%20chahiye"
                target="_blank"
                rel="noreferrer"
                className="px-7 py-4 rounded-2xl bg-slate-900/80 hover:bg-slate-800 text-white border border-amber-500/30 font-bold text-sm transition-all hover:scale-105 flex items-center gap-2.5 backdrop-blur-xl"
              >
                <MessageCircle className="w-4 h-4 text-amber-400" />
                <span>Executive Concierge Support</span>
              </a>
            </div>

            {/* Prestige Badges */}
            <div className="mt-12 flex items-center justify-center gap-8 flex-wrap text-xs text-slate-400 border-t border-slate-800/80 pt-6">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-amber-400" />
                <span>SECP & FBR Tier-1 Compliant</span>
              </div>
              <div className="flex items-center gap-2">
                <Lock className="w-4 h-4 text-amber-400" />
                <span>256-bit Bank-Grade Encryption</span>
              </div>
              <div className="flex items-center gap-2">
                <Award className="w-4 h-4 text-amber-400" />
                <span>Rated #1 ERP for Automobile Showrooms</span>
              </div>
            </div>
          </div>

          {/* Luxury Retail Hero Visual */}
          <div className="relative max-w-5xl mx-auto">
            <div className="relative rounded-3xl overflow-hidden border-2 border-amber-500/30 shadow-[0_0_60px_rgba(245,158,11,0.15)] bg-slate-950 group">
              <Image
                src="/images/vip_retail_pos.jpg"
                alt="The Accounts Cloud Luxury Showroom POS Counter"
                width={1920}
                height={1080}
                className="w-full h-auto object-cover transform group-hover:scale-[1.01] transition-transform duration-700"
                priority
              />

              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent pointer-events-none" />

              {/* Floating Executive Showroom Feature Box */}
              <div className="absolute bottom-6 left-6 right-6 p-6 rounded-2xl bg-slate-950/90 backdrop-blur-2xl border border-amber-500/30 shadow-2xl flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
                    <FileText className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-white">
                      شوروم اقرار نامہ و قانونی اسٹامپ پیپر فارمیٹ
                    </h3>
                    <p className="text-xs text-slate-400">
                      خریدار، بائع، ضامن اول، اور گواہ کے قانونی دستخط و انگوٹھا سیکشن کے ساتھ A4 سائز میں پرنٹ
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-xs font-mono font-bold text-amber-400 bg-amber-500/10 px-3 py-1.5 rounded-lg border border-amber-500/20">
                    Auto-Printed on A4
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Four Pillars of High-Trust Business */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 border-t border-slate-800/80 bg-slate-950/40">
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <span className="text-xs uppercase font-extrabold tracking-widest text-amber-400 mb-2 block">
              The Gold Standard
            </span>
            <h2 className="text-3xl sm:text-5xl font-black text-white">
              چار بنیادی ستون جو آپ کے منافع کو محفوظ بناتے ہیں
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Pillar 1 */}
            <div className="p-8 rounded-3xl bg-slate-900/40 border border-slate-800 hover:border-amber-500/40 transition-all hover:-translate-y-1">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 mb-6">
                <Scale className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-black text-white mb-2">100% شفاف کھاتا لیجر</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                ہر پارٹی کا رننگ بیلنس بل اور ادائیگی کی تاریخ کے ساتھ محفوظ۔ کسی بھی ملازم کی غلطی یا فراڈ کی کوئی گنجائش نہیں۔
              </p>
            </div>

            {/* Pillar 2 */}
            <div className="p-8 rounded-3xl bg-slate-900/40 border border-slate-800 hover:border-amber-500/40 transition-all hover:-translate-y-1">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 mb-6">
                <Car className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-black text-white mb-2">شو روم اقساط ٹریکر</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                ماہانہ قسط وصولی پر فوری پرچی، ڈیو ڈیٹ پر واٹس ایپ الرٹ، اور گاڑی تحویل میں لینے کے قانونی حقوق کا اندراج۔
              </p>
            </div>

            {/* Pillar 3 */}
            <div className="p-8 rounded-3xl bg-slate-900/40 border border-slate-800 hover:border-amber-500/40 transition-all hover:-translate-y-1">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 mb-6">
                <MessageCircle className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-black text-white mb-2">خودکار واٹس ایپ وصولی</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                کسٹمر کے ادھار کی ادائیگی کی یاد دہانی اور مکمل لیجر پی ڈی ایف واٹس ایپ پر ایک کلک میں باآسانی روانہ کریں۔
              </p>
            </div>

            {/* Pillar 4 */}
            <div className="p-8 rounded-3xl bg-slate-900/40 border border-slate-800 hover:border-amber-500/40 transition-all hover:-translate-y-1">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 mb-6">
                <Building2 className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-black text-white mb-2">انویسٹر منافع پارٹنرشپ</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                بزنس پارٹنرز اور انویسٹرز کی لگائی گئی رقم اور ہر گاڑی یا پروڈکٹ پر منافع کی باہمی تقسیم کا خودکار حساب۔
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* High-Ticket Call to Action */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto text-center">
        <div className="p-12 rounded-3xl bg-gradient-to-br from-amber-500/15 via-slate-900 to-slate-950 border-2 border-amber-500/30 shadow-2xl relative">
          <Crown className="w-10 h-10 text-amber-400 mx-auto mb-4" />
          <h2 className="text-3xl sm:text-4xl font-black text-white mb-4">
            اپنے ادارے کے تمام حساب کتاب کو کلاؤڈ پر محفوظ بنائیں
          </h2>
          <p className="text-sm text-slate-300 max-w-xl mx-auto mb-8">
            ہماری وی آئی پی ٹیم آپ کے موجودہ کھاتوں کو سسٹم میں منتقل کروانے اور پرسنل ٹریننگ میں مکمل مدد فراہم کرے گی۔
          </p>

          <div className="flex justify-center gap-4 flex-wrap">
            <Link
              href="/register"
              className="px-8 py-4 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-black text-xs shadow-lg"
            >
              شروع کریں (14 Days Free)
            </Link>
            <a
              href="https://wa.me/923004074760?text=Assalam-o-Alaikum%20Mujhe%20The%20Accounts%20Cloud%20ka%20VIP%20demo%20dekhna%20hai"
              target="_blank"
              rel="noreferrer"
              className="px-8 py-4 rounded-xl bg-slate-900 border border-slate-700 hover:bg-slate-800 text-white font-bold text-xs"
            >
              رابطہ کریں واٹس ایپ پر
            </a>
          </div>
        </div>
      </section>

      <footer className="py-12 border-t border-slate-900 text-center text-xs text-slate-500">
        <p>© 2026 The Accounts Cloud — Concept 2: Royal Gold Executive VIP Mockup</p>
      </footer>
    </div>
  );
}
