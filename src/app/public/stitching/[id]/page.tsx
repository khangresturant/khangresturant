"use client";

import React, { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { 
  Scissors, CheckCircle2, Clock, Calendar, 
  MapPin, Phone, MessageCircle, AlertCircle, Sparkles, Shirt, Loader2
} from "lucide-react";
import { formatWhatsAppPhone } from "@/lib/whatsapp";

type StitchingOrder = {
  id: string;
  created_at: string;
  delivery_date: string;
  status: "pending" | "cutting" | "stitching" | "completed" | "delivered";
  total_amount: number;
  advance_payment: number;
  payment_status: string;
  garment_type: string | null;
  fabric: string | null;
  design_style: string | null;
  suit_code?: string | null;
  suit_image_url?: string | null;
  shop_id: string;
  customers?: { name: string; phone: string | null } | null;
  tailor_measurements?: any;
};

type ShopInfo = {
  name: string;
  address: string | null;
  phone: string | null;
  city: string | null;
};

const STATUS_STAGES = [
  { key: "pending", label: "Order Received", desc: "Order booked & queued" },
  { key: "cutting", label: "Cutting Phase", desc: "Cloth being cut to size" },
  { key: "stitching", label: "Stitching Phase", desc: "Tailor stitching in progress" },
  { key: "completed", label: "Ready for Pickup!", desc: "Suit stitched & ironed" },
  { key: "delivered", label: "Delivered", desc: "Handed over to customer" },
];

export default function PublicStitchingStatusPage() {
  const params = useParams();
  const id = params?.id as string;
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [order, setOrder] = useState<StitchingOrder | null>(null);
  const [shop, setShop] = useState<ShopInfo | null>(null);

  useEffect(() => {
    if (id) {
      fetchPublicOrder();
    }
  }, [id]);

  const fetchPublicOrder = async () => {
    setLoading(true);
    setError(null);
    try {
      // Fetch order by ID
      const { data: orderData, error: orderErr } = await supabase
        .from("stitching_orders")
        .select(`
          id, created_at, delivery_date, status, total_amount, advance_payment,
          payment_status, garment_type, fabric, design_style, suit_code, suit_image_url, shop_id,
          customers:parties!stitching_orders_customer_id_fkey ( name, phone ),
          tailor_measurements ( length, chest, waist, shoulder, collar, shalwar, paincha, teera, big_teera )
        `)
        .eq("id", id)
        .maybeSingle();

      if (orderErr) throw orderErr;
      if (!orderData) {
        setError("Stitching order not found. Please check the QR code or link.");
        setLoading(false);
        return;
      }

      setOrder(orderData as any);

      // Fetch Shop Info
      const { data: shopData } = await supabase
        .from("shops")
        .select("name, address, phone, city")
        .eq("id", orderData.shop_id)
        .maybeSingle();

      if (shopData) setShop(shopData);
    } catch (err: any) {
      setError(err.message || "Failed to load order details");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 text-white font-sans">
        <Loader2 className="h-10 w-10 animate-spin text-amber-400 mb-3" />
        <p className="text-xs font-black uppercase tracking-widest text-slate-400">Loading Suit Status...</p>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-white font-sans">
        <div className="bg-slate-900 border border-slate-800 p-8 rounded-3xl max-w-md text-center space-y-4 shadow-2xl">
          <div className="h-14 w-14 bg-rose-500/10 text-rose-500 rounded-2xl flex items-center justify-center mx-auto border border-rose-500/20">
            <AlertCircle size={28} />
          </div>
          <h2 className="text-lg font-black text-white uppercase tracking-wider">Order Not Found</h2>
          <p className="text-xs text-slate-400 font-semibold">{error}</p>
        </div>
      </div>
    );
  }

  const currentStageIndex = STATUS_STAGES.findIndex(s => s.key === order.status);
  const netBalance = Math.max(0, Number(order.total_amount || 0) - Number(order.advance_payment || 0));
  const isReady = order.status === "completed" || order.status === "delivered";

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-slate-100 font-sans p-4 sm:p-6 pb-12">
      <div className="max-w-xl mx-auto space-y-6">
        
        {/* Shop Branding Header */}
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-6 shadow-2xl text-center space-y-2 relative overflow-hidden">
          <div className="absolute top-0 right-0 translate-x-4 -translate-y-4 w-32 h-32 bg-amber-500/10 rounded-full blur-2xl pointer-events-none" />
          
          <div className="inline-flex p-3 bg-amber-500/10 text-amber-400 rounded-2xl border border-amber-500/20 mb-1">
            <Scissors size={26} />
          </div>

          <h1 className="text-xl font-black text-white uppercase tracking-wider">{shop?.name || "Boutique & Tailors"}</h1>
          <p className="text-xs text-slate-400 font-medium">{shop?.address ? `${shop.address}${shop.city ? `, ${shop.city}` : ""}` : "Stitching Order Live Telemetry"}</p>
        </div>

        {/* Live Status Banner */}
        <div className={`p-6 rounded-3xl border shadow-xl text-center space-y-2 relative overflow-hidden ${
          isReady
            ? "bg-gradient-to-r from-emerald-950/80 to-slate-900 border-emerald-500/30 text-emerald-300"
            : "bg-gradient-to-r from-amber-950/80 to-slate-900 border-amber-500/30 text-amber-300"
        }`}>
          <p className="text-[10px] font-black uppercase tracking-widest opacity-75">Suit Order Reference: #{order.id.slice(0, 8).toUpperCase()}</p>
          <h2 className="text-2xl font-black text-white uppercase tracking-wide flex items-center justify-center gap-2">
            {isReady ? <CheckCircle2 className="text-emerald-400" size={26} /> : <Clock className="text-amber-400" size={26} />}
            {order.status === "completed" ? "Ready for Pickup!" : order.status.toUpperCase()}
          </h2>
          <p className="text-xs text-slate-300 font-semibold">
            {order.status === "completed"
              ? "Aapka suit tayyar ho chuka hai! Baqaya balance ada karke receipt le jayein."
              : order.status === "delivered"
              ? "Suit customer ko deliver ho chuka hai. Shukriya!"
              : `Delivery Date: ${new Date(order.delivery_date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}`}
          </p>
        </div>

        {/* Workflow Progress Stepper */}
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-6 shadow-xl space-y-6">
          <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 border-b border-white/10 pb-3 flex items-center gap-2">
            <Sparkles size={14} className="text-amber-400" /> Suit Stitching Timeline
          </h3>

          <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-800">
            {STATUS_STAGES.map((stage, idx) => {
              const isPassed = currentStageIndex >= idx;
              const isCurrent = currentStageIndex === idx;

              return (
                <div key={stage.key} className="relative flex items-start gap-4">
                  <div className={`absolute -left-6 top-0.5 h-5 w-5 rounded-full border-2 flex items-center justify-center transition-all ${
                    isPassed
                      ? "bg-amber-400 border-amber-400 text-slate-950 font-black text-[10px]"
                      : "bg-slate-900 border-slate-700 text-transparent"
                  }`}>
                    ✓
                  </div>
                  <div>
                    <p className={`text-sm font-black transition-colors ${
                      isCurrent ? "text-amber-400" : isPassed ? "text-slate-200" : "text-slate-500"
                    }`}>
                      {stage.label}
                    </p>
                    <p className="text-xs text-slate-400 font-medium mt-0.5">{stage.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Order Details & Summary Card */}
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-6 shadow-xl space-y-4">
          <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 border-b border-white/10 pb-3 flex items-center gap-2">
            <Shirt size={14} className="text-amber-400" /> Order Details
          </h3>

          <div className="grid grid-cols-2 gap-4 text-xs">
            <div>
              <p className="text-slate-500 font-bold uppercase text-[10px]">Customer Name</p>
              <p className="font-bold text-white mt-0.5">{order.customers?.name || "Valued Customer"}</p>
            </div>
            <div>
              <p className="text-slate-500 font-bold uppercase text-[10px]">Garment Type</p>
              <p className="font-bold text-white mt-0.5">{order.garment_type || "Shalwar Kameez"}</p>
            </div>
            <div>
              <p className="text-slate-500 font-bold uppercase text-[10px]">Fabric Material</p>
              <p className="font-bold text-white mt-0.5">{order.fabric || "Standard Fabric"}</p>
            </div>
            <div>
              <p className="text-slate-500 font-bold uppercase text-[10px]">Promised Delivery</p>
              <p className="font-bold text-amber-400 mt-0.5">{new Date(order.delivery_date).toLocaleDateString("en-GB")}</p>
            </div>
          </div>

          {order.design_style && (
            <div className="bg-slate-900/60 p-3 rounded-2xl border border-slate-800 text-xs">
              <p className="text-slate-500 font-bold uppercase text-[10px] mb-1">Design & Stitching Notes</p>
              <p className="text-slate-300 font-medium italic">{order.design_style}</p>
            </div>
          )}

          {/* Financial Breakdown */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-2 text-xs">
            <div className="flex justify-between text-slate-400 font-bold">
              <span>Total Bill Rate</span>
              <span className="text-white font-black">Rs {Number(order.total_amount || 0).toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-slate-400 font-bold">
              <span>Advance Paid</span>
              <span className="text-emerald-400 font-black">Rs {Number(order.advance_payment || 0).toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-sm font-black text-white pt-2 border-t border-slate-800">
              <span>Net Balance Due</span>
              <span className="text-rose-400">Rs {netBalance.toLocaleString()}</span>
            </div>
          </div>

          {/* Shop WhatsApp Support Button */}
          {shop?.phone && (
            <a
              href={`https://wa.me/${formatWhatsAppPhone(shop.phone)}?text=${encodeURIComponent(`Assalam-o-Alaikum! Regarding my Stitching Order #${order.id.slice(0, 8).toUpperCase()}`)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs h-12 rounded-2xl shadow-lg flex items-center justify-center gap-2 transition cursor-pointer"
            >
              <MessageCircle size={16} /> Contact Tailor Shop on WhatsApp
            </a>
          )}
        </div>

      </div>
    </div>
  );
}
