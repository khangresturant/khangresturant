"use client";

import React, { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { 
  Sparkles, ShieldCheck, ArrowRight, Zap, CheckCircle2, 
  Printer, Smartphone, Monitor, Database, WifiOff, Wifi, 
  Plus, Minus, Trash2, Check, RefreshCw, Star, Layers,
  Receipt, ShoppingCart, MessageCircle, BarChart3, Clock,
  ChevronRight, Building2, Store, Car, Utensils, Pill
} from "lucide-react";
import { VipNav } from "@/components/vip/VipNav";

// Sample mock items for interactive POS simulator
const SAMPLE_POS_ITEMS = [
  { id: 1, name: "Toyota Brake Pad OEM", urdu: "بریک پیڈ ٹویوٹا اصلی", price: 4500, category: "Auto" },
  { id: 2, name: "Mobil 1 Synthetic 4L", urdu: "موبل ون آئل ۴ لیٹر", price: 11200, category: "Lubricants" },
  { id: 3, name: "Samsung Galaxy S24 Ultra Case", urdu: "سام سنگ کیس پریمیم", price: 2200, category: "Mobile" },
  { id: 4, name: "Panadol CF Box (10x10)", urdu: "پیناڈول سی ایف ڈبہ", price: 850, category: "Pharma" },
  { id: 5, name: "VIP Service & Tuning Labor", urdu: "سروس اور ٹیوننگ لیبر", price: 3000, category: "Service" },
];

export default function NeoBentoProVipPage() {
  // POS Simulator State
  const [cart, setCart] = useState<{ id: number; name: string; urdu: string; price: number; qty: number }[]>([
    { id: 1, name: "Toyota Brake Pad OEM", urdu: "بریک پیڈ ٹویوٹا اصلی", price: 4500, qty: 1 },
    { id: 2, name: "Mobil 1 Synthetic 4L", urdu: "موبل ون آئل ۴ لیٹر", price: 11200, qty: 1 }
  ]);
  const [discountPercent, setDiscountPercent] = useState<number>(5);
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "khata" | "card">("cash");
  const [isReceiptPrinting, setIsReceiptPrinting] = useState<boolean>(false);
  const [printedReceipt, setPrintedReceipt] = useState<boolean>(false);
  const [receiptLang, setReceiptLang] = useState<"en" | "ur">("ur");
  const [activeTab, setActiveTab] = useState<string>("showroom");

  // Cart calculations
  const subtotal = cart.reduce((acc, item) => acc + item.price * item.qty, 0);
  const discountAmount = Math.round((subtotal * discountPercent) / 100);
  const grandTotal = Math.max(0, subtotal - discountAmount);

  const addItemToCart = (item: typeof SAMPLE_POS_ITEMS[0]) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.id === item.id);
      if (existing) {
        return prev.map((i) => i.id === item.id ? { ...i, qty: i.qty + 1 } : i);
      }
      return [...prev, { ...item, qty: 1 }];
    });
  };

  const updateQty = (id: number, delta: number) => {
    setCart((prev) =>
      prev
        .map((i) => {
          if (i.id === id) {
            const newQty = i.qty + delta;
            return newQty > 0 ? { ...i, qty: newQty } : null;
          }
          return i;
        })
        .filter(Boolean) as typeof cart
    );
  };

  const triggerPrintReceipt = () => {
    setIsReceiptPrinting(true);
    setTimeout(() => {
      setIsReceiptPrinting(false);
      setPrintedReceipt(true);
    }, 900);
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 font-sans selection:bg-cyan-500 selection:text-white">
      <VipNav theme="light" activeConcept="bento" />

      {/* Hero Section with Apple Pro Aesthetic */}
      <section className="relative pt-16 pb-20 px-4 sm:px-6 lg:px-8 overflow-hidden bg-gradient-to-b from-white via-[#F8FAFC] to-[#F1F5F9]">
        {/* Subtle geometric grid background */}
        <div 
          className="absolute inset-0 opacity-[0.03] pointer-events-none" 
          style={{ backgroundImage: "radial-gradient(#000 1px, transparent 1px)", backgroundSize: "24px 24px" }} 
        />

        <div className="max-w-7xl mx-auto relative z-10 text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-800 text-xs font-bold mb-6 backdrop-blur-sm">
            <Sparkles className="w-4 h-4 text-cyan-600" />
            <span>Apple Pro Simplicity • Engineered for Maximum Speed</span>
          </div>

          <h1 className="text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight text-slate-950 leading-[1.08] mb-6">
            کاروبار چلانے کا سب سے تیز، <br className="hidden sm:inline" />
            <span className="bg-gradient-to-r from-cyan-600 via-blue-600 to-indigo-600 bg-clip-text text-transparent">
              سب سے جدید اور خوبصورت کلاؤڈ سسٹم
            </span>
          </h1>

          <p className="text-base sm:text-xl text-slate-600 max-w-3xl mx-auto leading-relaxed mb-10">
            ایک ہی پلیٹ فارم پر الٹرا فاسٹ پوائنٹ آف سیل (POS)، خودکار کھاتہ لیجر، اردو اور انگلش تھرمل رسیدیں،
            اور انٹرنیٹ کے بغیر بھی 100% بلنگ۔ کسی پیچیدہ ٹریننگ کی ضرورت نہیں۔
          </p>

          <div className="flex flex-wrap items-center justify-center gap-4 mb-16">
            <Link
              href="/register"
              className="px-8 py-4 rounded-2xl bg-slate-950 hover:bg-slate-800 text-white font-bold text-sm shadow-xl shadow-slate-950/20 transition-all hover:scale-105 flex items-center gap-2 group"
            >
              <span>14 روزہ مفت ٹرائل شروع کریں</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform text-cyan-400" />
            </Link>

            <a
              href="https://wa.me/923004074760?text=Assalam-o-Alaikum%20The%20Accounts%20Cloud%20ka%20Live%20Demo%20chahiye"
              target="_blank"
              rel="noreferrer"
              className="px-7 py-4 rounded-2xl bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 font-bold text-sm shadow-sm hover:shadow-md transition-all hover:scale-105 flex items-center gap-2"
            >
              <MessageCircle className="w-4 h-4 text-emerald-600" />
              <span>واٹس ایپ ڈیمو بک کریں</span>
            </a>
          </div>

          {/* Key KPI Strip */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto">
            <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-sm text-center">
              <div className="text-2xl sm:text-3xl font-black text-slate-900">0.04s</div>
              <div className="text-xs text-slate-500 font-medium mt-0.5">بارکوڈ اسکین اور بل جنریشن</div>
            </div>
            <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-sm text-center">
              <div className="text-2xl sm:text-3xl font-black text-cyan-600">100% Offline</div>
              <div className="text-xs text-slate-500 font-medium mt-0.5">انٹرنیٹ کٹنے پر بھی زیرو تعطل</div>
            </div>
            <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-sm text-center">
              <div className="text-2xl sm:text-3xl font-black text-emerald-600">10+ Industries</div>
              <div className="text-xs text-slate-500 font-medium mt-0.5">شو روم، فارمیسی، ریٹیل، جنرل</div>
            </div>
            <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-sm text-center">
              <div className="text-2xl sm:text-3xl font-black text-indigo-600">99.99%</div>
              <div className="text-xs text-slate-500 font-medium mt-0.5">کلاؤڈ اپ ٹائم اور آٹو بیک اپ</div>
            </div>
          </div>
        </div>
      </section>

      {/* Interactive Live POS Counter Simulator */}
      <section id="pos-engine" className="py-20 px-4 sm:px-6 lg:px-8 bg-white border-y border-slate-200">
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-3xl mx-auto mb-14">
            <span className="text-xs font-bold uppercase tracking-widest text-cyan-600 bg-cyan-50 px-3 py-1 rounded-full border border-cyan-200">
              Interactive Test Drive
            </span>
            <h2 className="text-3xl sm:text-5xl font-black text-slate-900 mt-3 mb-4">
              براہِ راست POS اور رسید کا تجربہ کریں
            </h2>
            <p className="text-slate-600 text-sm sm:text-base">
              نیچے آئٹمز پر کلک کر کے کارٹ میں شامل کریں، رعایت لگائیں اور 
              <strong>&ldquo;پرنٹ رسید&rdquo;</strong> دبا کر اصل تھرمل رسید سلپ کا اینیمیشن دیکھیں۔
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Left Column: POS Item Catalog */}
            <div className="lg:col-span-5 space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                  <ShoppingCart className="w-4 h-4 text-cyan-600" />
                  <span>کلک کر کے بل میں شامل کریں:</span>
                </h3>
                <span className="text-xs text-slate-400">Click to add</span>
              </div>

              <div className="grid grid-cols-1 gap-2.5">
                {SAMPLE_POS_ITEMS.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => addItemToCart(item)}
                    className="flex items-center justify-between p-3.5 rounded-xl border border-slate-200 hover:border-cyan-500 hover:bg-cyan-50/40 bg-white shadow-xs transition-all text-left group"
                  >
                    <div>
                      <div className="font-bold text-sm text-slate-900 group-hover:text-cyan-700 transition-colors">
                        {item.name}
                      </div>
                      <div className="text-xs text-slate-500 font-urdu">{item.urdu}</div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-black text-sm text-slate-900">
                        Rs. {item.price.toLocaleString()}
                      </span>
                      <div className="w-7 h-7 rounded-lg bg-slate-100 group-hover:bg-cyan-600 group-hover:text-white flex items-center justify-center transition-colors">
                        <Plus className="w-4 h-4" />
                      </div>
                    </div>
                  </button>
                ))}
              </div>

              {/* Offline Engine Badge */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex items-start gap-3 mt-4">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                  <WifiOff className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                    <span>100% آف لائن موڈ فعال</span>
                    <span className="px-1.5 py-0.5 rounded text-[10px] bg-emerald-600 text-white font-mono">LIVE</span>
                  </h4>
                  <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                    اگر کیبل یا وائی فائی کٹ جائے تو بھی سسٹم ایک سیکنڈ رکے بغیر بلنگ کرتا رہے گا۔ نیٹ بحال ہوتے ہی سب کلاؤڈ پر محفوظ ہو جاتا ہے۔
                  </p>
                </div>
              </div>
            </div>

            {/* Middle Column: Current Order & Totals */}
            <div className="lg:col-span-4 bg-slate-50 p-6 rounded-2xl border border-slate-200 shadow-sm space-y-5">
              <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                <div>
                  <h3 className="font-black text-slate-900 text-base">رننگ بل کاؤنٹر (POS)</h3>
                  <p className="text-[11px] text-slate-500">Invoice #POS-2026-9041</p>
                </div>
                <div className="flex gap-1">
                  <button 
                    onClick={() => setReceiptLang("ur")}
                    className={`text-[11px] px-2 py-0.5 rounded font-bold transition-colors ${receiptLang === "ur" ? "bg-cyan-600 text-white" : "bg-slate-200 text-slate-700"}`}
                  >
                    اردو
                  </button>
                  <button 
                    onClick={() => setReceiptLang("en")}
                    className={`text-[11px] px-2 py-0.5 rounded font-bold transition-colors ${receiptLang === "en" ? "bg-cyan-600 text-white" : "bg-slate-200 text-slate-700"}`}
                  >
                    ENG
                  </button>
                </div>
              </div>

              {/* Cart List */}
              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {cart.length === 0 ? (
                  <div className="text-center py-8 text-xs text-slate-400">
                    کوئی آئٹم منتخب نہیں۔ بائیں جانب سے آئٹمز شامل کریں۔
                  </div>
                ) : (
                  cart.map((item) => (
                    <div key={item.id} className="flex items-center justify-between p-2.5 rounded-lg bg-white border border-slate-200 text-xs">
                      <div className="truncate pr-2">
                        <div className="font-bold text-slate-900 truncate">
                          {receiptLang === "ur" ? item.urdu : item.name}
                        </div>
                        <div className="text-slate-500">
                          Rs. {item.price.toLocaleString()} × {item.qty}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="font-extrabold text-slate-900">
                          Rs. {(item.price * item.qty).toLocaleString()}
                        </span>
                        <div className="flex items-center gap-1 bg-slate-100 rounded-md p-0.5">
                          <button
                            onClick={() => updateQty(item.id, -1)}
                            className="w-5 h-5 flex items-center justify-center hover:bg-slate-200 rounded"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className="w-4 text-center font-bold text-xs">{item.qty}</span>
                          <button
                            onClick={() => updateQty(item.id, 1)}
                            className="w-5 h-5 flex items-center justify-center hover:bg-slate-200 rounded"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Payment Type Selection */}
              <div className="pt-3 border-t border-slate-200">
                <label className="text-xs font-bold text-slate-700 block mb-1.5">
                  طریقۂ ادائیگی / کھاتہ:
                </label>
                <div className="grid grid-cols-3 gap-2 text-xs font-bold">
                  <button
                    onClick={() => setPaymentMethod("cash")}
                    className={`py-2 rounded-lg border text-center transition-all ${
                      paymentMethod === "cash" 
                        ? "bg-emerald-600 text-white border-emerald-600 shadow-xs" 
                        : "bg-white text-slate-700 border-slate-200 hover:bg-slate-100"
                    }`}
                  >
                    نقد (Cash)
                  </button>
                  <button
                    onClick={() => setPaymentMethod("khata")}
                    className={`py-2 rounded-lg border text-center transition-all ${
                      paymentMethod === "khata" 
                        ? "bg-amber-600 text-white border-amber-600 shadow-xs" 
                        : "bg-white text-slate-700 border-slate-200 hover:bg-slate-100"
                    }`}
                  >
                    ادھار (کھاتہ)
                  </button>
                  <button
                    onClick={() => setPaymentMethod("card")}
                    className={`py-2 rounded-lg border text-center transition-all ${
                      paymentMethod === "card" 
                        ? "bg-indigo-600 text-white border-indigo-600 shadow-xs" 
                        : "bg-white text-slate-700 border-slate-200 hover:bg-slate-100"
                    }`}
                  >
                    بینک / کارڈ
                  </button>
                </div>
              </div>

              {/* Summary Calculations */}
              <div className="space-y-1.5 pt-3 border-t border-slate-200 text-xs">
                <div className="flex justify-between text-slate-600">
                  <span>سب ٹوٹل (Subtotal):</span>
                  <span>Rs. {subtotal.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-slate-600 items-center">
                  <span>خصوصی رعایت ({discountPercent}%):</span>
                  <div className="flex items-center gap-1">
                    <button 
                      onClick={() => setDiscountPercent((p) => Math.max(0, p - 5))}
                      className="px-1.5 py-0.5 rounded bg-slate-200 hover:bg-slate-300 font-bold"
                    >
                      -
                    </button>
                    <span className="font-mono text-emerald-600 font-bold">-Rs. {discountAmount.toLocaleString()}</span>
                    <button 
                      onClick={() => setDiscountPercent((p) => Math.min(30, p + 5))}
                      className="px-1.5 py-0.5 rounded bg-slate-200 hover:bg-slate-300 font-bold"
                    >
                      +
                    </button>
                  </div>
                </div>
                <div className="flex justify-between text-base font-black text-slate-900 pt-2 border-t border-slate-300">
                  <span>کل رقم (Grand Total):</span>
                  <span className="text-cyan-700 font-mono text-lg">Rs. {grandTotal.toLocaleString()}</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="space-y-2 pt-2">
                <button
                  disabled={cart.length === 0 || isReceiptPrinting}
                  onClick={triggerPrintReceipt}
                  className={`w-full py-3.5 rounded-xl font-black text-sm flex items-center justify-center gap-2 shadow-lg transition-all ${
                    isReceiptPrinting
                      ? "bg-slate-400 text-white cursor-wait"
                      : cart.length === 0
                      ? "bg-slate-200 text-slate-400 cursor-not-allowed"
                      : "bg-slate-950 hover:bg-slate-800 text-white hover:scale-[1.02] shadow-slate-900/20"
                  }`}
                >
                  <Printer className="w-4 h-4 text-cyan-400" />
                  <span>
                    {isReceiptPrinting ? "پرنٹ ہو رہا ہے..." : "رسیڈ پرنٹ کریں (Print Thermal Slip)"}
                  </span>
                </button>
              </div>
            </div>

            {/* Right Column: Thermal Paper Receipt Animation */}
            <div className="lg:col-span-3 flex flex-col items-center">
              <div className="w-full max-w-[280px] bg-slate-900 p-3 rounded-t-2xl shadow-xl flex items-center justify-between text-white text-xs">
                <span className="font-mono flex items-center gap-1.5">
                  <Printer className="w-3.5 h-3.5 text-cyan-400" />
                  Thermal 80mm
                </span>
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              </div>

              {/* Thermal Receipt Paper Roll */}
              <div className="w-full max-w-[280px] bg-[#FFFEEB] border border-amber-200 shadow-2xl p-4 text-slate-900 font-mono text-[11px] rounded-b-xl relative overflow-hidden transition-all duration-500">
                {/* Paper Tear Zigzag top */}
                <div className="border-b-2 border-dashed border-slate-300 pb-3 text-center mb-3">
                  <div className="font-black text-sm tracking-tight text-slate-900">
                    THE ACCOUNTS CLOUD
                  </div>
                  <div className="text-[10px] text-slate-600">
                    {receiptLang === "ur" ? "پوائنٹ آف سیل و کھاتہ رجسٹر" : "Point of Sale & Cloud ERP"}
                  </div>
                  <div className="text-[9px] text-slate-500 mt-1">
                    Phone: 0300-4074760 • NTN: 894102-3
                  </div>
                  <div className="text-[9px] text-slate-400">
                    {new Date().toLocaleDateString()} {new Date().toLocaleTimeString()}
                  </div>
                </div>

                {/* Receipt Line Items */}
                <div className="space-y-1.5 pb-3 border-b border-dashed border-slate-300">
                  {cart.map((item, idx) => (
                    <div key={idx} className="flex justify-between items-start leading-tight">
                      <span className="truncate pr-1">
                        {receiptLang === "ur" ? item.urdu : item.name}
                        <br />
                        <span className="text-[9px] text-slate-500">x{item.qty} @ {item.price}</span>
                      </span>
                      <span className="font-bold shrink-0">
                        {(item.price * item.qty).toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Receipt Totals */}
                <div className="space-y-1 py-2 text-[10px]">
                  <div className="flex justify-between">
                    <span>Subtotal:</span>
                    <span>Rs. {subtotal.toLocaleString()}</span>
                  </div>
                  {discountAmount > 0 && (
                    <div className="flex justify-between text-emerald-700 font-bold">
                      <span>Discount ({discountPercent}%):</span>
                      <span>-Rs. {discountAmount.toLocaleString()}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-black text-xs text-slate-900 pt-1 border-t border-slate-400">
                    <span>TOTAL:</span>
                    <span>Rs. {grandTotal.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-slate-600 text-[9px] pt-1">
                    <span>Method:</span>
                    <span className="uppercase font-bold">{paymentMethod}</span>
                  </div>
                </div>

                {/* Barcode Mock */}
                <div className="border-t border-dashed border-slate-300 pt-3 text-center space-y-1">
                  <div className="h-8 bg-slate-900 mx-auto w-3/4 flex items-center justify-around px-2">
                    <span className="w-0.5 h-full bg-white"></span>
                    <span className="w-1 h-full bg-white"></span>
                    <span className="w-0.5 h-full bg-white"></span>
                    <span className="w-2 h-full bg-white"></span>
                    <span className="w-0.5 h-full bg-white"></span>
                    <span className="w-1.5 h-full bg-white"></span>
                    <span className="w-0.5 h-full bg-white"></span>
                  </div>
                  <div className="text-[8px] text-slate-500 tracking-widest font-mono">
                    *TAC-2026-9041-PK*
                  </div>
                  <div className="text-[10px] font-bold text-slate-800 font-urdu pt-1">
                    {receiptLang === "ur" ? "تشریف آوری کا بہت شکریہ!" : "Thank you for your business!"}
                  </div>
                </div>
              </div>

              <div className="mt-3 text-center">
                <span className="text-[11px] text-slate-500 flex items-center gap-1 justify-center">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  سپورٹس 58mm، 80mm، اور A4 سائز
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Bento Grid Features Section */}
      <section id="features" className="py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <span className="text-xs font-bold uppercase tracking-widest text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full border border-indigo-200">
            System Architecture
          </span>
          <h2 className="text-3xl sm:text-5xl font-black text-slate-950 mt-3 mb-4">
            ہر وہ خصوصیت جو آپ کے کاروبار کو خودکار بناتی ہے
          </h2>
          <p className="text-slate-600 text-sm sm:text-base">
            سیکڑوں دستی کھاتوں اور پرانے سست سافٹ وئیرز کی جگہ ایک ایسا جدید پلیٹ فارم جو آپ کے وقت اور پیسوں کی حفاظت کرتا ہے۔
          </p>
        </div>

        {/* Bento Grid Tiles */}
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {/* Tile 1: Large Featured Tile - Hybrid Offline Sync */}
          <div className="md:col-span-2 lg:col-span-2 p-8 rounded-3xl bg-white border border-slate-200 shadow-sm hover:shadow-xl transition-all duration-300 relative overflow-hidden group">
            <div className="w-12 h-12 rounded-2xl bg-cyan-100 text-cyan-700 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
              <Database className="w-6 h-6" />
            </div>
            <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-cyan-50 text-cyan-700 border border-cyan-200">
              Zero-Downtime Engine
            </span>
            <h3 className="text-2xl font-black text-slate-900 mt-4 mb-2">
              لوکل ڈیٹا بیس اور آٹو کلاؤڈ سنک (IndexedDB)
            </h3>
            <p className="text-slate-600 text-sm leading-relaxed mb-6">
              پاکستان میں انٹرنیٹ لوڈشیڈنگ معمول ہے۔ ہم نے سسٹم کو اس طرح ڈیزائن کیا ہے کہ تمام بلنگ، سیل، اور کسٹمر لیجر آپ کے کمپیوٹر یا ٹیبلٹ پر لوکل کیش ہوتے ہیں۔ جب انٹرنیٹ آئے گا تو خود بخود ڈیٹا سرور پر سنک ہو جائے گا۔
            </p>
            <div className="flex items-center gap-4 text-xs font-bold text-slate-700">
              <span className="flex items-center gap-1.5"><Check className="w-4 h-4 text-cyan-600" /> نو ڈیٹا لاس</span>
              <span className="flex items-center gap-1.5"><Check className="w-4 h-4 text-cyan-600" /> کیش میں محفوظ</span>
              <span className="flex items-center gap-1.5"><Check className="w-4 h-4 text-cyan-600" /> فوری ریکوری</span>
            </div>
          </div>

          {/* Tile 2: WhatsApp & Automated Khata */}
          <div className="p-8 rounded-3xl bg-white border border-slate-200 shadow-sm hover:shadow-xl transition-all duration-300 relative group">
            <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
              <MessageCircle className="w-6 h-6" />
            </div>
            <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
              1-Click WhatsApp
            </span>
            <h3 className="text-xl font-black text-slate-900 mt-4 mb-2">
              گاہک کے واٹس ایپ پر فوری بل اور کھاتہ پی ڈی ایف
            </h3>
            <p className="text-slate-600 text-xs leading-relaxed">
              بل بنتے ہی یا بقایا رقم کا تقاضا کرنے کے لیے ایک کلک میں پروفیشنل پی ڈی ایف رسید براہ راست گاہک کے واٹس ایپ پر ارسال کریں۔
            </p>
          </div>

          {/* Tile 3: Vehicle & Showroom Module */}
          <div className="p-8 rounded-3xl bg-white border border-slate-200 shadow-sm hover:shadow-xl transition-all duration-300 relative group">
            <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
              <Car className="w-6 h-6" />
            </div>
            <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
              Automobile Showroom
            </span>
            <h3 className="text-xl font-black text-slate-900 mt-4 mb-2">
              گاڑیوں کے قانونی اقرار نامے اور اقساط
            </h3>
            <p className="text-slate-600 text-xs leading-relaxed">
              چیسس نمبر، انجن نمبر، بائیو میٹرک اسٹیٹس، ضامن کی تفصیلات اور اقساط کا خودکار کیلکولیٹر اور ڈیو الرٹس۔
            </p>
          </div>

          {/* Tile 4: Multi-Branch & Realtime Ledger */}
          <div className="p-8 rounded-3xl bg-white border border-slate-200 shadow-sm hover:shadow-xl transition-all duration-300 relative group">
            <div className="w-12 h-12 rounded-2xl bg-indigo-100 text-indigo-700 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
              <Building2 className="w-6 h-6" />
            </div>
            <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
              Multi-Branch
            </span>
            <h3 className="text-xl font-black text-slate-900 mt-4 mb-2">
              ملٹی برانچ انوینٹری ٹرانسفر
            </h3>
            <p className="text-slate-600 text-xs leading-relaxed">
              ایک ہی اکاؤنٹ سے اپنے تمام گوداموں اور دکانوں کا اسٹاک لائیو چیک کریں اور انٹر-برانچ اسٹاک ٹرانسفر ریکارڈ کریں۔
            </p>
          </div>

          {/* Tile 5: Large Analytics Tile */}
          <div className="md:col-span-2 lg:col-span-3 p-8 rounded-3xl bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 text-white shadow-xl hover:shadow-2xl transition-all duration-300 relative overflow-hidden group">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div>
                <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                  Daily Roznamcha & Profit Analysis
                </span>
                <h3 className="text-2xl sm:text-3xl font-black mt-3 mb-2">
                  روزنامچہ، نفع و نقصان اور آڈٹ رپورٹ
                </h3>
                <p className="text-slate-300 text-sm max-w-xl leading-relaxed">
                  دن کے اختتام پر کیش کاؤنٹر کلوزنگ، خالص منافع، بقایا جات اور اخراجات کی تفصیل صرف ایک کلک میں خودکار تیار۔
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 shrink-0">
                <div className="p-3.5 rounded-2xl bg-slate-800/80 border border-slate-700 text-center">
                  <div className="text-xl font-black text-emerald-400">Rs. 4.8M+</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">اوسط ماہانہ سیلز ٹریکنگ</div>
                </div>
                <div className="p-3.5 rounded-2xl bg-slate-800/80 border border-slate-700 text-center">
                  <div className="text-xl font-black text-cyan-400">99.8%</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">ریکوری کی شرح میں اضافہ</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Multi-Industry Selector */}
      <section id="solutions" className="py-20 px-4 sm:px-6 lg:px-8 bg-slate-100/70 border-t border-slate-200">
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-3xl mx-auto mb-12">
            <span className="text-xs font-bold uppercase tracking-widest text-cyan-700 bg-cyan-100/60 px-3 py-1 rounded-full border border-cyan-300">
              Industry Adaptability
            </span>
            <h2 className="text-3xl sm:text-5xl font-black text-slate-900 mt-3 mb-4">
              آپ کے مخصوص شعبے کے تقاضوں کے عین مطابق
            </h2>
            <p className="text-slate-600 text-sm sm:text-base">
              ہر کاروبار کا کام کرنے کا طریقہ منفرد ہے۔ ہمارا سافٹ وئیر آپ کی انڈسٹری منتخب کرنے پر فوری طور پر اس کے مطابق ڈھل جاتا ہے۔
            </p>
          </div>

          {/* Industry Tabs */}
          <div className="flex flex-wrap items-center justify-center gap-2 mb-8">
            {[
              { id: "showroom", label: "کار شو روم و آٹوموبائل", icon: Car },
              { id: "mobile", label: "موبائل شاپ و الیکٹرانکس", icon: Smartphone },
              { id: "wholesale", label: "ہول سیل و ڈسٹری بیوشن", icon: Building2 },
              { id: "pharma", label: "فارمیسی و میڈیکل اسٹور", icon: Pill },
              { id: "restaurant", label: "ریستوران و فاسٹ فوڈ", icon: Utensils },
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-5 py-3 rounded-2xl text-xs font-black transition-all ${
                    isActive
                      ? "bg-slate-900 text-white shadow-lg shadow-slate-900/10 scale-105"
                      : "bg-white text-slate-700 border border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? "text-cyan-400" : "text-slate-500"}`} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* Tab Content Display */}
          <div className="p-8 rounded-3xl bg-white border border-slate-200 shadow-sm max-w-4xl mx-auto">
            {activeTab === "showroom" && (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center font-bold">
                    <Car className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-slate-900">موٹر شو روم اور قسطوں کا کاروبار</h3>
                    <p className="text-xs text-slate-500">گاڑیوں کی خرید و فروخت، انویسٹر پارٹنرشپ، اور قانونی دستاویزات</p>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-slate-700 pt-3 border-t border-slate-100">
                  <div className="p-3 rounded-xl bg-slate-50 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>چیسس، انجن اور رجسٹریشن نمبر کے ساتھ مکمل لاگ</span>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-50 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>ماہانہ اقساط کا شیڈول اور تاریخ گزرنے پر الرٹ</span>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-50 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>قانونی اقرار نامہ اور اسٹامپ پیپر پرنٹنگ فارمیٹ</span>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-50 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>انویسٹر کا فیصد نفع اور منافع کی تقسیم کا کھاتہ</span>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "mobile" && (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-cyan-100 text-cyan-700 flex items-center justify-center font-bold">
                    <Smartphone className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-slate-900">موبائل، کمپیوٹر و الیکٹرانکس</h3>
                    <p className="text-xs text-slate-500">IMEI نمبر ٹریکنگ، وارنٹی رجسٹریشن اور اسپیئر پارٹس اسٹاک</p>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-slate-700 pt-3 border-t border-slate-100">
                  <div className="p-3 rounded-xl bg-slate-50 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>ہر ہینڈسیٹ کا منفرد IMEI 1 اور IMEI 2 ٹریکنگ</span>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-50 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>برانڈ وارنٹی کلیم اور سروس سینٹر ریکارڈ</span>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-50 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>موبائل ریپئرنگ اور پارٹس کا کھاتہ</span>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-50 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>ایک کلک پر تھرمل بارکوڈ پرنٹنگ لیبلز</span>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "wholesale" && (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold">
                    <Building2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-slate-900">ہول سیل مارکیٹ و ڈسٹری بیوشن ایجنسی</h3>
                    <p className="text-xs text-slate-500">پارٹی لیجر، کریڈٹ لمٹ کنٹرول، اور سیلزمین بکنگ آرڈرز</p>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-slate-700 pt-3 border-t border-slate-100">
                  <div className="p-3 rounded-xl bg-slate-50 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>پارٹی کے ادھار کی حد (Credit Limit) لاک سسٹم</span>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-50 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>سیلزمین بکنگ اور فیلڈ ریکوری لاگ</span>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-50 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>پیٹی، کارٹن اور لوز آئٹم پیکنگ ریٹس</span>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-50 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>سپلائر پروڈکٹ وائز پرچیز انوائس چیکنگ</span>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "pharma" && (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center font-bold">
                    <Pill className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-slate-900">فارمیسی و میڈیکل اسٹورز</h3>
                    <p className="text-xs text-slate-500">بیچ نمبر، ایکسپائری الرٹس اور فارمولا جنیرک سرچ</p>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-slate-700 pt-3 border-t border-slate-100">
                  <div className="p-3 rounded-xl bg-slate-50 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>بیچ نمبر اور ایکسپائری سے 60 دن پہلے الرٹ</span>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-50 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>سستے متبادل فارمولے (Generics) کی تلاش</span>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-50 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>کنٹرولڈ میڈیسن اور پریسکرپشن ریکارڈ</span>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-50 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>ڈسٹری بیوٹر بونس اسکیم اور ڈسکاؤنٹ مینجمنٹ</span>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "restaurant" && (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-orange-100 text-orange-700 flex items-center justify-center font-bold">
                    <Utensils className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-slate-900">ریستوران، کیفے و فاسٹ فوڈ</h3>
                    <p className="text-xs text-slate-500">کچن آرڈر ٹکٹ (KOT)، ٹیبل مینجمنٹ اور ہوم ڈلیوری لاگ</p>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-slate-700 pt-3 border-t border-slate-100">
                  <div className="p-3 rounded-xl bg-slate-50 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>کچن ڈسپلے سسٹم اور وائرلیس KOT پرنٹر</span>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-50 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>ٹیبل سوئچنگ اور بل اسپلٹ کی سہولت</span>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-50 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>رائڈر کیش ریکوری اور ڈلیوری اسٹیٹس</span>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-50 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>ریسیپی لاگت اور را میٹریل کٹوتی</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <span className="text-xs font-bold uppercase tracking-widest text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
            Transparent Pricing
          </span>
          <h2 className="text-3xl sm:text-5xl font-black text-slate-950 mt-3 mb-4">
            سیدھی اور شفاف قیمتیں، کوئی پوشیدہ فیس نہیں
          </h2>
          <p className="text-slate-600 text-sm sm:text-base">
            تمام پیکجز میں کلاؤڈ ہوسٹنگ، روزانہ بیک اپ، اور واٹس ایپ سپورٹ شامل ہے۔
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-stretch max-w-6xl mx-auto">
          {/* Starter Plan */}
          <div className="p-8 rounded-3xl bg-white border border-slate-200 shadow-sm flex flex-col justify-between">
            <div>
              <div className="text-xs font-black uppercase text-slate-400">سنگل شاپ / دکان دار</div>
              <h3 className="text-2xl font-black text-slate-900 mt-1">اسٹارٹر پلان</h3>
              <div className="mt-4 mb-6">
                <span className="text-4xl font-black text-slate-900">Rs. 1,500</span>
                <span className="text-xs text-slate-500 font-semibold"> / ماہانہ</span>
              </div>
              <ul className="space-y-3 text-xs text-slate-600">
                <li className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-600" /> 1 شاپ / برانچ لائیو</li>
                <li className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-600" /> لا محدود بارکوڈ بلنگ و سیلز</li>
                <li className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-600" /> کسٹمر و سپلائر کھاتہ لیجر</li>
                <li className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-600" /> تھرمل رسید پرنٹنگ (اردو/ENG)</li>
                <li className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-600" /> آف لائن بلنگ سپورٹ</li>
              </ul>
            </div>
            <Link
              href="/register"
              className="mt-8 w-full py-3.5 rounded-xl border border-slate-300 font-bold text-xs text-center text-slate-800 hover:bg-slate-50 transition-colors"
            >
              14 دن مفت آزمائیں
            </Link>
          </div>

          {/* Pro Business Plan (Featured) */}
          <div className="p-8 rounded-3xl bg-slate-950 text-white shadow-2xl relative flex flex-col justify-between border-2 border-cyan-500 scale-105">
            <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-gradient-to-r from-cyan-500 to-blue-500 text-slate-950 font-black text-[11px] tracking-wide shadow-md">
              سب سے زیادہ مقبول (Most Popular)
            </div>
            <div>
              <div className="text-xs font-black uppercase text-cyan-400">تیزی سے پھیلتے کاروبار</div>
              <h3 className="text-2xl font-black text-white mt-1">بزنس پرو پلان</h3>
              <div className="mt-4 mb-6">
                <span className="text-4xl font-black text-white">Rs. 3,500</span>
                <span className="text-xs text-slate-400 font-semibold"> / ماہانہ</span>
              </div>
              <ul className="space-y-3 text-xs text-slate-300">
                <li className="flex items-center gap-2"><Check className="w-4 h-4 text-cyan-400" /> 3 برانچیں اور گودام شامل</li>
                <li className="flex items-center gap-2"><Check className="w-4 h-4 text-cyan-400" /> آٹومیٹک واٹس ایپ پی ڈی ایف لیجر</li>
                <li className="flex items-center gap-2"><Check className="w-4 h-4 text-cyan-400" /> یوزرز اور عملے کے رول پرمیشنز</li>
                <li className="flex items-center gap-2"><Check className="w-4 h-4 text-cyan-400" /> انٹر-برانچ اسٹاک ٹرانسفر لاگ</li>
                <li className="flex items-center gap-2"><Check className="w-4 h-4 text-cyan-400" /> روزانہ آٹو کلاؤڈ بیک اپ</li>
                <li className="flex items-center gap-2"><Check className="w-4 h-4 text-cyan-400" /> VIP فون و واٹس ایپ سپورٹ</li>
              </ul>
            </div>
            <Link
              href="/register"
              className="mt-8 w-full py-3.5 rounded-xl bg-gradient-to-r from-cyan-400 to-blue-500 hover:from-cyan-300 hover:to-blue-400 font-black text-xs text-center text-slate-950 shadow-lg shadow-cyan-500/20 transition-all hover:scale-[1.02]"
            >
              بزنس پرو ٹرائل شروع کریں
            </Link>
          </div>

          {/* Showroom / Enterprise Plan */}
          <div className="p-8 rounded-3xl bg-white border border-slate-200 shadow-sm flex flex-col justify-between">
            <div>
              <div className="text-xs font-black uppercase text-slate-400">شو رومز، ہول سیلرز و کمپنیاں</div>
              <h3 className="text-2xl font-black text-slate-900 mt-1">شو روم انٹرپرائز</h3>
              <div className="mt-4 mb-6">
                <span className="text-4xl font-black text-slate-900">Rs. 7,000</span>
                <span className="text-xs text-slate-500 font-semibold"> / ماہانہ</span>
              </div>
              <ul className="space-y-3 text-xs text-slate-600">
                <li className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-600" /> لامحدود برانچز اور شو رومز</li>
                <li className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-600" /> اقساط اور قانونی اقرار نامے ماڈیول</li>
                <li className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-600" /> انویسٹر پارٹنرشپ اور نفع تقسیم</li>
                <li className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-600" /> پرسنل کلاؤڈ ڈیٹا بیس ڈیڈیکیٹڈ</li>
                <li className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-600" /> 24/7 ڈیڈیکیٹڈ اکاؤنٹ مینیجر</li>
              </ul>
            </div>
            <a
              href="https://wa.me/923004074760?text=Assalam-o-Alaikum%20Showroom%20Enterprise%20Plan%20chahiye"
              target="_blank"
              rel="noreferrer"
              className="mt-8 w-full py-3.5 rounded-xl border border-slate-300 font-bold text-xs text-center text-slate-800 hover:bg-slate-50 transition-colors"
            >
              سیلز ٹیم سے رابطہ کریں
            </a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-950 text-slate-400 py-16 px-4 sm:px-6 lg:px-8 border-t border-slate-800">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-6 text-xs">
          <div>
            <div className="text-white font-black text-base">THE ACCOUNTS CLOUD</div>
            <p className="text-slate-500 mt-1">Multi-Industry Hybrid Cloud Operating System • Pakistan & Gulf</p>
          </div>
          <div className="flex items-center gap-6 font-medium">
            <Link href="/preview/vip" className="hover:text-white transition-colors">VIP Showcase Hub</Link>
            <Link href="/preview/vip/titanium" className="hover:text-white transition-colors">Titanium Concept</Link>
            <Link href="/preview/vip/royal" className="hover:text-white transition-colors">Royal Gold Concept</Link>
            <Link href="/preview/vip/bento" className="text-cyan-400 font-bold">Neo Bento Pro</Link>
          </div>
          <div className="text-slate-500">
            © {new Date().getFullYear()} The Accounts Cloud. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
