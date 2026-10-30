"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Smartphone, Search, PlusCircle, Trash2, Edit, Calendar,
  Loader2, Save, X, Phone, User, ShieldCheck, FileText,
  AlertTriangle, DollarSign, CheckCircle, QrCode, Download,
  Camera, ArrowRight, Layers, Tag, Eye, BadgeCheck
} from "lucide-react";
import { useShop } from "@/context/ShopContext";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { jsPDF } from "jspdf";

type UsedMobilePurchase = {
  id: string;
  shop_id: string;
  customer_name: string;
  customer_cnic: string;
  customer_father_name: string | null;
  customer_phone: string;
  customer_address: string | null;
  brand: string;
  device_model: string;
  color: string | null;
  storage_capacity: string | null;
  imei_1: string;
  imei_2: string | null;
  pta_status: string;
  battery_health: number | null;
  condition_rating: string;
  accessories_included: string[] | null;
  fault_notes: string | null;
  purchase_price: number;
  payment_mode: string;
  affidavit_agreed: boolean;
  status: string;
  created_at: string;
};

const COMMON_BRANDS = [
  "Apple iPhone", "Samsung", "Xiaomi / Redmi", "Vivo", 
  "Oppo", "Realme", "Infinix", "Tecno", "OnePlus", "Google Pixel", "Other"
];

const PTA_STATUS_OPTIONS = [
  "Official PTA Approved",
  "Non-PTA / JV Sim",
  "CPID / Patch Approved",
  "Factory Unlock (Global)",
  "Gevey / Turbo Sim"
];

const CONDITION_OPTIONS = [
  "10/10 Like New / Box Pack",
  "9/10 Minor Scratches",
  "8/10 Visible Wear",
  "7/10 Rough / Glass Crack",
  "Refurbished / Repaired"
];

const ACCESSORIES_LIST = [
  "Original Box", "Original Charger", "Data Cable", "Handsfree / AirPods", "Warranty Card"
];

