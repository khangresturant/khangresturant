"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Printer,
  Share2,
  Receipt,
  Car,
  CheckCircle2,
  Calendar,
  Phone,
  User,
  Wallet,
  Building2,
  FileCheck,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useShop } from "@/context/ShopContext";
import type { ShowroomVehicle, ShowroomInstallment, ShowroomInstallmentSchedule } from "@/lib/showroom-ops";
import { formatPKR } from "@/lib/showroom-ops";

interface ShowroomReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  shopName?: string;
  shopAddress?: string;
  shopPhone?: string;
  vehicle?: ShowroomVehicle | null;
  installment: ShowroomInstallment;
  schedule: ShowroomInstallmentSchedule;
  accountName?: string;
  nextSchedule?: ShowroomInstallmentSchedule | null;
}

function formatDate(d: string | null | undefined) {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleDateString("en-PK", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return d;
  }
}

export function ShowroomReceiptModal({
  isOpen,
  onClose,
  shopName,
  shopAddress,
  shopPhone,
  vehicle,
  installment,
  schedule,
  accountName = "Cash in Hand",
  nextSchedule,
}: ShowroomReceiptModalProps) {
  const { shopPhone: ctxPhone, shopAddress: ctxAddress, shopName: ctxShopName } = useShop();
  const [printSize, setPrintSize] = useState<"a4" | "a5" | "80mm">("a5");

  const effectiveShopName = shopName || ctxShopName || "Showroom";
  const effectiveShopPhone = (shopPhone && shopPhone !== "0300-0000000") ? shopPhone : (ctxPhone || "");
  const effectiveShopAddress = (shopAddress && shopAddress !== "Main Showroom Market, Lahore") ? shopAddress : (ctxAddress || "");

  if (!isOpen) return null;

  const receiptNo = schedule.receipt_no || `REC-${schedule.id.slice(0, 6).toUpperCase()}`;
  const paymentDate = schedule.paid_date ? formatDate(schedule.paid_date) : formatDate(new Date().toISOString());
  const veh = vehicle || installment.showroom_vehicles;
  const vehicleName = veh ? `${veh.make} ${veh.model} (${veh.year || "—"})` : "Vehicle";
  const regNumber = veh?.is_applied_for ? "Applied For (اپلائیڈ فار)" : (veh?.plate_number || "—");
  const paidAmount = Number(schedule.paid_amount) || Number(schedule.due_amount) || 0;
  const remainingBalance = Number(installment.remaining_balance) || 0;

  // Print function using iframe with Nastaleeq font and rock-solid CSS
  const handlePrint = () => {
    const printArea = document.getElementById("receipt-printable-sheet");
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
        <title>${effectiveShopName} — Receipt #${receiptNo}</title>
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

          * { box-sizing: border-box; margin: 0; padding: 0; }
          body {
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
            background: #ffffff;
            color: #0f172a;
            padding: ${printSize === "80mm" ? "2mm" : printSize === "a4" ? "8mm" : "4mm"};
            font-size: ${printSize === "80mm" ? "10px" : printSize === "a4" ? "13px" : "11.5px"};
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
            line-height: 1.4;
          }
          @page {
            size: ${printSize === "80mm" ? "80mm auto" : printSize === "a4" ? "A4 portrait" : "A5 portrait"};
            margin: ${printSize === "80mm" ? "2mm" : "6mm"};
          }
          .font-urdu, [dir="rtl"], .urdu {
            font-family: 'Jameel Noori Nastaleeq', 'Noto Nastaliq Urdu', 'Urdu Typesetting', serif !important;
            direction: rtl;
            line-height: 1.6;
          }
          .receipt-box {
            border: ${printSize === "80mm" ? "none" : "1.5px solid #0f172a"};
            border-radius: ${printSize === "80mm" ? "0" : "10px"};
            padding: ${printSize === "80mm" ? "4px" : "16px"};
            max-width: ${printSize === "80mm" ? "100%" : printSize === "a4" ? "750px" : "540px"};
            margin: 0 auto;
          }
          .header-title {
            font-size: ${printSize === "80mm" ? "14px" : "18px"};
            font-weight: 900;
            text-transform: uppercase;
            text-align: center;
            letter-spacing: 0.5px;
            color: #0f172a;
          }
          .header-subtitle {
            font-family: 'Jameel Noori Nastaleeq', 'Noto Nastaliq Urdu', serif;
            font-size: ${printSize === "80mm" ? "12px" : "14px"};
            font-weight: bold;
            text-align: center;
            color: #334155;
            margin-top: 2px;
          }
          .header-meta {
            font-size: 10px;
            text-align: center;
            color: #64748b;
            margin-top: 3px;
          }
          .title-badge {
            display: block;
            background: #0f172a;
            color: #ffffff;
            text-align: center;
            font-weight: 800;
            font-size: 11px;
            padding: 4px 10px;
            border-radius: 4px;
            margin: 10px 0 8px 0;
            letter-spacing: 0.5px;
          }
          .meta-table {
            width: 100%;
            border-collapse: collapse;
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 6px;
            margin-bottom: 10px;
          }
          .meta-table td {
            padding: 5px 8px;
            font-size: 10.5px;
            vertical-align: middle;
            border: 1px solid #e2e8f0;
          }
          .data-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 10px;
          }
          .data-table td {
            padding: 5px 8px;
            font-size: 11px;
            border-bottom: 1px solid #e2e8f0;
            vertical-align: middle;
          }
          .data-table td.label-col {
            color: #475569;
            font-weight: 600;
            width: 42%;
          }
          .data-table td.val-col {
            color: #0f172a;
            font-weight: 700;
            text-align: right;
          }
          .payment-card {
            background: #ecfdf5;
            border: 1.5px solid #10b981;
            border-radius: 8px;
            padding: 10px 12px;
            margin: 10px 0;
          }
          .paid-amount-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
          }
          .paid-amount-text {
            font-size: ${printSize === "80mm" ? "14px" : "18px"};
            font-weight: 900;
            color: #065f46;
          }
          .sign-table {
            width: 100%;
            margin-top: 24px;
            border-collapse: collapse;
          }
          .sign-table td {
            width: 50%;
            text-align: center;
            vertical-align: bottom;
            padding: 0 12px;
          }
          .sign-line {
            border-top: 1px dashed #64748b;
            padding-top: 4px;
            font-size: 10.5px;
            font-weight: bold;
            color: #334155;
            font-family: 'Jameel Noori Nastaleeq', 'Noto Nastaliq Urdu', serif;
          }
        </style>
      </head>
      <body>
        <div class="receipt-box">
          ${htmlContent}
        </div>
      </body>
      </html>
    `);
    frameDoc.close();

    const doPrint = () => {
      printFrame.contentWindow?.focus();
      printFrame.contentWindow?.print();
      setTimeout(() => {
        if (document.body.contains(printFrame)) {
          document.body.removeChild(printFrame);
        }
      }, 3000);
    };

    if (frameDoc.fonts) {
      frameDoc.fonts.ready.then(() => {
        setTimeout(doPrint, 350);
      });
    } else {
      setTimeout(doPrint, 800);
    }
  };

  const handleSendWhatsApp = () => {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const agreementLink = `${origin}/dashboard/showroom/installments/agreement/${installment.id}`;

    const text =
      `*${effectiveShopName} — قسط وصولی رسید*\n` +
      (effectiveShopAddress ? `*پتہ:* ${effectiveShopAddress}\n` : "") +
      (effectiveShopPhone ? `*رابطہ:* ${effectiveShopPhone}\n` : "") +
      `--------------------------------\n` +
      `*رسید نمبر:* ${receiptNo}\n` +
      (schedule.manual_receipt_no ? `*دستی پرچی نمبر:* #${schedule.manual_receipt_no}\n` : "") +
      (schedule.manual_book_no || installment.manual_book_no ? `*کھاتہ نمبر:* #${schedule.manual_book_no || installment.manual_book_no}\n` : "") +
      (installment.manual_file_no ? `*رسید نمبر:* #${installment.manual_file_no}\n` : "") +
      `*معاہدہ نمبر:* ${installment.agreement_number}\n` +
      `*گاہک کا نام:* ${installment.customer_name}\n` +
      `*گاڑی / موٹر سائیکل:* ${vehicleName}\n` +
      `*نمبر پلیٹ:* ${regNumber}\n` +
      `--------------------------------\n` +
      `*قسط تفصیل:* ${schedule.is_promise ? `⭐ ${schedule.promise_title || "وعدہ ادائیگی / یکمشت رقم"}` : `Qist #${schedule.installment_no} of ${installment.total_installments}`}\n` +
      `*تاریخ وصولی:* ${paymentDate}\n` +
      `*وصول شدہ رقم:* ${formatPKR(paidAmount)}\n` +
      `*وصولی کھاتہ:* ${accountName}\n` +
      (schedule.notes ? `*نوٹ:* ${schedule.notes}\n` : "") +
      `--------------------------------\n` +
      `*کل بقیہ واجب الادا بیلنس:* ${formatPKR(remainingBalance)}\n` +
      (nextSchedule
        ? `*اگلی قسط کی تاریخ:* ${formatDate(nextSchedule.due_date)} (${formatPKR(nextSchedule.due_amount)})\n`
        : "") +
      `--------------------------------\n` +
      `📥 *مکمل معاہدہ و قسط نامہ ڈاؤن لوڈ کریں (View/Download):*\n👉 ${agreementLink}\n\n` +
      `شکریہ! ${effectiveShopName}${effectiveShopPhone ? ` — ${effectiveShopPhone}` : ""}`;

    const phoneNum = (installment.customer_phone || "").replace(/[^0-9]/g, "");
    const cleanPhone = phoneNum.startsWith("0") ? "92" + phoneNum.slice(1) : phoneNum;
    window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(text)}`, "_blank");
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/75 backdrop-blur-sm overflow-y-auto">
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          className="bg-white border border-slate-200 rounded-3xl w-full max-w-2xl max-h-[94vh] flex flex-col shadow-2xl overflow-hidden"
        >
          {/* Top Modal Bar */}
          <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                <Receipt className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm sm:text-base font-black text-slate-900 flex items-center gap-2">
                  <span>Installment Payment Receipt</span>
                  <span className="font-urdu text-xs text-emerald-800 font-bold">(قسط وصولی رسید)</span>
                </h3>
                <p className="text-[11px] text-slate-500 font-mono">
                  {receiptNo} • {installment.customer_name}
                </p>
              </div>
            </div>

            {/* Size Selector */}
            <div className="flex items-center gap-1.5 bg-slate-200/80 p-1 rounded-xl">
              <button
                onClick={() => setPrintSize("a5")}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  printSize === "a5" ? "bg-white text-slate-900 shadow-2xs" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                A5 Slip
              </button>
              <button
                onClick={() => setPrintSize("a4")}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  printSize === "a4" ? "bg-white text-slate-900 shadow-2xs" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                A4 Voucher
              </button>
              <button
                onClick={() => setPrintSize("80mm")}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  printSize === "80mm" ? "bg-white text-slate-900 shadow-2xs" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                80mm Thermal
              </button>
            </div>

            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-700 p-1.5 rounded-xl hover:bg-slate-200 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Receipt Printable Preview Container */}
          <div className="p-4 sm:p-6 overflow-y-auto flex-1 bg-slate-100/60 flex justify-center">
            <div
              id="receipt-printable-sheet"
              className={`bg-white text-slate-900 shadow-md border border-slate-300 p-6 rounded-2xl ${
                printSize === "80mm" ? "w-[330px] text-xs" : printSize === "a4" ? "w-full max-w-2xl text-sm" : "w-full max-w-xl text-xs"
              }`}
            >
              {/* Header */}
              <div className="text-center border-b-2 border-slate-900 pb-3 mb-3">
                <h2 className="header-title text-base sm:text-lg font-black uppercase tracking-wider text-slate-950">
                  {effectiveShopName}
                </h2>
                <div className="header-subtitle font-urdu text-sm font-black text-slate-800 mt-0.5">
                  کار و موٹر سائیکل شو روم • خرید و فروخت و آسان اقساط
                </div>
                {(effectiveShopPhone || effectiveShopAddress) && (
                  <div className="header-meta text-[11px] text-slate-500 font-semibold mt-1">
                    {[effectiveShopPhone ? `Phone: ${effectiveShopPhone}` : "", effectiveShopAddress].filter(Boolean).join(" • ")}
                  </div>
                )}
                <div className="title-badge mt-2 px-3 py-1 rounded bg-slate-900 text-white font-black text-xs uppercase tracking-wider inline-block">
                  Installment Receipt / قسط وصولی رسید
                </div>
              </div>

              {/* Receipt Meta Grid Table */}
              <table className="meta-table w-full mb-3">
                <tbody>
                  <tr>
                    <td className="w-1/2">
                      <span className="text-slate-500 font-bold block text-[10px]">RECEIPT NO (رسید نمبر):</span>
                      <strong className="font-mono text-slate-900 text-xs">{receiptNo}</strong>
                      {schedule.manual_receipt_no && (
                        <div className="text-[10px] text-emerald-800 font-bold mt-0.5">
                          دستی پرچی: #{schedule.manual_receipt_no}
                        </div>
                      )}
                    </td>
                    <td className="w-1/2 text-right">
                      <span className="text-slate-500 font-bold block text-[10px]">PAYMENT DATE (تاریخ وصولی):</span>
                      <strong className="text-slate-900 text-xs">{paymentDate}</strong>
                    </td>
                  </tr>
                  <tr>
                    <td className="w-1/2">
                      <span className="text-slate-500 font-bold block text-[10px]">AGREEMENT NO (معاہدہ نمبر):</span>
                      <strong className="font-mono text-violet-800 text-xs">{installment.agreement_number}</strong>
                      {(schedule.manual_book_no || installment.manual_book_no || installment.manual_file_no) && (
                        <div className="text-[10px] text-amber-800 font-bold mt-0.5">
                          {(schedule.manual_book_no || installment.manual_book_no) ? `کھاتہ: #${schedule.manual_book_no || installment.manual_book_no}` : ""}
                          {installment.manual_file_no ? ` • رسید: #${installment.manual_file_no}` : ""}
                        </div>
                      )}
                    </td>
                    <td className="w-1/2 text-right">
                      <span className="text-slate-500 font-bold block text-[10px]">INSTALLMENT (قسط تفصیل):</span>
                      <strong className="text-slate-900 text-xs">
                        {schedule.is_promise ? (
                          <span className="text-amber-800">⭐ {schedule.promise_title || "وعدہ ادائیگی"}</span>
                        ) : (
                          `Qist #${schedule.installment_no} of ${installment.total_installments}`
                        )}
                      </strong>
                    </td>
                  </tr>
                </tbody>
              </table>

              {/* Customer & Vehicle Details Table */}
              <table className="data-table w-full mb-3">
                <tbody>
                  <tr>
                    <td className="label-col">Customer Name (گاہک کا نام):</td>
                    <td className="val-col font-bold text-slate-900">{installment.customer_name}</td>
                  </tr>
                  {installment.customer_phone && (
                    <tr>
                      <td className="label-col">Phone (موبائل نمبر):</td>
                      <td className="val-col font-mono">{installment.customer_phone}</td>
                    </tr>
                  )}
                  {installment.customer_cnic && (
                    <tr>
                      <td className="label-col">CNIC (شناختی کارڈ):</td>
                      <td className="val-col font-mono">{installment.customer_cnic}</td>
                    </tr>
                  )}
                  <tr>
                    <td className="label-col">Vehicle (گاڑی / بائیک):</td>
                    <td className="val-col font-bold text-slate-900">{vehicleName}</td>
                  </tr>
                  <tr>
                    <td className="label-col">Registration # (نمبر پلیٹ):</td>
                    <td className="val-col font-mono font-bold text-violet-900">{regNumber}</td>
                  </tr>
                </tbody>
              </table>

              {/* Highlighted Payment Card */}
              <div className="payment-card bg-emerald-50 border-2 border-emerald-500 p-3 rounded-xl mb-3">
                <div className="paid-amount-row flex justify-between items-center">
                  <div>
                    <span className="font-urdu text-xs font-black text-emerald-950 block">وصول شدہ قسط رقم:</span>
                    <span className="text-[10px] text-emerald-700 font-bold">Paid Installment Amount</span>
                  </div>
                  <div className="paid-amount-text text-lg sm:text-xl font-black text-emerald-800">
                    {formatPKR(paidAmount)}
                  </div>
                </div>

                <div className="flex justify-between items-center text-xs text-emerald-900 pt-2 mt-2 border-t border-emerald-200">
                  <span className="font-urdu font-bold">وصولی کھاتہ (Deposit Account):</span>
                  <span className="font-bold">{accountName}</span>
                </div>

                {schedule.notes && (
                  <div className="text-[11px] text-emerald-800 italic pt-1 mt-1 border-t border-emerald-200/60">
                    Note: {schedule.notes}
                  </div>
                )}
              </div>

              {/* Balance & Next Due Details */}
              <table className="data-table w-full mb-3">
                <tbody>
                  <tr>
                    <td className="label-col font-urdu font-black text-slate-800">
                      کل بقیہ واجب الادا بیلنس (Remaining Balance):
                    </td>
                    <td className="val-col text-sm font-black text-amber-900">
                      {formatPKR(remainingBalance)}
                    </td>
                  </tr>
                  {nextSchedule && (
                    <tr>
                      <td className="label-col font-urdu font-bold text-slate-600">
                        اگلی قسط کی تاریخ (Next Due Date):
                      </td>
                      <td className="val-col font-bold text-slate-800">
                        {formatDate(nextSchedule.due_date)} • {formatPKR(nextSchedule.due_amount)}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>

              {/* Signatures & Footer Note */}
              <div className="pt-2">
                <table className="sign-table w-full mt-4">
                  <tbody>
                    <tr>
                      <td className="w-1/2 text-center pb-2">
                        <div className="sign-line border-t border-dashed border-slate-500 pt-1 font-urdu text-xs font-bold text-slate-700">
                          دستخط خریدار / گاہک
                        </div>
                      </td>
                      <td className="w-1/2 text-center pb-2">
                        <div className="sign-line border-t border-dashed border-slate-500 pt-1 font-urdu text-xs font-bold text-slate-700">
                          دستخط شو روم مینیجر / مہر
                        </div>
                      </td>
                    </tr>
                  </tbody>
                </table>

                <div className="text-center font-urdu text-xs text-slate-500 mt-3 font-semibold">
                  یہ کمپیوٹرائزڈ رسید ہے اور ادائیگی کا تصدیقی ثبوت ہے۔ بوقتِ ضرورت پیش کریں۔
                </div>
              </div>
            </div>
          </div>

          {/* Action Footer Buttons */}
          <div className="p-4 border-t border-slate-200 bg-slate-50 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="text-xs text-slate-500 font-medium">
              Receipt printed with <strong className="text-slate-800">Jameel Noori / Noto Nastaliq Urdu</strong>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Button
                onClick={handleSendWhatsApp}
                variant="outline"
                className="flex-1 sm:flex-none border-emerald-200 text-emerald-700 hover:bg-emerald-50 text-xs font-bold rounded-xl cursor-pointer"
              >
                <Share2 className="w-3.5 h-3.5 mr-1.5" />
                <span>WhatsApp</span>
              </Button>

              <Button
                onClick={handlePrint}
                className="flex-1 sm:flex-none bg-violet-600 hover:bg-violet-700 text-white text-xs font-bold rounded-xl cursor-pointer shadow-md"
              >
                <Printer className="w-3.5 h-3.5 mr-1.5" />
                <span>Print / PDF ({printSize.toUpperCase()})</span>
              </Button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
