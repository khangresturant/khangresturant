"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Smartphone, Search, CheckCircle2, AlertTriangle, ShieldCheck, 
  Calendar, User, Phone, FileText, Wrench, Package, ArrowRight,
  Clock, Sparkles, Loader2, DollarSign, Building2, Eye
} from "lucide-react";
import { useShop } from "@/context/ShopContext";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function ImeiTrackerPage() {
  const { shopId } = useShop();
  const supabase = createClient();

  const [imeiQuery, setImeiQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<{
    imeiRecord: any | null;
    invoiceItem: any | null;
    invoice: any | null;
    usedMobileRecord: any | null;
    repairHistory: any[];
  } | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanQuery = imeiQuery.trim();
    if (!cleanQuery) {
      toast.error("Please enter an IMEI number or Serial to search.");
      return;
    }

    setSearching(true);
    setHasSearched(true);
    try {
      // 1. Search in product_imeis (Inventory & Catalog tracking)
      const { data: imeiData, error: imeiErr } = await supabase
        .from("product_imeis")
        .select(`
          id, imei1, imei2, status, created_at, sold_at,
          product_id,
          products ( id, name, sale_price_single, purchase_price, category_id, sku )
        `)
        .or(`imei1.ilike.%${cleanQuery}%,imei2.ilike.%${cleanQuery}%`)
        .limit(1)
        .maybeSingle();

      // 2. Search in invoice_items (Sales record)
      const { data: invItems, error: invErr } = await supabase
        .from("invoice_items")
        .select(`
          id, invoice_id, product_id, custom_name, quantity, unit_price, subtotal, warranty, sold_imeis, created_at,
          invoices (
            id, total_amount, paid_amount, payment_mode, created_at,
            parties ( id, name, phone, cnic_number )
          ),
          products ( name )
        `)
        .ilike("sold_imeis", `%${cleanQuery}%`)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      // 3. Search in used_mobile_purchases (Buyback ledger)
      const { data: usedData, error: usedErr } = await supabase
        .from("used_mobile_purchases")
        .select("*")
        .or(`imei1.ilike.%${cleanQuery}%,imei2.ilike.%${cleanQuery}%`)
        .limit(1)
        .maybeSingle();

      // 4. Search in repair_tickets
      const { data: repairData, error: repErr } = await supabase
        .from("repair_tickets")
        .select(`
          id, customer_name, customer_phone, device_model, imei_number, issue_description,
          estimated_cost, status, created_at,
          parties ( name, phone )
        `)
        .ilike("imei_number", `%${cleanQuery}%`)
        .order("created_at", { ascending: false });

      setResults({
        imeiRecord: imeiData || null,
        invoiceItem: invItems || null,
        invoice: invItems?.invoices || null,
        usedMobileRecord: usedData || null,
        repairHistory: repairData || []
      });

      if (!imeiData && !invItems && !usedData && (!repairData || repairData.length === 0)) {
        toast.info("No records found for this IMEI / Serial number.");
      } else {
        toast.success("IMEI lifecycle history retrieved!");
      }
    } catch (err: any) {
      toast.error("Search failed: " + err.message);
    } finally {
      setSearching(false);
    }
  };

  const getWarrantyInfo = (saleDateStr?: string, warrantyText?: string) => {
    if (!saleDateStr || !warrantyText) return null;
    const saleDate = new Date(saleDateStr);
    let months = 0;
    const lower = warrantyText.toLowerCase();
    if (lower.includes("1 year") || lower.includes("12 month")) months = 12;
    else if (lower.includes("6 month")) months = 6;
    else if (lower.includes("3 month")) months = 3;
    else if (lower.includes("1 month")) months = 1;
    else if (lower.includes("2 year")) months = 24;

    if (months === 0) return { text: warrantyText, isValid: true, daysLeft: null };

    const expiryDate = new Date(saleDate);
    expiryDate.setMonth(expiryDate.getMonth() + months);
    const now = new Date();
    const isExpired = now > expiryDate;
    const daysLeft = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    return {
      text: warrantyText,
      expiryDate: expiryDate.toLocaleDateString(),
      isExpired,
      daysLeft: isExpired ? 0 : daysLeft
    };
  };

  return (
    <div className="space-y-6 font-sans pb-12 animate-in fade-in duration-500">
      
      {/* Header */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
            <Smartphone className="text-indigo-600 h-6 w-6" />
            <span>IMEI &amp; Serial Number Lifecycle Tracker</span>
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Track phone procurement, sales history, customer warranty days, trade-in records, and repair logs
          </p>
        </div>
      </div>

      {/* Search Box */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm max-w-3xl mx-auto">
        <form onSubmit={handleSearch} className="space-y-3">
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
            Enter 15-Digit IMEI 1, IMEI 2, or Serial Number
          </label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 h-4 w-4" />
              <Input
                type="text"
                value={imeiQuery}
                onChange={e => setImeiQuery(e.target.value)}
                placeholder="e.g. 352948091823719"
                className="pl-10 font-mono font-bold text-base h-12 bg-slate-50/50 border-slate-200 rounded-xl focus:bg-white"
                autoFocus
              />
            </div>
            <Button
              type="submit"
              disabled={searching}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold h-12 px-6 rounded-xl shadow-md flex items-center gap-2"
            >
              {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search size={16} />}
              <span>Track IMEI</span>
            </Button>
          </div>
          <p className="text-[11px] text-slate-400">
            * Supports continuous barcode/QR scanner input. Press Enter to search instantly.
          </p>
        </form>
      </div>

      {/* Search Results Display */}
      {searching ? (
        <div className="text-center py-16 text-slate-400">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-indigo-600 mb-2" />
          <p className="text-sm font-semibold">Querying inventory catalog, sales ledger, and repair logs...</p>
        </div>
      ) : hasSearched && results ? (
        <div className="max-w-4xl mx-auto space-y-6">
          
          {/* Main Status Banner */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                <Smartphone size={24} />
              </div>
              <div>
                <h3 className="font-extrabold text-lg text-slate-900">
                  {results.imeiRecord?.products?.name || results.invoiceItem?.products?.name || results.invoiceItem?.custom_name || results.usedMobileRecord?.brand_model || results.repairHistory[0]?.device_model || "Tracked Device"}
                </h3>
                <div className="flex flex-wrap items-center gap-2 mt-1 text-xs font-mono text-slate-500">
                  <span>IMEI: {results.imeiRecord?.imei1 || results.usedMobileRecord?.imei1 || imeiQuery}</span>
                  {(results.imeiRecord?.imei2 || results.usedMobileRecord?.imei2) && (
                    <>
                      <span>·</span>
                      <span>IMEI 2: {results.imeiRecord?.imei2 || results.usedMobileRecord?.imei2}</span>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Current Stock Status Badge */}
            <div>
              {results.invoiceItem ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                  <CheckCircle2 size={13} />
                  <span>Sold to Customer</span>
                </span>
              ) : results.imeiRecord?.status === "available" ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-800 border border-blue-200">
                  <Package size={13} />
                  <span>In Stock (Available)</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200">
                  <span>Tracked Record</span>
                </span>
              )}
            </div>
          </div>

          {/* Lifecycle Timeline Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            
            {/* 1. Procurement / Purchase Origin */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
              <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-slate-700 border-b border-slate-100 pb-2">
                <Building2 size={15} className="text-slate-400" />
                <span>1. Procurement Origin</span>
              </div>
              <div className="space-y-2 text-xs">
                {results.usedMobileRecord ? (
                  <>
                    <div className="text-[10px] text-amber-700 font-bold bg-amber-50 px-2 py-0.5 rounded border border-amber-200 inline-block">
                      Bought via Customer Exchange / Buyback
                    </div>
                    <div>
                      <span className="text-slate-400 block">Seller Name:</span>
                      <span className="font-bold text-slate-800">{results.usedMobileRecord.seller_name}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block">Seller CNIC:</span>
                      <span className="font-mono text-slate-700">{results.usedMobileRecord.seller_cnic}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block">Purchase Cost:</span>
                      <span className="font-bold text-slate-900">Rs {Number(results.usedMobileRecord.purchase_price).toLocaleString()}</span>
                    </div>
                  </>
                ) : results.imeiRecord ? (
                  <>
                    <div>
                      <span className="text-slate-400 block">Stock In Date:</span>
                      <span className="font-bold text-slate-800">{new Date(results.imeiRecord.created_at).toLocaleDateString()}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block">Catalog Cost:</span>
                      <span className="font-bold text-slate-900">
                        {results.imeiRecord.products?.purchase_price ? `Rs ${Number(results.imeiRecord.products.purchase_price).toLocaleString()}` : "Standard Stock"}
                      </span>
                    </div>
                  </>
                ) : (
                  <p className="text-slate-400 italic">No purchase or stock-in entry found.</p>
                )}
              </div>
            </div>

            {/* 2. Customer Sale & Invoice Details */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
              <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-slate-700 border-b border-slate-100 pb-2">
                <FileText size={15} className="text-emerald-600" />
                <span>2. Sale &amp; Customer</span>
              </div>
              <div className="space-y-2 text-xs">
                {results.invoiceItem && results.invoice ? (
                  <>
                    <div>
                      <span className="text-slate-400 block">Customer Name:</span>
                      <span className="font-bold text-slate-900">{results.invoice.parties?.name || "Walk-in Customer"}</span>
                    </div>
                    {results.invoice.parties?.phone && (
                      <div>
                        <span className="text-slate-400 block">Phone:</span>
                        <span className="font-mono text-slate-700">{results.invoice.parties.phone}</span>
                      </div>
                    )}
                    <div>
                      <span className="text-slate-400 block">Sold Date:</span>
                      <span className="font-bold text-slate-800">{new Date(results.invoice.created_at).toLocaleDateString()}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block">Sold Price:</span>
                      <span className="font-extrabold text-emerald-700">Rs {Number(results.invoiceItem.unit_price).toLocaleString()}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block">Invoice Ref:</span>
                      <span className="font-mono text-slate-600 font-bold">#{results.invoice.id.slice(0, 8).toUpperCase()}</span>
                    </div>
                  </>
                ) : (
                  <p className="text-slate-400 italic">Device has not been sold yet (Available in stock).</p>
                )}
              </div>
            </div>

            {/* 3. Warranty Status */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
              <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-slate-700 border-b border-slate-100 pb-2">
                <ShieldCheck size={15} className="text-blue-600" />
                <span>3. Warranty Status</span>
              </div>
              <div className="space-y-2 text-xs">
                {(() => {
                  const wInfo = getWarrantyInfo(results.invoice?.created_at, results.invoiceItem?.warranty);
                  if (!wInfo) {
                    return <p className="text-slate-400 italic">No warranty term assigned on invoice.</p>;
                  }

                  return (
                    <>
                      <div>
                        <span className="text-slate-400 block">Warranty Period:</span>
                        <span className="font-bold text-slate-900">{wInfo.text}</span>
                      </div>
                      {wInfo.expiryDate && (
                        <div>
                          <span className="text-slate-400 block">Expires On:</span>
                          <span className="font-bold text-slate-800">{wInfo.expiryDate}</span>
                        </div>
                      )}
                      <div className="pt-1">
                        {wInfo.isExpired ? (
                          <div className="p-2 rounded-xl bg-red-50 text-red-700 font-bold border border-red-200 text-center">
                            ❌ Warranty Expired
                          </div>
                        ) : (
                          <div className="p-2 rounded-xl bg-emerald-50 text-emerald-800 font-bold border border-emerald-200 text-center">
                            ✅ Active ({wInfo.daysLeft} days remaining)
                          </div>
                        )}
                      </div>
                    </>
                  );
                })()}
              </div>
            </div>

          </div>

          {/* Repair Jobs History */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h4 className="font-extrabold text-sm text-slate-900 flex items-center gap-2">
                <Wrench size={16} className="text-amber-500" />
                <span>Repair &amp; Service Desk History</span>
              </h4>
              <span className="text-xs font-bold text-slate-500">
                {results.repairHistory.length} ticket(s) found
              </span>
            </div>

            {results.repairHistory.length === 0 ? (
              <p className="text-xs text-slate-400 italic py-2">
                No past repair jobs recorded for this device.
              </p>
            ) : (
              <div className="divide-y divide-slate-100 text-xs">
                {results.repairHistory.map((rep) => (
                  <div key={rep.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <div className="font-bold text-slate-900 flex items-center gap-2">
                        <span className="font-mono text-indigo-600">#{rep.id.slice(0, 8).toUpperCase()}</span>
                        <span>·</span>
                        <span>{rep.issue_description || "Service"}</span>
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        Customer: {rep.customer_name || rep.parties?.name || "Walk-in"} | Date: {new Date(rep.created_at).toLocaleDateString()}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-bold text-slate-800">Rs {Number(rep.estimated_cost).toLocaleString()}</span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        rep.status === "delivered" ? "bg-slate-100 text-slate-700" :
                        rep.status === "ready" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
                      }`}>
                        {rep.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      ) : null}

    </div>
  );
}
