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
      // 1. Fetch Invoice with Party details
      const { data: invoiceData, error: invoiceError } = await supabase
        .from("invoices")
        .select(`
          *,
          party:parties(id, name, phone, address, current_balance, cnic_number)
        `)
        .eq("id", id)
        .maybeSingle();

      if (invoiceError) throw invoiceError;
      if (!invoiceData) {
        setError("Invoice not found. Please check the URL or QR code.");
        setLoading(false);
        return;
      }

      // 2. Fetch Invoice Items with complete variant, batch and IMEI details
      const { data: itemsData, error: itemsError } = await supabase
        .from("invoice_items")
        .select(`
          id,
          product_id,
          custom_name,
          quantity,
          unit_price,
          subtotal,
          packing_name,
          warranty,
          sold_imeis,
          batch_number,
          expiry_date,
          shelf_location,
          products (
            name,
            code,
            note,
            translated_names
          )
        `)
        .eq("invoice_id", id);

      if (itemsError) throw itemsError;

      // Map invoice items to the format expected by ReceiptTemplate
      const formattedItems = (itemsData || []).map((item: any) => ({
        name: item.products?.name || item.custom_name || "Item",
        quantity: Number(item.quantity),
        price: Number(item.unit_price),
        subtotal: item.subtotal !== undefined && item.subtotal !== null ? Number(item.subtotal) : undefined,
        packingName: item.packing_name || undefined,
        code: item.products?.code || undefined,
        sold_imeis: item.sold_imeis || undefined,
        warranty: item.warranty || undefined,
        batchNumber: item.batch_number || undefined,
        expiryDate: item.expiry_date || undefined,
        shelfLocation: item.shelf_location || undefined,
        note: item.products?.note || undefined,
        translated_names: item.products?.translated_names || undefined
      }));

      // 2b. Fetch EMI schedules if payment_mode is emi or exists
      let emiSchedules: any[] = [];
      const { data: emiData } = await supabase
        .from("emi_schedules")
        .select("*")
        .eq("invoice_id", id)
        .order("due_date", { ascending: true });
      if (emiData && emiData.length > 0) {
        emiSchedules = emiData;
      }

      const partyObj = (invoiceData as any).party;
      const fullInvoice = {
        ...invoiceData,
        customer_name: invoiceData.customer_name || partyObj?.name || "Walk-in Customer",
        customer_phone: invoiceData.customer_phone || partyObj?.phone || "",
        customer_address: partyObj?.address || "",
        customer_balance: partyObj?.current_balance !== undefined ? Number(partyObj.current_balance) : undefined,
        paid_amount: Number(invoiceData.paid_amount ?? invoiceData.received_amount ?? 0),
        received_amount: Number(invoiceData.received_amount ?? invoiceData.paid_amount ?? 0),
        items: formattedItems,
        emiSchedules: emiSchedules.length > 0 ? emiSchedules.map((s: any, idx: number) => ({
          installmentNum: s.installment_number || idx + 1,
          dueDate: s.due_date,
          amount: Number(s.installment_amount),
          paidAmount: Number(s.amount_paid || 0),
          status: s.status
        })) : null
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
        setShopDetails({ name: "The Accounts Store" });
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

  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  const handlePrint = () => {
    window.print();
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleDownloadPdf = async () => {
    if (!invoice) return;
    setDownloadingPdf(true);
    try {
      const { default: jsPDF } = await import("jspdf");
      const { default: autoTable } = await import("jspdf-autotable");
      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

      const sName = shopDetails?.name || "The Accounts Store";
      const sPhone = shopDetails?.phone || "";
      const sAddress = shopDetails?.address || "";
      const invNum = (invoice.id || "").slice(0, 8).toUpperCase() || "RECEIPT";
      const invDate = invoice.created_at
        ? new Date(invoice.created_at).toLocaleDateString("en-PK")
        : new Date().toLocaleDateString("en-PK");
      const cName = invoice.customer_name || "Walk-in Customer";
      const cPhone = invoice.customer_phone || "—";

      // Header
      doc.setFillColor(15, 23, 42);
      doc.rect(0, 0, 210, 36, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(16);
      doc.setFont("helvetica", "bold");
      doc.text(sName, 14, 15);

      doc.setFontSize(8.5);
      doc.setFont("helvetica", "normal");
      doc.text(`${sAddress} ${sPhone ? `| Phone: ${sPhone}` : ""}`, 14, 23);
      doc.text("OFFICIAL INVOICE", 196, 15, { align: "right" });
      doc.text(`Invoice #${invNum}  |  Date: ${invDate}`, 196, 23, { align: "right" });

      // Customer Info
      doc.setTextColor(30, 41, 59);
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.text("Billed To:", 14, 46);
      doc.setFont("helvetica", "normal");
      doc.text(`Name: ${cName}`, 14, 52);
      doc.text(`Phone: ${cPhone}`, 14, 57);
      if (invoice.customer_address) doc.text(`Address: ${invoice.customer_address}`, 14, 62);

      // Payment Info
      doc.setFont("helvetica", "bold");
      doc.text("Payment Status:", 130, 46);
      doc.setFont("helvetica", "normal");
      doc.text(`Mode: ${(invoice.payment_mode || "CASH").toUpperCase()}`, 130, 52);
      doc.text(`Status: ${(invoice.status || "PAID").toUpperCase()}`, 130, 57);

      // Items Table
      const tableData = (invoice.items || []).map((it: any, idx: number) => [
        idx + 1,
        it.name +
          (it.packingName ? ` (${it.packingName})` : "") +
          (it.sold_imeis ? `\nIMEI: ${it.sold_imeis}` : "") +
          (it.batchNumber ? `\nBatch: ${it.batchNumber}` : ""),
        Number(it.quantity) || 1,
        `Rs ${(Number(it.price) || 0).toLocaleString()}`,
        `Rs ${(Number(it.subtotal !== undefined ? it.subtotal : it.price * it.quantity) || 0).toLocaleString()}`,
      ]);

      const startY = invoice.customer_address ? 68 : 64;
      autoTable(doc, {
        head: [["#", "Item Description", "Qty", "Unit Price", "Total"]],
        body: tableData,
        startY: startY,
        headStyles: { fillColor: [30, 41, 59], textColor: 255, fontStyle: "bold" },
        theme: "striped",
        styles: { fontSize: 8.5 },
      });

      // Totals
      const finalY = (doc as any).lastAutoTable.finalY + 8;
      const subtotal = Number(invoice.total_amount) || 0;
      const discount = Number(invoice.discount) || 0;
      const paid = Number(invoice.paid_amount ?? invoice.total_amount) || 0;
      const netTotal = Math.max(0, subtotal - discount);
      const balance = Math.max(0, netTotal - paid);

      doc.setFont("helvetica", "bold");
      doc.text(`Subtotal: Rs ${subtotal.toLocaleString()}`, 196, finalY, { align: "right" });
      if (discount > 0)
        doc.text(`Discount: -Rs ${discount.toLocaleString()}`, 196, finalY + 6, { align: "right" });
      doc.setFontSize(11);
      doc.setTextColor(16, 185, 129);
      doc.text(
        `Net Total: Rs ${netTotal.toLocaleString()}`,
        196,
        finalY + (discount > 0 ? 13 : 7),
        { align: "right" }
      );
      doc.setFontSize(9.5);
      doc.setTextColor(30, 41, 59);
      doc.text(
        `Paid Amount: Rs ${paid.toLocaleString()}`,
        196,
        finalY + (discount > 0 ? 19 : 13),
        { align: "right" }
      );
      if (balance > 0) {
        doc.setTextColor(220, 38, 38);
        doc.text(
          `Remaining Due: Rs ${balance.toLocaleString()}`,
          196,
          finalY + (discount > 0 ? 25 : 19),
          { align: "right" }
        );
      }

      // Footer
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184);
      doc.text("Thank you for your business! | Powered by The Accounts ERP", 105, 285, {
        align: "center",
      });

      doc.save(`Invoice_${invNum}.pdf`);
    } catch (err: any) {
      console.error(err);
      window.print();
    } finally {
      setDownloadingPdf(false);
    }
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
    <div className="min-h-screen bg-slate-950 py-6 sm:py-10 px-3 sm:px-4 flex flex-col items-center justify-start space-y-5">
      
      {/* Top Banner Message */}
      <div className="w-full max-w-md bg-emerald-500/10 border border-emerald-500/20 px-4 py-3 rounded-2xl flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <CheckCircle2 className="text-emerald-500 shrink-0" size={18} />
          <div>
            <h4 className="font-extrabold text-emerald-400 text-xs">Verified Digital Invoice (تصدیق شدہ بل)</h4>
            <p className="text-[10.5px] text-slate-400 leading-snug">Invoice #{invoice.id?.slice(0, 8).toUpperCase()}</p>
          </div>
        </div>
        <button
          onClick={handleCopyLink}
          className="text-[11px] font-bold text-emerald-400 bg-emerald-500/20 hover:bg-emerald-500/30 px-2.5 py-1.5 rounded-xl transition-all cursor-pointer shrink-0"
        >
          {copiedLink ? "Copied! ✓" : "Copy Link"}
        </button>
      </div>

      {/* Floating Receipt Sheet */}
      <div className="bg-white rounded-2xl shadow-2xl overflow-hidden border border-slate-200/50 print:border-none print:shadow-none animate-in fade-in zoom-in-95 duration-300 w-full max-w-md flex justify-center">
        <ReceiptTemplate 
          settings={receiptSettings} 
          invoice={invoice} 
          shopDetails={shopDetails} 
        />
      </div>

      {/* Control Buttons */}
      <div className="flex flex-col gap-2.5 w-full max-w-md print:hidden">
        <Button 
          onClick={handleDownloadPdf}
          disabled={downloadingPdf}
          className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-black h-12 rounded-2xl text-sm shadow-xl shadow-emerald-950/40 cursor-pointer flex items-center justify-center gap-2"
        >
          {downloadingPdf ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Download className="w-4 h-4" />
          )}
          <span>Download PDF Bill (پی ڈی ایف بل ڈاؤن لوڈ کریں)</span>
        </Button>

        <div className="flex gap-2.5">
          <Button 
            onClick={handlePrint}
            className="flex-1 bg-slate-900 hover:bg-slate-800 text-white font-bold h-11 rounded-2xl text-xs border border-slate-800 cursor-pointer flex items-center justify-center gap-1.5"
          >
            <Printer size={14} /> Print Bill (پرنٹ کریں)
          </Button>
          <Button 
            onClick={() => window.location.reload()}
            variant="outline"
            className="flex-1 bg-transparent border-slate-800 hover:bg-slate-900 text-slate-300 hover:text-white font-bold h-11 rounded-2xl text-xs cursor-pointer"
          >
            Refresh Data
          </Button>
        </div>
      </div>

      {/* Brand Footer */}
      <div className="text-center text-[10.5px] text-slate-500 print:hidden pt-2">
        <p>This invoice is encrypted and hosted securely by <span className="font-bold text-slate-400">The Accounts ERP</span>.</p>
        <p className="mt-0.5 font-medium text-slate-600">© 2026 The Accounts. All rights reserved.</p>
      </div>

    </div>
  );
}
