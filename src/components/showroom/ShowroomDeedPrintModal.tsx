"use client";

import React, { useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Printer,
  Share2,
  FileText,
  Car,
  CheckCircle2,
  Calendar,
  Phone,
  User,
  ShieldCheck,
  Building,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useShop } from "@/context/ShopContext";
import type { ShowroomVehicle, ShowroomInstallment, ShowroomInstallmentSchedule, ShowroomParty } from "@/lib/showroom-ops";
import { formatPKR } from "@/lib/showroom-ops";

interface DeedPrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  shopName?: string;
  shopAddress?: string;
  shopPhone?: string;
  vehicle: ShowroomVehicle;
  buyer?: ShowroomParty | Partial<ShowroomParty> | null;
  seller?: ShowroomParty | Partial<ShowroomParty> | null;
  installment?: ShowroomInstallment | null;
  schedules?: ShowroomInstallmentSchedule[];
  saleType: "cash" | "installment";
  salePrice: number;
  downPayment?: number;
  saleDate?: string;
  billNo?: string | null;
  manualBookNo?: string | null;
  manualReceiptNo?: string | null;
  witnessName?: string | null;
  witnessPhone?: string | null;
  witnessCnic?: string | null;
}

export function ShowroomDeedPrintModal({
  isOpen,
  onClose,
  shopName,
  shopAddress,
  shopPhone,
  vehicle,
  buyer,
  seller,
  installment,
  schedules = [],
  saleType,
  salePrice,
  downPayment = 0,
  saleDate = new Date().toISOString().split("T")[0],
  billNo,
  manualBookNo,
  manualReceiptNo,
  witnessName,
  witnessPhone,
  witnessCnic,
}: DeedPrintModalProps) {
  const { shopPhone: ctxPhone, shopAddress: ctxAddress, shopName: ctxShopName } = useShop();
  const [printSize, setPrintSize] = useState<"a4" | "a5" | "80mm">("a4");

  const effectiveShopName = shopName || ctxShopName || "Showroom";
  const effectiveShopPhone = (shopPhone && shopPhone !== "0300-0000000") ? shopPhone : (ctxPhone || "");
  const effectiveShopAddress = (shopAddress && shopAddress !== "Main Showroom Market, Lahore") ? shopAddress : (ctxAddress || "");

  if (!isOpen) return null;

  const displayBillNo = billNo || vehicle.bill_no || null;
  const displayBookNo = manualBookNo || installment?.manual_book_no || vehicle.manual_book_no || null;
  const displayReceiptNo = manualReceiptNo || installment?.manual_file_no || vehicle.manual_receipt_no || null;
  const displayWitnessName = witnessName || vehicle.witness_name || installment?.witness_1_name || null;
  const displayWitnessPhone = witnessPhone || vehicle.witness_phone || installment?.witness_1_phone || null;
  const displayWitnessCnic = witnessCnic || vehicle.witness_cnic || installment?.witness_1_cnic || null;

  const agreementNo = displayBillNo || installment?.agreement_number || `DEED-${vehicle.id?.slice(0, 6)?.toUpperCase() || "001"}`;
  const buyerName = buyer?.name || installment?.customer_name || vehicle.buyer_name || "—";
  const buyerFather = buyer?.father_name || installment?.customer_father_name || "—";
  const buyerCaste = buyer?.caste || installment?.customer_caste || "—";
  const buyerCnic = buyer?.cnic || installment?.customer_cnic || "—";
  const buyerPhone = buyer?.phone || installment?.customer_phone || vehicle.buyer_phone || "—";
  const buyerAddress = buyer?.address || installment?.customer_address || "—";

  const sellerName = seller?.name || effectiveShopName;
  const sellerFather = seller?.father_name || "—";
  const sellerCnic = seller?.cnic || "—";
  const sellerPhone = seller?.phone || effectiveShopPhone || "—";
  const sellerAddress = seller?.address || effectiveShopAddress || "—";

  const remainingAmount = Math.max(0, salePrice - downPayment);

  const handlePrint = () => {
    const printArea = document.getElementById("deed-printable-sheet");
    if (!printArea) {
      window.print();
      return;
    }

    const printFrame = document.createElement("iframe");
    printFrame.style.position = "fixed";
    printFrame.style.right = "0";
    printFrame.style.bottom = "0";
    printFrame.style.width = "0";
    printFrame.style.height = "0";
    printFrame.style.border = "0";
    document.body.appendChild(printFrame);

    const frameDoc = printFrame.contentWindow?.document || printFrame.contentDocument;
    if (!frameDoc) {
      window.print();
      return;
    }

    const htmlContent = printArea.innerHTML;

    frameDoc.open();
    frameDoc.write(`
      <!DOCTYPE html>
      <html lang="ur" dir="ltr">
      <head>
        <title>${effectiveShopName} — Vehicle Deed (${agreementNo})</title>
        <meta charset="utf-8" />
        <link rel="preconnect" href="https://fonts.googleapis.com">
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
        <link href="https://fonts.googleapis.com/css2?family=Noto+Nastaliq+Urdu:wght@400;600;700;900&family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
        <style>
          @font-face {
            font-family: 'Jameel Noori Nastaleeq';
            src: local('Jameel Noori Nastaleeq'),
                 local('JameelNooriNastaliq'),
                 local('Jameel Noori'),
                 url('https://cdn.jsdelivr.net/npm/jameel-noori/fonts/jameel-noori-nastaleeq4.woff2') format('woff2');
            font-weight: normal;
            font-style: normal;
          }
          @import url('https://fonts.googleapis.com/css2?family=Noto+Nastaliq+Urdu:wght@400;600;700;900&family=Inter:wght@400;500;600;700;800;900&display=swap');

          * { box-sizing: border-box; margin: 0; padding: 0; }
          body {
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            background: #ffffff;
            color: #0f172a;
            padding: ${printSize === "a4" ? "10mm" : printSize === "a5" ? "6mm" : "3mm"};
            font-size: ${printSize === "a4" ? "12px" : printSize === "a5" ? "11px" : "10px"};
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          @page {
            size: ${printSize === "a4" ? "A4 portrait" : printSize === "a5" ? "A5 portrait" : "80mm auto"};
            margin: 5mm;
          }
          .font-urdu, [dir="rtl"], .urdu, h2, h3, h4, th, td, ol, p, div {
            font-family: 'Jameel Noori Nastaleeq', 'Noto Nastaliq Urdu', 'Urdu Typesetting', 'Inter', serif;
          }
          .font-urdu, [dir="rtl"], .urdu {
            font-family: 'Jameel Noori Nastaleeq', 'Noto Nastaliq Urdu', 'Urdu Typesetting', serif !important;
            direction: rtl;
            line-height: 1.8;
          }
          .border-b-2 { border-bottom: 2px solid #0f172a; }
          .border-t-2 { border-top: 2px solid #0f172a; }
          .border { border: 1px solid #cbd5e1; }
          .border-b { border-bottom: 1px solid #cbd5e1; }
          .border-t { border-top: 1px solid #cbd5e1; }
          .border-r { border-right: 1px solid #cbd5e1; }
          .rounded-xl { border-radius: 8px; }
          .rounded-lg { border-radius: 6px; }
          .rounded-full { border-radius: 9999px; }
          .p-1 { padding: 4px; }
          .p-2 { padding: 8px; }
          .p-3 { padding: 12px; }
          .p-4 { padding: 16px; }
          .my-2 { margin-top: 8px; margin-bottom: 8px; }
          .my-3 { margin-top: 12px; margin-bottom: 12px; }
          .my-4 { margin-top: 16px; margin-bottom: 16px; }
          .mt-1 { margin-top: 4px; }
          .mt-2 { margin-top: 8px; }
          .mt-3 { margin-top: 12px; }
          .mt-6 { margin-top: 24px; }
          .mt-8 { margin-top: 32px; }
          .mb-1 { margin-bottom: 4px; }
          .mb-2 { margin-bottom: 8px; }
          .pb-1 { padding-bottom: 4px; }
          .pb-2 { padding-bottom: 8px; }
          .pb-4 { padding-bottom: 16px; }
          .pt-2 { padding-top: 8px; }
          .pt-4 { padding-top: 16px; }
          .text-center { text-align: center; }
          .text-right { text-align: right; }
          .text-left { text-align: left; }
          .font-bold { font-weight: bold; }
          .font-black { font-weight: 900; }
          .font-semibold { font-weight: 600; }
          .font-mono { font-family: ui-monospace, monospace; }
          .uppercase { text-transform: uppercase; }
          .bg-slate-50 { background-color: #f8fafc; }
          .bg-slate-100 { background-color: #f1f5f9; }
          .bg-slate-900 { background-color: #0f172a; color: #ffffff !important; }
          .bg-violet-50 { background-color: #f5f3ff; }
          .bg-white { background-color: #ffffff; }
          .text-slate-500 { color: #64748b; }
          .text-slate-600 { color: #475569; }
          .text-slate-700 { color: #334155; }
          .text-slate-800 { color: #1e293b; }
          .text-slate-900 { color: #0f172a; }
          .text-slate-950 { color: #020617; }
          .text-violet-700 { color: #6d28d9; }
          .text-emerald-700 { color: #047857; }
          .text-rose-700 { color: #be123c; }
          .grid { display: flex; gap: 12px; }
          .grid-2 > div { flex: 1; }
          .grid-4 > div { flex: 1; }
          table { width: 100%; border-collapse: collapse; }
          th, td { border: 1px solid #cbd5e1; padding: 5px 8px; }
          th { background-color: #f1f5f9; font-weight: bold; }
          ol { padding-right: 18px; line-height: 1.8; }
        </style>
      </head>
      <body>
        ${htmlContent}
      </body>
      </html>
    `);
    frameDoc.close();

    const doPrint = () => {
      try {
        printFrame.contentWindow?.focus();
        printFrame.contentWindow?.print();
      } catch (e) {
        console.error("Print error:", e);
      } finally {
        setTimeout(() => {
          if (document.body.contains(printFrame)) {
            document.body.removeChild(printFrame);
          }
        }, 3000);
      }
    };

    if (frameDoc.fonts) {
      frameDoc.fonts.ready.then(() => {
        setTimeout(doPrint, 350);
      });
    } else {
      setTimeout(doPrint, 800);
    }
  };

  const handleWhatsApp = () => {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const agreementLink = installment?.id
      ? `${origin}/dashboard/showroom/installments/agreement/${installment.id}`
      : `${origin}/dashboard/showroom/sales`;

    const text =
      `*${effectiveShopName} — Vehicle Sale & Agreement Deed*\n` +
      (effectiveShopAddress ? `*پتہ:* ${effectiveShopAddress}\n` : "") +
      (effectiveShopPhone ? `*رابطہ:* ${effectiveShopPhone}\n` : "") +
      `--------------------------------\n` +
      `*Deed No:* ${agreementNo}\n` +
      (displayBookNo ? `*کھاتہ #:* #${displayBookNo}\n` : "") +
      (displayReceiptNo ? `*رسید #:* #${displayReceiptNo}\n` : "") +
      `*Vehicle:* ${vehicle.make} ${vehicle.model} (${vehicle.year || "—"})\n` +
      `*Reg / Plate:* ${vehicle.is_applied_for ? "Applied For" : (vehicle.plate_number || "—")}\n` +
      `*Chassis No:* ${vehicle.chassis_number || "—"}\n` +
      `*Engine No:* ${vehicle.engine_number || "—"}\n` +
      `*Buyer:* ${buyerName} (CNIC: ${buyerCnic})\n` +
      `*Seller:* ${sellerName} (${sellerPhone})\n` +
      `*Sale Type:* ${saleType === "installment" ? "Installment Plan (اقساط)" : "Cash Sale (نقد)"}\n` +
      `*Total Price:* ${formatPKR(salePrice)}\n` +
      (saleType === "installment"
        ? `*Advance / Down Payment:* ${formatPKR(downPayment)}\n*Balance:* ${formatPKR(remainingAmount)}\n*Monthly Qist:* ${formatPKR(installment?.monthly_installment || 0)}\n`
        : "") +
      `*Date:* ${saleDate}\n` +
      `--------------------------------\n` +
      `📥 *معاہدہ و بل کی مکمل تفصیل (View / Download):*\n👉 ${agreementLink}\n\n` +
      `Thank you for dealing with ${effectiveShopName}!`;

    const phoneNum = (buyerPhone || "").replace(/[^0-9]/g, "");
    const cleanPhone = phoneNum.startsWith("0") ? "92" + phoneNum.slice(1) : phoneNum;
    window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(text)}`, "_blank");
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="relative w-full max-w-4xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]"
        >
          {/* Top Action Bar (hidden on print) */}
          <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 bg-slate-900 text-white border-b border-slate-800">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-violet-600/30 text-violet-300 border border-violet-500/30">
                <FileText size={20} />
              </div>
              <div>
                <h3 className="text-sm sm:text-base font-bold tracking-tight">
                  Vehicle Sales Deed & Agreement (اقرار نامہ و رسید)
                </h3>
                <p className="text-xs text-slate-400">
                  {vehicle.make} {vehicle.model} • {agreementNo}
                </p>
              </div>
            </div>

            {/* Paper Size Switcher */}
            <div className="flex items-center gap-1.5 bg-slate-800 p-1 rounded-xl border border-slate-700">
              <button
                onClick={() => setPrintSize("a4")}
                className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all ${
                  printSize === "a4" ? "bg-violet-600 text-white shadow" : "text-slate-400 hover:text-white"
                }`}
              >
                A4 Deed
              </button>
              <button
                onClick={() => setPrintSize("a5")}
                className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all ${
                  printSize === "a5" ? "bg-violet-600 text-white shadow" : "text-slate-400 hover:text-white"
                }`}
              >
                A5 Compact
              </button>
              <button
                onClick={() => setPrintSize("80mm")}
                className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all ${
                  printSize === "80mm" ? "bg-violet-600 text-white shadow" : "text-slate-400 hover:text-white"
                }`}
              >
                80mm Slip
              </button>
            </div>

            <div className="flex items-center gap-2">
              {installment?.id && (
                <Link
                  href={`/dashboard/showroom/installments/agreement/${installment.id}`}
                  target="_blank"
                  className="hidden sm:inline-flex"
                >
                  <Button
                    variant="outline"
                    size="sm"
                    className="bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700 text-xs font-bold gap-1.5 rounded-xl cursor-pointer"
                  >
                    <ExternalLink size={13} /> پورا معاہدہ (Full Agreement)
                  </Button>
                </Link>
              )}
              <Button
                onClick={handleWhatsApp}
                variant="outline"
                size="sm"
                className="bg-emerald-600 hover:bg-emerald-700 text-white border-none text-xs font-bold gap-1.5 rounded-xl cursor-pointer"
              >
                <Share2 size={14} /> WhatsApp
              </Button>
              <Button
                onClick={handlePrint}
                size="sm"
                className="bg-violet-600 hover:bg-violet-700 text-white text-xs font-bold gap-1.5 rounded-xl shadow-md cursor-pointer"
              >
                <Printer size={14} /> Print PDF / Deed
              </Button>
              <button
                onClick={onClose}
                className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Printable Document Body */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-8 bg-slate-100/60">
            {/* Document Sheet */}
            <div
              id="deed-printable-sheet"
              className={`mx-auto bg-white text-slate-900 border border-slate-300 shadow-md rounded-2xl ${
                printSize === "a4"
                  ? "max-w-[800px] p-8"
                  : printSize === "a5"
                  ? "max-w-[560px] p-6 text-xs"
                  : "max-w-[340px] p-4 text-[11px]"
              }`}
            >
              {/* Document Header */}
              <div className="border-b-2 border-slate-900 pb-4 text-center relative">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="text-left text-xs text-slate-600 font-medium">
                    <p>Deed / Bill #: <span className="font-bold text-slate-900">{agreementNo}</span></p>
                    {displayBookNo && (
                      <p>Khata #: <span className="font-bold text-amber-900">#{displayBookNo}</span></p>
                    )}
                    {displayReceiptNo && (
                      <p>Receipt #: <span className="font-bold text-slate-900">#{displayReceiptNo}</span></p>
                    )}
                    <p>Date: <span className="font-bold text-slate-900">{saleDate}</span></p>
                  </div>
                  <div className="text-center">
                    <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-950 uppercase font-serif">
                      {effectiveShopName}
                    </h1>
                    <p className="text-xs sm:text-sm font-semibold text-slate-700 mt-0.5">
                      کار و موٹر سائیکل شو روم، خرید و فروخت و آسان اقساط
                    </p>
                    {effectiveShopAddress && (
                      <p className="text-[11px] sm:text-xs font-semibold text-slate-600 mt-0.5">
                        {effectiveShopAddress}
                      </p>
                    )}
                  </div>
                  <div className="text-right text-xs text-slate-600 font-medium">
                    <p>Phone: <span className="font-bold text-slate-900">{sellerPhone || effectiveShopPhone || "—"}</span></p>
                    <p>Type: <span className="font-bold text-violet-800 uppercase">{saleType}</span></p>
                  </div>
                </div>

                <div className="mt-3 inline-block bg-slate-900 text-white px-5 py-1 rounded-full text-xs sm:text-sm font-bold tracking-wide">
                  اقرار نامہ و بیع نامہ گاڑی / موٹر سائیکل (VEHICLE SALE DEED)
                </div>
              </div>

              {/* 1. Parties Info */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 my-4 p-3 bg-slate-50 border border-slate-200 rounded-xl">
                {/* Seller Side */}
                <div className="border-r border-slate-200 pr-3">
                  <h4 className="text-xs font-black text-slate-900 uppercase border-b border-slate-300 pb-1 flex items-center justify-between">
                    <span>فریق اول (فروخت کنندہ / Seller)</span>
                    <span className="text-[10px] text-slate-500 font-normal">Party 1</span>
                  </h4>
                  <div className="mt-2 space-y-1 text-xs text-slate-800">
                    <p><span className="font-semibold text-slate-500">نام:</span> {sellerName}</p>
                    {sellerFather !== "—" && <p><span className="font-semibold text-slate-500">ولدیت:</span> {sellerFather}</p>}
                    {sellerCnic !== "—" && <p><span className="font-semibold text-slate-500">شناختی کارڈ:</span> {sellerCnic}</p>}
                    <p><span className="font-semibold text-slate-500">موبائل:</span> {sellerPhone}</p>
                    <p><span className="font-semibold text-slate-500">پتہ:</span> {sellerAddress}</p>
                  </div>
                </div>

                {/* Buyer Side */}
                <div className="pl-1">
                  <h4 className="text-xs font-black text-slate-900 uppercase border-b border-slate-300 pb-1 flex items-center justify-between">
                    <span>فریق دوم (خریدار / Buyer)</span>
                    <span className="text-[10px] text-slate-500 font-normal">Party 2</span>
                  </h4>
                  <div className="mt-2 space-y-1 text-xs text-slate-800">
                    <p><span className="font-semibold text-slate-500">نام:</span> <strong className="text-slate-950">{buyerName}</strong></p>
                    <p><span className="font-semibold text-slate-500">ولدیت:</span> {buyerFather}</p>
                    {buyerCaste !== "—" && <p><span className="font-semibold text-slate-500">قوم / برادری:</span> {buyerCaste}</p>}
                    <p><span className="font-semibold text-slate-500">شناختی کارڈ:</span> <strong className="font-mono">{buyerCnic}</strong></p>
                    <p><span className="font-semibold text-slate-500">موبائل / واٹس ایپ:</span> {buyerPhone}</p>
                    <p><span className="font-semibold text-slate-500">مکمل پتہ:</span> {buyerAddress}</p>
                  </div>
                </div>
              </div>

              {/* 2. Vehicle Specifications Table */}
              <div className="my-4">
                <h4 className="text-xs font-black text-slate-900 uppercase mb-1.5 flex items-center gap-1.5">
                  <Car size={14} className="text-violet-700" />
                  <span>گاڑی / موٹر سائیکل کی تفصیلات (VEHICLE SPECIFICATIONS)</span>
                </h4>
                <div className="overflow-hidden border border-slate-300 rounded-lg">
                  <table className="w-full text-xs text-left">
                    <tbody className="divide-y divide-slate-200">
                      <tr className="bg-slate-50">
                        <td className="p-2 font-semibold text-slate-600 w-1/4">Make & Model:</td>
                        <td className="p-2 font-bold text-slate-950 w-1/4">{vehicle.make} {vehicle.model}</td>
                        <td className="p-2 font-semibold text-slate-600 w-1/4">Model Year / سال:</td>
                        <td className="p-2 font-bold text-slate-950 w-1/4">{vehicle.year || "—"}</td>
                      </tr>
                      <tr>
                        <td className="p-2 font-semibold text-slate-600">Reg / Plate No:</td>
                        <td className="p-2 font-bold font-mono text-slate-950">
                          {vehicle.is_applied_for ? "Applied For (اپلائیڈ فار)" : (vehicle.plate_number || "—")}
                        </td>
                        <td className="p-2 font-semibold text-slate-600">Color / رنگ:</td>
                        <td className="p-2 font-bold text-slate-950">{vehicle.color || "—"}</td>
                      </tr>
                      <tr className="bg-slate-50">
                        <td className="p-2 font-semibold text-slate-600">Chassis No (چیسس):</td>
                        <td className="p-2 font-bold font-mono text-slate-950 tracking-wider">
                          {vehicle.chassis_number || "—"}
                        </td>
                        <td className="p-2 font-semibold text-slate-600">Engine No (انجن):</td>
                        <td className="p-2 font-bold font-mono text-slate-950 tracking-wider">
                          {vehicle.engine_number || "—"}
                        </td>
                      </tr>
                      <tr>
                        <td className="p-2 font-semibold text-slate-600">Engine CC / پاور:</td>
                        <td className="p-2 font-bold text-slate-950">{vehicle.engine_cc ? `${vehicle.engine_cc} CC` : "—"}</td>
                        <td className="p-2 font-semibold text-slate-600">Tracker Installed:</td>
                        <td className="p-2 font-bold text-slate-950">
                          {vehicle.tracker_installed ? `Yes (${vehicle.tracker_company || "Active"})` : "No"}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* 3. Deal & Financial Terms */}
              <div className="my-4 p-3 bg-violet-50/70 border border-violet-200 rounded-xl">
                <h4 className="text-xs font-black text-violet-950 uppercase mb-2">
                  معاہدہ قیمت و اقساط کی تفصیل (FINANCIAL & PAYMENT TERMS)
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div className="bg-white p-2 rounded-lg border border-violet-100">
                    <p className="text-[10px] font-semibold text-slate-500 uppercase">کل طے شدہ قیمت</p>
                    <p className="text-sm font-black text-slate-950">{formatPKR(salePrice)}</p>
                  </div>
                  <div className="bg-white p-2 rounded-lg border border-violet-100">
                    <p className="text-[10px] font-semibold text-slate-500 uppercase">پیشگی رقم (Advance / Token)</p>
                    <p className="text-sm font-black text-emerald-700">{formatPKR(downPayment)}</p>
                  </div>
                  <div className="bg-white p-2 rounded-lg border border-violet-100">
                    <p className="text-[10px] font-semibold text-slate-500 uppercase">بقایا رقم (Balance)</p>
                    <p className="text-sm font-black text-rose-700">{formatPKR(remainingAmount)}</p>
                  </div>
                  <div className="bg-white p-2 rounded-lg border border-violet-100">
                    <p className="text-[10px] font-semibold text-slate-500 uppercase">ماہانہ قسط (Monthly Qist)</p>
                    <p className="text-sm font-black text-violet-700">
                      {saleType === "installment" ? formatPKR(installment?.monthly_installment || 0) : "Cash Full Paid"}
                    </p>
                  </div>
                </div>
              </div>

              {/* 4. Installment Schedule Table (If Installment) */}
              {saleType === "installment" && schedules.length > 0 && printSize !== "80mm" && (
                <div className="my-4">
                  <h4 className="text-xs font-black text-slate-900 uppercase mb-1.5 flex items-center gap-1.5">
                    <Calendar size={14} className="text-violet-700" />
                    <span>اقساط کا شیڈول (PAYMENT SCHEDULE)</span>
                  </h4>
                  <div className="overflow-hidden border border-slate-300 rounded-lg">
                    <table className="w-full text-[11px] text-center">
                      <thead className="bg-slate-100 font-bold text-slate-700 border-b border-slate-300">
                        <tr>
                          <th className="p-1.5">قسط #</th>
                          <th className="p-1.5">عنوان / نوعیت</th>
                          <th className="p-1.5">تاریخ ادائیگی</th>
                          <th className="p-1.5">مبلغ قسط</th>
                          <th className="p-1.5">اداشدہ</th>
                          <th className="p-1.5">حیثیت</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {schedules.map((sch) => (
                          <tr key={sch.id} className={sch.status === "paid" ? "bg-emerald-50/50" : sch.is_promise ? "bg-amber-50/60" : ""}>
                            <td className="p-1 font-semibold">{sch.installment_no}</td>
                            <td className="p-1 text-[10px]">
                              {sch.is_promise ? (
                                <span className="font-bold text-amber-900 bg-amber-100 px-1.5 py-0.5 rounded">
                                  ⭐ {sch.promise_title || "وعدہ ادائیگی"}
                                </span>
                              ) : (
                                <span className="text-slate-600">قسط</span>
                              )}
                            </td>
                            <td className="p-1">{sch.due_date}</td>
                            <td className="p-1 font-bold">{formatPKR(sch.due_amount)}</td>
                            <td className="p-1 text-emerald-700">{sch.paid_amount ? formatPKR(sch.paid_amount) : "—"}</td>
                            <td className="p-1 uppercase font-bold text-[9px]">
                              <span className={sch.status === "paid" ? "text-emerald-700" : "text-slate-500"}>
                                {sch.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* 5. Guarantor Information */}
              {saleType === "installment" && (installment?.guarantor_1_name || installment?.guarantor_2_name) && (
                <div className="my-4 p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs">
                  <h4 className="text-xs font-black text-slate-900 uppercase border-b border-slate-300 pb-1 mb-2">
                    ضامن 1 اور ضامن 2 کی تفصیلات (GUARANTORS DETAILS)
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {installment?.guarantor_1_name && (
                      <div className="border border-slate-200 p-2 rounded-lg bg-white">
                        <p className="font-bold text-slate-900">ضامن اول: {installment.guarantor_1_name}</p>
                        <p className="text-slate-600">ولدیت: {installment.guarantor_1_father_name || "—"} | قوم: {installment.guarantor_1_caste || "—"}</p>
                        <p className="text-slate-600">شناختی کارڈ: {installment.guarantor_1_cnic || "—"}</p>
                        <p className="text-slate-600">فون: {installment.guarantor_1_phone || "—"} | رشتہ: {installment.guarantor_1_relation || "—"}</p>
                      </div>
                    )}
                    {installment?.guarantor_2_name && (
                      <div className="border border-slate-200 p-2 rounded-lg bg-white">
                        <p className="font-bold text-slate-900">ضامن دوم: {installment.guarantor_2_name}</p>
                        <p className="text-slate-600">ولدیت: {installment.guarantor_2_father_name || "—"} | قوم: {installment.guarantor_2_caste || "—"}</p>
                        <p className="text-slate-600">شناختی کارڈ: {installment.guarantor_2_cnic || "—"}</p>
                        <p className="text-slate-600">فون: {installment.guarantor_2_phone || "—"} | رشتہ: {installment.guarantor_2_relation || "—"}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* 6. Legal Terms & Conditions */}
              <div className="my-4 p-3 border border-slate-300 rounded-xl bg-slate-50/50 text-[11px] leading-relaxed text-slate-800 text-right font-sans" dir="rtl">
                <h5 className="font-bold text-slate-950 mb-1 border-b border-slate-200 pb-1 text-center">
                  شرائط و اقرار نامہ (TERMS OF AGREEMENT)
                </h5>
                <ol className="list-decimal list-inside space-y-1 pr-1">
                  <li>خریدار نے مذکورہ گاڑی / موٹر سائیکل کو مکمل طور پر چیک کر کے اپنی مرضی و تسلی سے خریدی ہے۔</li>
                  <li>بعد از تسلیم و سپردگی گاڑی، کسی بھی قسم کا ایکسیڈنٹ، پولیس کیس، ایکسائز چالان یا دیگر قانونی ذمہ داری خریدار پر ہوگی۔</li>
                  <li>فروخت کنندہ نے یقین دہانی کروائی ہے کہ تاریخ فروخت تک گاڑی پر کوئی قانونی مقدمہ یا چوری کا کلیم نہ ہے۔</li>
                  {saleType === "installment" && (
                    <li>خریدار ہر ماہ کی مقررہ تاریخ تک قسط ادا کرنے کا پابند ہوگا۔ قسط میں تاخیر یا نادہندگی کی صورت میں شو روم کو گاڑی ضبط کرنے کا پورا قانونی حق حاصل ہوگا۔</li>
                  )}
                  <li>مکمل رقم کی ادائیگی کے بعد گاڑی کی ٹرانسفر فائل / بائیومیٹرک خریدار کے نام جاری کی جائے گی۔</li>
                </ol>
              </div>

              {/* 7. Signatures & Thumb Impressions */}
              <div className="mt-8 pt-4 border-t-2 border-slate-900 grid grid-cols-2 sm:grid-cols-4 gap-4 text-center text-xs">
                <div>
                  <div className="h-16 border-b border-dashed border-slate-400 mb-1 flex items-end justify-center">
                    <span className="text-[10px] text-slate-400">دستخط / انگوٹھا</span>
                  </div>
                  <p className="font-bold text-slate-950">دستخط فریق اول (فروخت کنندہ)</p>
                  <p className="text-[10px] text-slate-500">Seller Signature</p>
                </div>

                <div>
                  <div className="h-16 border-b border-dashed border-slate-400 mb-1 flex items-end justify-center">
                    <span className="text-[10px] text-slate-400">دستخط / انگوٹھا</span>
                  </div>
                  <p className="font-bold text-slate-950">دستخط فریق دوم (خریدار)</p>
                  <p className="text-[10px] text-slate-500">Buyer Signature</p>
                </div>

                <div>
                  <div className="h-16 border-b border-dashed border-slate-400 mb-1 flex items-end justify-center">
                    <span className="text-[10px] text-slate-400">دستخط</span>
                  </div>
                  <p className="font-bold text-slate-950">دستخط ضامن 1 / 2</p>
                  <p className="text-[10px] text-slate-500">Guarantor Signature</p>
                </div>

                <div>
                  <div className="h-16 border-b border-dashed border-slate-400 mb-1 flex items-end justify-center">
                    <span className="text-[10px] text-slate-400">
                      {displayWitnessName ? `گواہ: ${displayWitnessName}` : "دستخط و مہر"}
                    </span>
                  </div>
                  <p className="font-bold text-slate-950">
                    {displayWitnessName ? `گواہ: ${displayWitnessName}` : "مہر شو روم / گواہان"}
                  </p>
                  <p className="text-[10px] text-slate-500">
                    {displayWitnessPhone ? `Ph: ${displayWitnessPhone}` : "Showroom Stamp & Witness"}
                  </p>
                </div>
              </div>

              {/* Footer */}
              <div className="mt-6 text-center text-[10px] text-slate-400 border-t border-slate-100 pt-2">
                This document is generated automatically by The Accounts Cloud (theaccounts.cloud) • Legal Showroom Management System
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
