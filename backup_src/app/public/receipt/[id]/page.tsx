"use client";

import React, { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Loader2, Download, Printer, CheckCircle2 } from "lucide-react";
import { ReceiptTemplate, DEFAULT_RECEIPT_SETTINGS } from "@/components/ReceiptTemplate";
import { Button } from "@/components/ui/button";

export default function PublicReceiptPage() {
  const { id } = useParams();
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [invoice, setInvoice] = useState<any>(null);
  const [shopDetails, setShopDetails] = useState<any>(null);
  const [receiptSettings, setReceiptSettings] = useState<any>(DEFAULT_RECEIPT_SETTINGS);

  useEffect(() => {
    if (id) {
      fetchPublicInvoice();
    }
  }, [id]);

  const fetchPublicInvoice = async () => {
    setLoading(true);
    setError(null);
    try {
      // 1. Fetch Invoice
      const { data: invoiceData, error: invoiceError } = await supabase
        .from("invoices")
        .select("*")
        .eq("id", id)
        .maybeSingle();

      if (invoiceError) throw invoiceError;
      if (!invoiceData) {
        setError("Invoice not found. Please check the URL or QR code.");
        setLoading(false);
        return;
      }

      // 2. Fetch Invoice Items
      const { data: itemsData, error: itemsError } = await supabase
        .from("invoice_items")
        .select("*")
        .eq("invoice_id", id);

      if (itemsError) throw itemsError;

      // Map invoice items to the format expected by ReceiptTemplate
      const formattedItems = (itemsData || []).map((item: any) => ({
        name: item.product_name || "Item",
        quantity: Number(item.quantity),
        price: Number(item.unit_price),
        packingName: item.packing_name || undefined,
        code: item.product_code || undefined
      }));

      const fullInvoice = {
        ...invoiceData,
        items: formattedItems
      };

      setInvoice(fullInvoice);

      // 3. Fetch Company Details of the shop
      const shopId = invoiceData.shop_id;
      const { data: companyData } = await supabase
        .from("company_details")
        .select("name, address, phone, email, website")
        .eq("shop_id", shopId)
        .maybeSingle();

      if (companyData) {
        setShopDetails(companyData);
      } else {
        setShopDetails({ name: "Hisab X Store" });
      }

      // 4. Fetch Print Settings for customization template matching
      const { data: printData } = await supabase
        .from("print_settings")
        .select("receipt_page_size, receipt_font, receipt_font_size, receipt_design_settings")
        .eq("shop_id", shopId)
        .maybeSingle();

      if (printData) {
        const storedCustomSettings = printData.receipt_design_settings || {};
        setReceiptSettings({
          ...DEFAULT_RECEIPT_SETTINGS,
          pageSize: (printData.receipt_page_size as any) || DEFAULT_RECEIPT_SETTINGS.pageSize,
          fontFamily: printData.receipt_font || DEFAULT_RECEIPT_SETTINGS.fontFamily,
          fontSize: printData.receipt_font_size || DEFAULT_RECEIPT_SETTINGS.fontSize,
          ...storedCustomSettings
        });
      }
    } catch (err: any) {
      console.error(err);
      setError("Failed to retrieve digital invoice. Technical reason: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col justify-center items-center text-slate-400 p-4">
        <Loader2 className="h-10 w-10 animate-spin text-blue-500 mb-3" />
        <p className="font-semibold text-sm">Retrieving your secure digital invoice...</p>
      </div>
    );
  }

  if (error || !invoice) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col justify-center items-center text-center text-slate-350 p-6">
        <div className="max-w-md bg-slate-800 p-6 rounded-3xl border border-slate-700/50 space-y-4 shadow-xl">
          <h2 className="text-lg font-black text-white uppercase tracking-wider">Invalid Receipt Link</h2>
          <p className="text-xs text-slate-400 leading-relaxed">{error || "Could not load transaction receipt details."}</p>
          <div className="pt-2">
            <Button onClick={() => window.location.reload()} className="bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl px-5 text-xs">
              Retry Load
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 py-10 px-4 flex flex-col items-center justify-start space-y-6">
      
      {/* Top Banner Message */}
      <div className="w-full max-w-sm bg-emerald-500/10 border border-emerald-500/20 px-4 py-3 rounded-2xl flex items-center gap-3">
        <CheckCircle2 className="text-emerald-500 shrink-0" size={20} />
        <div>
          <h4 className="font-extrabold text-emerald-400 text-xs">Verified Digital Invoice</h4>
          <p className="text-[10px] text-slate-400 leading-snug">Secure cloud receipt for shop transaction.</p>
        </div>
      </div>

      {/* Floating Receipt Sheet */}
      <div className="bg-white rounded-2xl shadow-2xl overflow-hidden border border-slate-200/50 print:border-none print:shadow-none animate-in fade-in zoom-in-95 duration-300">
        <ReceiptTemplate 
          settings={receiptSettings} 
          invoice={invoice} 
          shopDetails={shopDetails} 
        />
      </div>

      {/* Control Buttons */}
      <div className="flex gap-3 w-full max-w-sm print:hidden">
        <Button 
          onClick={handlePrint}
          className="flex-1 bg-slate-900 hover:bg-slate-850 text-white font-bold h-11 rounded-2xl text-xs border border-slate-800"
        >
          <Printer size={14} className="mr-2" /> Print / Save PDF
        </Button>
        <Button 
          onClick={() => window.location.reload()}
          variant="outline"
          className="flex-1 bg-transparent border-slate-700 hover:bg-slate-900/50 text-slate-300 hover:text-white font-bold h-11 rounded-2xl text-xs"
        >
          Refresh Data
        </Button>
      </div>

      {/* Brand Footer */}
      <div className="text-center text-[10px] text-slate-500 print:hidden pt-4">
        <p>This invoice is encrypted and hosted securely by Hisab X ERP.</p>
        <p className="mt-1 font-semibold text-slate-600">© 2026 Hisab X. All rights reserved.</p>
      </div>

    </div>
  );
}