export default function UsedMobileBuybackPage() {
  const { shopId, shopName } = useShop();
  const supabase = createClient();

  const [purchases, setPurchases] = useState<UsedMobilePurchase[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingPurchase, setEditingPurchase] = useState<UsedMobilePurchase | null>(null);
  const [selectedPurchaseForAffidavit, setSelectedPurchaseForAffidavit] = useState<UsedMobilePurchase | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    customer_name: "",
    customer_cnic: "",
    customer_father_name: "",
    customer_phone: "",
    customer_address: "",
    brand: "Apple iPhone",
    device_model: "",
    color: "",
    storage_capacity: "128 GB",
    imei_1: "",
    imei_2: "",
    pta_status: "Official PTA Approved",
    battery_health: 85,
    condition_rating: "10/10 Like New / Box Pack",
    accessories_included: ["Original Box", "Data Cable"] as string[],
    fault_notes: "",
    purchase_price: 50000,
    payment_mode: "cash",
    affidavit_agreed: true,
    auto_create_inventory: true
  });

  useEffect(() => {
    if (shopId) {
      fetchPurchases();
    }
  }, [shopId]);

  const fetchPurchases = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("used_mobile_purchases")
        .select("*")
        .eq("shop_id", shopId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setPurchases((data as any) || []);
    } catch (err: any) {
      toast.error("Failed to load used phone purchases: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenAddModal = () => {
    setEditingPurchase(null);
    setFormData({
      customer_name: "",
      customer_cnic: "",
      customer_father_name: "",
      customer_phone: "",
      customer_address: "",
      brand: "Apple iPhone",
      device_model: "",
      color: "",
      storage_capacity: "128 GB",
      imei_1: "",
      imei_2: "",
      pta_status: "Official PTA Approved",
      battery_health: 85,
      condition_rating: "10/10 Like New / Box Pack",
      accessories_included: ["Original Box", "Data Cable"],
      fault_notes: "",
      purchase_price: 50000,
      payment_mode: "cash",
      affidavit_agreed: true,
      auto_create_inventory: true
    });
    setIsModalOpen(true);
  };

  const toggleAccessory = (acc: string) => {
    setFormData(prev => {
      const exists = prev.accessories_included.includes(acc);
      return {
        ...prev,
        accessories_included: exists
          ? prev.accessories_included.filter(a => a !== acc)
          : [...prev.accessories_included, acc]
      };
    });
  };

  const handleSavePurchase = async () => {
    if (!formData.customer_name.trim() || !formData.customer_cnic.trim()) {
      toast.error("Please enter Seller Name and CNIC Number (Mandatory for police record).");
      return;
    }
    if (!formData.brand || !formData.device_model.trim() || !formData.imei_1.trim()) {
      toast.error("Please enter Phone Model and at least IMEI-1.");
      return;
    }
    if (formData.imei_1.length < 14) {
      toast.error("Please enter a valid 15-digit IMEI number.");
      return;
    }

    setIsSubmitting(true);
    try {
      const dbPayload = {
        shop_id: shopId,
        customer_name: formData.customer_name.trim(),
        customer_cnic: formData.customer_cnic.trim(),
        customer_father_name: formData.customer_father_name.trim() || null,
        customer_phone: formData.customer_phone.trim(),
        customer_address: formData.customer_address.trim() || null,
        brand: formData.brand,
        device_model: formData.device_model.trim(),
        color: formData.color.trim() || null,
        storage_capacity: formData.storage_capacity || null,
        imei_1: formData.imei_1.trim(),
        imei_2: formData.imei_2.trim() || null,
        pta_status: formData.pta_status,
        battery_health: Number(formData.battery_health) || null,
        condition_rating: formData.condition_rating,
        accessories_included: formData.accessories_included,
        fault_notes: formData.fault_notes.trim() || null,
        purchase_price: Number(formData.purchase_price) || 0,
        payment_mode: formData.payment_mode,
        affidavit_agreed: formData.affidavit_agreed,
        status: "in_stock"
      };

      if (editingPurchase) {
        const { error } = await supabase
          .from("used_mobile_purchases")
          .update(dbPayload)
          .eq("id", editingPurchase.id);

        if (error) throw error;
        toast.success("Used phone purchase record updated!");
      } else {
        const { data: inserted, error } = await supabase
          .from("used_mobile_purchases")
          .insert(dbPayload)
          .select()
          .single();

        if (error) throw error;

        // Auto create stock product if enabled
        if (formData.auto_create_inventory) {
          try {
            const productName = `[Used] ${formData.brand} ${formData.device_model} ${formData.storage_capacity || ""} (${formData.color || ""})`.trim();
            await supabase.from("products").insert({
              shop_id: shopId,
              name: productName,
              purchase_price_single: formData.purchase_price,
              sale_price_single: Math.round(formData.purchase_price * 1.1),
              current_stock: 1,
              min_stock_level: 0,
              unit: "piece",
              has_imei: true,
              barcode: formData.imei_1.trim(),
              note: `Used Phone: IMEI ${formData.imei_1}, PTA: ${formData.pta_status}, Condition: ${formData.condition_rating}`
            });
          } catch (pErr: any) {
            console.error("Auto inventory creation note:", pErr.message);
          }
        }

        toast.success("Used phone recorded & CNIC Buyback Affidavit generated! 📱");
        if (inserted) {
          generateAffidavitPDF(inserted as any);
        }
      }

      setIsModalOpen(false);
      fetchPurchases();
    } catch (err: any) {
      toast.error("Error saving purchase: " + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const generateAffidavitPDF = (p: UsedMobilePurchase) => {
    try {
      const doc = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4"
      });

      // Border frame
      doc.setDrawColor(30, 41, 59);
      doc.setLineWidth(0.8);
      doc.rect(8, 8, 194, 281);

      // Inner Header Box
      doc.setFillColor(241, 245, 249);
      doc.rect(9, 9, 192, 28, "F");

      doc.setFont("helvetica", "bold");
      doc.setFontSize(18);
      doc.setTextColor(15, 23, 42);
      doc.text(shopName || "THE ACCOUNTS ELECTRONICS", 105, 19, { align: "center" });

      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(220, 38, 38);
      doc.text("USED MOBILE PHONE PURCHASE & POLICE COMPLIANCE AFFIDAVIT", 105, 26, { align: "center" });

      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(71, 85, 105);
      doc.text("Legal Ownership Buyback Declaration Under Pakistan Law & CPLC Verification", 105, 32, { align: "center" });

      // Token No & Date
      let y = 44;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(30, 41, 59);
      doc.text(`Record Voucher ID: BUY-${p.id.substring(0, 8).toUpperCase()}`, 14, y);
      doc.text(`Date & Time: ${new Date(p.created_at).toLocaleString()}`, 196, y, { align: "right" });

      y += 5;
      doc.setDrawColor(203, 213, 225);
      doc.line(12, y, 198, y);
      y += 8;

      // Seller Section Header
      doc.setFillColor(226, 232, 240);
      doc.rect(12, y, 186, 7, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(15, 23, 42);
      doc.text("1. SELLER (FIRST PARTY) IDENTIFICATION & PARTICULARS", 16, y + 5);
      y += 12;

      const drawRow = (l1: string, v1: string, l2: string, v2: string) => {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9.5);
        doc.setTextColor(71, 85, 105);
        doc.text(l1, 16, y);
        doc.text(l2, 110, y);

        doc.setFont("helvetica", "bold");
        doc.setTextColor(15, 23, 42);
        doc.text(v1 || "—", 50, y);
        doc.text(v2 || "—", 145, y);
        y += 7;
      };

      drawRow("Seller Name:", p.customer_name, "CNIC Number:", p.customer_cnic);
      drawRow("Father Name:", p.customer_father_name || "—", "Mobile / Phone:", p.customer_phone);

      doc.setFont("helvetica", "bold");
      doc.setTextColor(71, 85, 105);
      doc.text("Current Address:", 16, y);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(15, 23, 42);
      doc.text(p.customer_address || "Address recorded on original CNIC", 50, y);
      y += 10;

      // Device Section Header
      doc.setFillColor(226, 232, 240);
      doc.rect(12, y, 186, 7, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(15, 23, 42);
      doc.text("2. PURCHASED DEVICE SPECIFICATIONS & IMEI DATA", 16, y + 5);
      y += 12;

      drawRow("Make / Brand:", p.brand, "Model & Specs:", `${p.device_model} ${p.storage_capacity || ""}`);
      drawRow("Color / Finish:", p.color || "Standard", "Battery Health:", p.battery_health ? `${p.battery_health}%` : "Standard");
      drawRow("Primary IMEI (1):", p.imei_1, "Secondary IMEI (2):", p.imei_2 || "N/A (Single SIM)");
      drawRow("PTA Status:", p.pta_status, "Condition Rating:", p.condition_rating);

      const accText = (p.accessories_included && p.accessories_included.length > 0) ? p.accessories_included.join(", ") : "Handset Only";
      drawRow("Accessories:", accText, "Purchase Price:", `Rs ${Number(p.purchase_price).toLocaleString()} (${p.payment_mode.toUpperCase()})`);

      y += 5;
      // Affidavit Legal Declaration (Roman Urdu & English)
      doc.setFillColor(254, 242, 242);
      doc.setDrawColor(252, 165, 165);
      doc.rect(12, y, 186, 52, "FD");

      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(185, 28, 28);
      doc.text("LEGAL AFFIDAVIT & SOLEMN DECLARATION (حلف نامہ ملکیت)", 16, y + 6);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5);
      doc.setTextColor(51, 65, 85);
      const affidavitLines = [
        `Main (Seller) bamaqam hosh o hawas iqrar karta hoon ke yeh mobile device (Model: ${p.brand} ${p.device_model}, IMEI: ${p.imei_1})`,
        `meri zaati malkiat hai. Yeh mobile kisi bhi chori, dacaiti, fard-e-jurm ya ghair-qanooni sargarmi mein mulawis nahi hai.`,
        `Agar mustaqbil mein yeh handset kisi qisam ke police case, CPLC block, ya chori shuda sabit hua to is ki tamam tar qanooni`,
        `zimedari mujh (Seller) par hogi aur dukan intizamia har qisam ki liability se bari-uz-zimma hogi.`,
        `Main ne is mobile ki tay shuda raqam ba-hisaab Rs ${Number(p.purchase_price).toLocaleString()} bila kisi dabaao ke wasool pa li hai.`
      ];

      let afY = y + 13;
      affidavitLines.forEach(line => {
        doc.text(line, 16, afY);
        afY += 5.5;
      });

      y += 62;

      // Signature & Thumb impression area
      doc.setDrawColor(148, 163, 184);
      doc.rect(16, y, 55, 30);
      doc.rect(76, y, 55, 30);
      doc.rect(136, y, 55, 30);

      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.5);
      doc.setTextColor(71, 85, 105);
      doc.text("Seller CNIC / Thumb Mark", 18, y + 6);
      doc.text("Seller Signature", 78, y + 6);
      doc.text("Shopkeeper Official Stamp", 138, y + 6);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.setTextColor(148, 163, 184);
      doc.text("Angootha (Thumb) yahan lagaein", 20, y + 25);
      doc.text("Dastakhat (Sign) yahan karein", 80, y + 25);
      doc.text("Authorized Signature & Stamp", 140, y + 25);

      // Save PDF
      doc.save(`Buyback_Affidavit_${p.imei_1}_${p.customer_name.replace(/\s+/g, "_")}.pdf`);
      toast.success("Affidavit PDF downloaded!");
    } catch (e: any) {
      toast.error("Failed to generate PDF: " + e.message);
    }
  };

  const filteredPurchases = purchases.filter(p => {
    const q = searchQuery.toLowerCase();
    const matchesSearch = 
      p.customer_name.toLowerCase().includes(q) ||
      p.customer_cnic.toLowerCase().includes(q) ||
      p.device_model.toLowerCase().includes(q) ||
      p.imei_1.toLowerCase().includes(q) ||
      (p.imei_2 && p.imei_2.toLowerCase().includes(q)) ||
      p.brand.toLowerCase().includes(q);

    const matchesStatus = statusFilter === "all" || p.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const totalSpent = purchases.reduce((s, x) => s + Number(x.purchase_price || 0), 0);

  return (
    <div className="space-y-4 font-sans text-slate-800">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
        <div>
          <h2 className="text-xl md:text-2xl font-black tracking-tight text-slate-900 flex items-center gap-2">
            <Smartphone className="text-indigo-600 h-6 w-6" />
            <span>Used Phone Buyback &amp; CNIC Register</span>
          </h2>
          <p className="text-slate-500 text-xs mt-0.5">
            Legal CNIC affidavit, CPLC compliance, and second-hand mobile purchase ledger
          </p>
        </div>

        <Button
          onClick={handleOpenAddModal}
          className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold h-9 text-xs px-4 rounded-xl shadow-sm cursor-pointer self-start sm:self-auto"
        >
          <PlusCircle className="mr-1.5 h-4 w-4" />
          Buy Old Phone (خریداری پرانا فون)
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-indigo-50/70 border border-indigo-200/80 p-3.5 rounded-2xl shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-indigo-700">Total Buyback Handsets</span>
            <span className="p-1.5 rounded-xl bg-indigo-100 text-indigo-700"><Smartphone size={14}/></span>
          </div>
          <p className="text-2xl font-black text-indigo-950 mt-1">{purchases.length}</p>
          <p className="text-[11px] font-semibold text-indigo-800/80 mt-0.5">Recorded with seller CNIC</p>
        </div>

        <div className="bg-emerald-50/70 border border-emerald-200/80 p-3.5 rounded-2xl shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-emerald-700">Total Capital Invested</span>
            <span className="p-1.5 rounded-xl bg-emerald-100 text-emerald-700"><DollarSign size={14}/></span>
          </div>
          <p className="text-2xl font-black text-emerald-950 mt-1">Rs {Math.round(totalSpent).toLocaleString()}</p>
          <p className="text-[11px] font-semibold text-emerald-800/80 mt-0.5">Used phone procurement cost</p>
        </div>

        <div className="bg-blue-50/70 border border-blue-200/80 p-3.5 rounded-2xl shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-blue-700">Police &amp; CPLC Compliance</span>
            <span className="p-1.5 rounded-xl bg-blue-100 text-blue-700"><ShieldCheck size={14}/></span>
          </div>
          <p className="text-2xl font-black text-blue-950 mt-1">100% Legal</p>
          <p className="text-[11px] font-semibold text-blue-800/80 mt-0.5">Signed affidavit for each IMEI</p>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-3 rounded-2xl border border-slate-200/80 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Search by Seller Name, CNIC (xxxxx-xxxxxxx-x), Model, or 15-digit IMEI..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="pl-9 h-9 text-xs rounded-xl bg-slate-50 border-slate-200 focus:bg-white"
          />
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Status:</span>
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="h-9 text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 font-bold text-slate-700 focus:outline-none"
          >
            <option value="all">All Handsets</option>
            <option value="in_stock">In Stock / Available</option>
            <option value="sold">Resold / Sold Out</option>
          </select>
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-xs text-left text-slate-600">
            <thead className="bg-slate-100/80 text-[10px] uppercase font-black text-slate-700 border-b border-slate-200 select-none">
              <tr>
                <th className="py-3 px-3.5">Date</th>
                <th className="py-3 px-3.5">Seller Info &amp; CNIC</th>
                <th className="py-3 px-3.5">Device &amp; Specs</th>
                <th className="py-3 px-3.5">IMEI 1 &amp; IMEI 2</th>
                <th className="py-3 px-3.5">PTA &amp; Condition</th>
                <th className="py-3 px-3.5 text-right">Purchase Price</th>
                <th className="py-3 px-3.5 text-center">Affidavit &amp; Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto text-indigo-600 mb-2" />
                    Loading used phone buyback register...
                  </td>
                </tr>
              ) : filteredPurchases.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <Smartphone className="h-8 w-8 mx-auto text-slate-300 mb-2" />
                    No used phone buyback records found.
                  </td>
                </tr>
              ) : (
                filteredPurchases.map(p => (
                  <tr key={p.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-3.5 whitespace-nowrap text-[11px] text-slate-500">
                      {new Date(p.created_at).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-3.5">
                      <div className="font-bold text-slate-900">{p.customer_name}</div>
                      <div className="text-[10px] font-mono text-indigo-700 font-bold tracking-tight">CNIC: {p.customer_cnic}</div>
                      <div className="text-[10px] text-slate-400">{p.customer_phone}</div>
                    </td>
                    <td className="py-3 px-3.5">
                      <div className="font-bold text-slate-800">{p.brand} {p.device_model}</div>
                      <div className="text-[10px] text-slate-500">
                        {p.storage_capacity} · {p.color || "Standard"}
                        {p.battery_health ? ` · 🔋 ${p.battery_health}%` : ""}
                      </div>
                    </td>
                    <td className="py-3 px-3.5 font-mono text-[11px]">
                      <div className="font-bold text-slate-900">1: {p.imei_1}</div>
                      {p.imei_2 && <div className="text-slate-400 text-[10px]">2: {p.imei_2}</div>}
                    </td>
                    <td className="py-3 px-3.5">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        p.pta_status.includes("Approved") ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-amber-50 text-amber-700 border border-amber-200"
                      }`}>
                        {p.pta_status}
                      </span>
                      <div className="text-[10px] text-slate-400 mt-0.5">{p.condition_rating}</div>
                    </td>
                    <td className="py-3 px-3.5 text-right font-black text-slate-900 text-sm">
                      Rs {Number(p.purchase_price).toLocaleString()}
                    </td>
                    <td className="py-3 px-3.5 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <Button
                          onClick={() => generateAffidavitPDF(p)}
                          size="sm"
                          variant="outline"
                          className="h-7 text-[10px] font-bold border-indigo-200 text-indigo-700 hover:bg-indigo-50 px-2 rounded-lg cursor-pointer shadow-2xs"
                        >
                          <Download size={11} className="mr-1"/>
                          Affidavit PDF
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Buyback Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl border border-slate-100 max-h-[90vh] overflow-y-auto custom-scrollbar"
            >
              <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-2xl bg-indigo-50 text-indigo-600">
                    <Smartphone size={20} />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-slate-900">
                      Record Used Mobile Purchase (خریداری پرانا فون)
                    </h3>
                    <p className="text-[11px] text-slate-500">
                      Mandatory Police &amp; CPLC identification with signed ownership affidavit
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="p-1 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="space-y-4 pt-4 text-xs">
                {/* 1. Seller Information */}
                <div className="bg-slate-50/80 p-3.5 rounded-2xl border border-slate-200/80 space-y-3">
                  <div className="flex items-center gap-1.5 text-indigo-700 font-black text-[11px] uppercase tracking-wider">
                    <User size={13}/>
                    <span>1. Seller (First Party) Identification</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">
                        Seller Full Name *
                      </label>
                      <Input
                        value={formData.customer_name}
                        onChange={e => setFormData({ ...formData, customer_name: e.target.value })}
                        placeholder="e.g. Muhammad Ali"
                        className="h-8 text-xs font-bold rounded-xl"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">
                        CNIC Number (شناختی کارڈ) *
                      </label>
                      <Input
                        value={formData.customer_cnic}
                        onChange={e => setFormData({ ...formData, customer_cnic: e.target.value })}
                        placeholder="35201-xxxxxxx-x"
                        className="h-8 text-xs font-mono font-bold rounded-xl"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">
                        Father Name (والد کا نام)
                      </label>
                      <Input
                        value={formData.customer_father_name}
                        onChange={e => setFormData({ ...formData, customer_father_name: e.target.value })}
                        placeholder="e.g. Ghulam Muhammad"
                        className="h-8 text-xs rounded-xl"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">
                        Phone / WhatsApp No *
                      </label>
                      <Input
                        value={formData.customer_phone}
                        onChange={e => setFormData({ ...formData, customer_phone: e.target.value })}
                        placeholder="0300-1234567"
                        className="h-8 text-xs font-bold rounded-xl"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">
                        Permanent / Current Address
                      </label>
                      <Input
                        value={formData.customer_address}
                        onChange={e => setFormData({ ...formData, customer_address: e.target.value })}
                        placeholder="House / Mohallah / City"
                        className="h-8 text-xs rounded-xl"
                      />
                    </div>
                  </div>
                </div>

                {/* 2. Device Specifications */}
                <div className="bg-slate-50/80 p-3.5 rounded-2xl border border-slate-200/80 space-y-3">
                  <div className="flex items-center gap-1.5 text-indigo-700 font-black text-[11px] uppercase tracking-wider">
                    <Smartphone size={13}/>
                    <span>2. Handset Specs &amp; IMEI Identification</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">
                        Brand *
                      </label>
                      <select
                        value={formData.brand}
                        onChange={e => setFormData({ ...formData, brand: e.target.value })}
                        className="w-full h-8 text-xs font-bold bg-white border border-slate-200 rounded-xl px-2.5"
                      >
                        {COMMON_BRANDS.map(b => (
                          <option key={b} value={b}>{b}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">
                        Device Model *
                      </label>
                      <Input
                        value={formData.device_model}
                        onChange={e => setFormData({ ...formData, device_model: e.target.value })}
                        placeholder="e.g. iPhone 13 Pro Max / A54"
                        className="h-8 text-xs font-bold rounded-xl"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">
                        Storage Capacity
                      </label>
                      <select
                        value={formData.storage_capacity}
                        onChange={e => setFormData({ ...formData, storage_capacity: e.target.value })}
                        className="w-full h-8 text-xs bg-white border border-slate-200 rounded-xl px-2.5 font-bold"
                      >
                        {["32 GB", "64 GB", "128 GB", "256 GB", "512 GB", "1 TB"].map(s => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">
                        Primary IMEI (1) *
                      </label>
                      <Input
                        value={formData.imei_1}
                        onChange={e => setFormData({ ...formData, imei_1: e.target.value })}
                        placeholder="15-digit IMEI 1"
                        maxLength={15}
                        className="h-8 text-xs font-mono font-black text-indigo-900 rounded-xl"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">
                        Secondary IMEI (2)
                      </label>
                      <Input
                        value={formData.imei_2}
                        onChange={e => setFormData({ ...formData, imei_2: e.target.value })}
                        placeholder="15-digit IMEI 2 (if Dual SIM)"
                        maxLength={15}
                        className="h-8 text-xs font-mono rounded-xl"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">
                        PTA Status
                      </label>
                      <select
                        value={formData.pta_status}
                        onChange={e => setFormData({ ...formData, pta_status: e.target.value })}
                        className="w-full h-8 text-xs bg-white border border-slate-200 rounded-xl px-2.5 font-bold"
                      >
                        {PTA_STATUS_OPTIONS.map(p => (
                          <option key={p} value={p}>{p}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">
                        Color / Body
                      </label>
                      <Input
                        value={formData.color}
                        onChange={e => setFormData({ ...formData, color: e.target.value })}
                        placeholder="e.g. Sierra Blue / Black"
                        className="h-8 text-xs rounded-xl"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">
                        Battery Health (%)
                      </label>
                      <Input
                        type="number"
                        value={formData.battery_health}
                        onChange={e => setFormData({ ...formData, battery_health: Number(e.target.value) })}
                        placeholder="e.g. 88"
                        className="h-8 text-xs font-bold rounded-xl"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">
                        Condition
                      </label>
                      <select
                        value={formData.condition_rating}
                        onChange={e => setFormData({ ...formData, condition_rating: e.target.value })}
                        className="w-full h-8 text-xs bg-white border border-slate-200 rounded-xl px-2.5 font-bold"
                      >
                        {CONDITION_OPTIONS.map(c => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Accessories Checklist */}
                  <div>
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1.5">
                      Included Accessories:
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {ACCESSORIES_LIST.map(acc => {
                        const isChecked = formData.accessories_included.includes(acc);
                        return (
                          <button
                            key={acc}
                            type="button"
                            onClick={() => toggleAccessory(acc)}
                            className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border transition-all cursor-pointer ${
                              isChecked
                                ? "bg-indigo-600 text-white border-indigo-600 shadow-2xs"
                                : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                            }`}
                          >
                            {isChecked ? "✓ " : "+ "}{acc}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* 3. Pricing & Legal Agreement */}
                <div className="bg-slate-50/80 p-3.5 rounded-2xl border border-slate-200/80 space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">
                        Agreed Purchase Price (Rs) *
                      </label>
                      <Input
                        type="number"
                        value={formData.purchase_price}
                        onChange={e => setFormData({ ...formData, purchase_price: Number(e.target.value) })}
                        className="h-9 text-sm font-black text-emerald-950 bg-white rounded-xl"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">
                        Payment Paid Via
                      </label>
                      <select
                        value={formData.payment_mode}
                        onChange={e => setFormData({ ...formData, payment_mode: e.target.value })}
                        className="w-full h-9 text-xs bg-white border border-slate-200 rounded-xl px-3 font-bold"
                      >
                        <option value="cash">Cash in Hand</option>
                        <option value="bank">Bank Transfer / JazzCash</option>
                        <option value="exchange">Exchange Adjustment against new phone</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <input
                      type="checkbox"
                      id="auto_inventory"
                      checked={formData.auto_create_inventory}
                      onChange={e => setFormData({ ...formData, auto_create_inventory: e.target.checked })}
                      className="rounded text-indigo-600 h-4 w-4"
                    />
                    <label htmlFor="auto_inventory" className="text-[11px] font-bold text-slate-700 cursor-pointer">
                      Auto Add to Store Inventory / POS Stock (دکان کے اسٹاک میں شامل کریں)
                    </label>
                  </div>

                  <div className="p-3 bg-amber-50/80 rounded-xl border border-amber-200 text-[11px] text-amber-900 leading-relaxed">
                    <div className="font-black text-[10px] uppercase text-amber-800 flex items-center gap-1 mb-0.5">
                      <ShieldCheck size={13}/>
                      <span>Legal Compliance Notice:</span>
                    </div>
                    Seller declares under oath that this mobile phone is their lawful personal property and free from any theft or CPLC blacklisting.
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-5 border-t border-slate-100 mt-5">
                <Button
                  variant="outline"
                  onClick={() => setIsModalOpen(false)}
                  disabled={isSubmitting}
                  className="rounded-xl h-9 text-xs font-bold"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSavePurchase}
                  disabled={isSubmitting}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl h-9 text-xs font-bold shadow-xs"
                >
                  {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-1.5"/> : <Save className="h-4 w-4 mr-1.5"/>}
                  Save &amp; Generate Affidavit PDF
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
