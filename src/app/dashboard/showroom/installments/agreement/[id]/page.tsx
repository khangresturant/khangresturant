"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Loader2, Printer, ArrowLeft, Share2, FileText, CheckCircle2, ShieldCheck, Car } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useShop } from "@/context/ShopContext";
import { Button } from "@/components/ui/button";
import {
  formatPKR,
  type ShowroomInstallment,
  type ShowroomInstallmentSchedule,
  type ShowroomVehicle,
  loadShowroomOfflineEntities,
  isShowroomOffline,
} from "@/lib/showroom-ops";

export default function InstallmentAgreementPrintPage() {
  const params = useParams();
  const router = useRouter();
  const { shopId, shopName, shopPhone, shopAddress } = useShop();
  const supabase = createClient();
  const agreementId = params?.id as string;

  const [installment, setInstallment] = useState<ShowroomInstallment | null>(null);
  const [vehicle, setVehicle] = useState<ShowroomVehicle | null>(null);
  const [schedules, setSchedules] = useState<ShowroomInstallmentSchedule[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!agreementId) return;

    (async () => {
      setLoading(true);
      try {
        if (isShowroomOffline()) {
          const [offInst, offScheds, offVehs] = await Promise.all([
            loadShowroomOfflineEntities<ShowroomInstallment>("showroom_installments", shopId || ""),
            loadShowroomOfflineEntities<ShowroomInstallmentSchedule>("showroom_installment_schedules", shopId || ""),
            loadShowroomOfflineEntities<ShowroomVehicle>("showroom_vehicles", shopId || ""),
          ]);
          const foundInst = offInst.find((i) => i.id === agreementId);
          if (foundInst) {
            setInstallment(foundInst);
            const v = offVehs.find((x) => x.id === foundInst.vehicle_id) || null;
            setVehicle(v);
          }
          const matchedScheds = offScheds
            .filter((s) => s.installment_id === agreementId)
            .sort((a, b) => Number(a.installment_no) - Number(b.installment_no));
          setSchedules(matchedScheds);
          setLoading(false);
          return;
        }

        const { data: inst, error: instErr } = await supabase
          .from("showroom_installments")
          .select(`
            *,
            showroom_vehicles (*)
          `)
          .eq("id", agreementId)
          .single();

        if (instErr) throw instErr;
        setInstallment(inst as ShowroomInstallment);
        setVehicle((inst.showroom_vehicles as ShowroomVehicle) || null);

        const { data: scheds, error: schedErr } = await supabase
          .from("showroom_installment_schedules")
          .select("*")
          .eq("installment_id", agreementId)
          .order("installment_no", { ascending: true });

        if (!schedErr && scheds) {
          setSchedules(scheds as ShowroomInstallmentSchedule[]);
        }
      } catch (err: any) {
        try {
          const [offInst, offScheds, offVehs] = await Promise.all([
            loadShowroomOfflineEntities<ShowroomInstallment>("showroom_installments", shopId || ""),
            loadShowroomOfflineEntities<ShowroomInstallmentSchedule>("showroom_installment_schedules", shopId || ""),
            loadShowroomOfflineEntities<ShowroomVehicle>("showroom_vehicles", shopId || ""),
          ]);
          const foundInst = offInst.find((i) => i.id === agreementId);
          if (foundInst) {
            setInstallment(foundInst);
            const v = offVehs.find((x) => x.id === foundInst.vehicle_id) || null;
            setVehicle(v);
          }
          const matchedScheds = offScheds
            .filter((s) => s.installment_id === agreementId)
            .sort((a, b) => Number(a.installment_no) - Number(b.installment_no));
          setSchedules(matchedScheds);
        } catch {
          console.error("Error loading agreement:", err);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [agreementId, supabase, shopId]);

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-900 text-slate-300 gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-violet-500" />
        <p className="text-sm font-semibold">Loading legal installment agreement...</p>
      </div>
    );
  }

  if (!installment) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-900 text-slate-300 gap-4 p-6 text-center">
        <FileText className="h-12 w-12 text-slate-600" />
        <h2 className="text-xl font-bold text-white">Agreement Not Found</h2>
        <p className="text-xs text-slate-400 max-w-sm">The requested installment agreement could not be located in database.</p>
        <Button onClick={() => router.back()} variant="outline" className="text-xs">
          <ArrowLeft className="h-4 w-4 mr-1.5" /> Go Back
        </Button>
      </div>
    );
  }

  const handlePrint = () => {
    const printArea = document.getElementById("dedicated-printable-sheet");
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

    frameDoc.open();
    frameDoc.write(`
      <!DOCTYPE html>
      <html lang="ur" dir="ltr">
      <head>
        <title>${shopName || "Showroom"} — Agreement (${installment?.agreement_number || "001"})</title>
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
            padding: 10mm;
            font-size: 12px;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          @page { size: A4 portrait; margin: 5mm; }
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
          .my-4 { margin-top: 16px; margin-bottom: 16px; }
          .mt-1 { margin-top: 4px; }
          .mt-2 { margin-top: 8px; }
          .mt-4 { margin-top: 16px; }
          .mt-6 { margin-top: 24px; }
          .mt-8 { margin-top: 32px; }
          .mt-10 { margin-top: 40px; }
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
          .bg-emerald-50 { background-color: #ecfdf5; }
          .bg-amber-50 { background-color: #fffbeb; }
          .text-slate-500 { color: #64748b; }
          .text-slate-600 { color: #475569; }
          .text-slate-700 { color: #334155; }
          .text-slate-900 { color: #0f172a; }
          .text-slate-950 { color: #020617; }
          .text-violet-900 { color: #4c1d95; }
          .text-emerald-900 { color: #064e3b; }
          .text-amber-900 { color: #78350f; }
          .grid { display: flex; gap: 12px; }
          .grid-2 > div { flex: 1; }
          .grid-4 > div { flex: 1; }
          table { width: 100%; border-collapse: collapse; }
          th, td { border: 1px solid #cbd5e1; padding: 6px 8px; }
          th { background-color: #f1f5f9; font-weight: bold; }
          ol { padding-right: 18px; line-height: 1.8; }
        </style>
      </head>
      <body>
        ${printArea.innerHTML}
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
    const agreementLink = `${origin}/dashboard/showroom/installments/agreement/${installment.id}`;

    const text = `*${shopName || "Showroom"} — Vehicle Installment Agreement*\n` +
      (shopAddress ? `*پتہ:* ${shopAddress}\n` : "") +
      (shopPhone ? `*رابطہ:* ${shopPhone}\n` : "") +
      `--------------------------------\n` +
      `*Agreement No:* ${installment.agreement_number}\n` +
      `*Customer:* ${installment.customer_name} (CNIC: ${installment.customer_cnic || "—"})\n` +
      `*Vehicle:* ${vehicle ? `${vehicle.make} ${vehicle.model} (${vehicle.year || "—"})` : "—"}\n` +
      `*Reg/Plate:* ${vehicle?.is_applied_for ? "Applied For" : (vehicle?.plate_number || "—")}\n` +
      `*Chassis No:* ${vehicle?.chassis_number || "—"}\n` +
      `*Total Price:* ${formatPKR(installment.total_price)}\n` +
      `*Advance Paid:* ${formatPKR(installment.down_payment)}\n` +
      `*Balance:* ${formatPKR(installment.remaining_balance)}\n` +
      `*Monthly Qist:* ${formatPKR(installment.monthly_installment)} x ${installment.total_installments} Months\n` +
      `*Start Date:* ${installment.start_date}\n` +
      `--------------------------------\n` +
      `📥 *مکمل معاہدہ نامہ دیکھیں و ڈاؤن لوڈ کریں (View / Download):*\n👉 ${agreementLink}\n\n` +
      `Thank you for dealing with ${shopName || "our Showroom"}!`;

    const phoneNum = (installment.customer_phone || "").replace(/[^0-9]/g, "");
    const cleanPhone = phoneNum.startsWith("0") ? "92" + phoneNum.slice(1) : phoneNum;
    window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(text)}`, "_blank");
  };

  return (
    <div className="min-h-screen bg-slate-100 print:bg-white text-slate-900 font-sans p-3 sm:p-6 print:p-0">
      {/* Top Action Bar (hidden on print) */}
      <div className="max-w-4xl mx-auto mb-6 print:hidden flex flex-wrap items-center justify-between gap-3 bg-slate-900 text-white p-4 rounded-2xl shadow-lg">
        <div className="flex items-center gap-3">
          <Button
            onClick={() => router.back()}
            variant="ghost"
            size="sm"
            className="text-slate-300 hover:text-white hover:bg-slate-800 rounded-xl"
          >
            <ArrowLeft className="h-4 w-4 mr-1.5" /> Back
          </Button>
          <div>
            <h1 className="text-sm sm:text-base font-bold text-white">
              Official Legal Agreement ({installment.agreement_number})
            </h1>
            <p className="text-xs text-slate-400">Printable A4 Deed with bilingual Urdu & English terms</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            onClick={handleWhatsApp}
            variant="outline"
            size="sm"
            className="bg-emerald-600 hover:bg-emerald-500 text-white border-none text-xs font-bold gap-1.5 rounded-xl"
          >
            <Share2 className="h-3.5 w-3.5" /> WhatsApp
          </Button>
          <Button
            onClick={handlePrint}
            size="sm"
            className="bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold gap-1.5 rounded-xl shadow-md"
          >
            <Printer className="h-3.5 w-3.5" /> Print Agreement (A4)
          </Button>
        </div>
      </div>

      {/* Printable Legal Document Container */}
      <div id="dedicated-printable-sheet" className="max-w-4xl mx-auto bg-white p-8 sm:p-12 print:p-6 rounded-3xl shadow-xl print:shadow-none border border-slate-200 print:border-none">
        {/* Document Header */}
        <div className="border-b-2 border-slate-900 pb-4 text-center">
          <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-widest font-mono">
                AGREEMENT #{installment.agreement_number}
              </span>
              {installment.manual_book_no && (
                <span className="text-[11px] font-bold text-amber-900 bg-amber-50 px-2.5 py-0.5 rounded-lg border border-amber-200">
                  کھاتہ #{installment.manual_book_no}
                </span>
              )}
              {installment.manual_file_no && (
                <span className="text-[11px] font-bold text-slate-800 bg-slate-100 px-2.5 py-0.5 rounded-lg border border-slate-200">
                  رسید #{installment.manual_file_no}
                </span>
              )}
            </div>
            <span className="text-xs font-bold text-slate-600 font-mono">
              DATE: {new Date(installment.start_date || Date.now()).toLocaleDateString("en-PK", { day: "2-digit", month: "long", year: "numeric" })}
            </span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-950 uppercase font-serif">
            {shopName || "AUTOMOTIVE SHOWROOM"}
          </h1>
          <p className="text-xs font-semibold text-slate-700 mt-0.5">
            {shopAddress || "کار و موٹر سائیکل شو روم، خرید و فروخت و آسان اقساط"}
          </p>
          {shopPhone && (
            <p className="text-xs font-bold text-slate-900 mt-0.5 font-mono">
              Phone / رابطہ: {shopPhone}
            </p>
          )}

          <div className="mt-3 inline-block bg-slate-900 text-white text-xs font-black tracking-wider uppercase px-4 py-1.5 rounded-full">
            VEHICLE INSTALLMENT SALE DEED & AGREEMENT (گاڑی کا اقرار نامہ و بیع نامہ اقساط)
          </div>
        </div>

        {/* Legal Preamble */}
        <div className="mt-5 text-[11px] sm:text-xs text-slate-700 leading-relaxed text-justify bg-slate-50 p-4 rounded-xl border border-slate-200">
          <p className="font-semibold text-slate-900 mb-1">
            اقرار نامہ برائے فروخت گاڑی / موٹر سائیکل بذریعہ ماہوار اقساط (Legal Vehicle Financing Agreement)
          </p>
          <p>
            یہ معاہدہ آج بتاریخ <strong>{new Date(installment.start_date || Date.now()).toLocaleDateString("ur-PK")}</strong> بمطابق <strong>{installment.start_date}</strong> کو فریق اول (مالک شوروم / بائع) اور فریق دوم (خریدار / مشتری) کے مابین باہمی رضامندی و ہوش و حواس خمسہ طے پایا۔ فریق دوم نے مندرجہ ذیل گاڑی نقد و اقساط پر خریدی اور اس کے جملہ قواعد و ضوابط تسلیم کیے۔
          </p>
        </div>

        {/* Vehicle Identity Table */}
        <div className="mt-6">
          <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 border-b border-slate-300 pb-1 mb-2 flex items-center gap-1.5">
            <Car className="h-3.5 w-3.5 text-violet-700" />
            1. Vehicle Specifications (گاڑی کی تفصیلات)
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs bg-slate-50 p-3 rounded-xl border border-slate-200">
            <div>
              <span className="text-[10px] text-slate-400 block font-bold uppercase">Make / Brand</span>
              <span className="font-bold text-slate-900">{vehicle?.make || "—"}</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 block font-bold uppercase">Model & Year</span>
              <span className="font-bold text-slate-900">{vehicle?.model || "—"} ({vehicle?.year || "—"})</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 block font-bold uppercase">Registration / Plate</span>
              <span className="font-bold text-violet-900 font-mono">
                {vehicle?.is_applied_for ? "APPLIED FOR" : (vehicle?.plate_number || "—")}
              </span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 block font-bold uppercase">Color / رنگ</span>
              <span className="font-bold text-slate-900">{vehicle?.color || "—"}</span>
            </div>
            <div className="mt-2">
              <span className="text-[10px] text-slate-400 block font-bold uppercase">Chassis No (شاسی نمبر)</span>
              <span className="font-bold font-mono text-slate-900">{vehicle?.chassis_number || "—"}</span>
            </div>
            <div className="mt-2">
              <span className="text-[10px] text-slate-400 block font-bold uppercase">Engine No (انجن نمبر)</span>
              <span className="font-bold font-mono text-slate-900">{vehicle?.engine_number || "—"}</span>
            </div>
            <div className="mt-2">
              <span className="text-[10px] text-slate-400 block font-bold uppercase">Engine CC</span>
              <span className="font-bold text-slate-900">{vehicle?.engine_cc ? `${vehicle.engine_cc} CC` : "—"}</span>
            </div>
            <div className="mt-2">
              <span className="text-[10px] text-slate-400 block font-bold uppercase">Vehicle Type</span>
              <span className="font-bold capitalize text-slate-900">{vehicle?.vehicle_type || "Car"}</span>
            </div>
          </div>
        </div>

        {/* Parties Information: Seller & Buyer */}
        <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          {/* Seller / Showroom */}
          <div className="border border-slate-300 rounded-xl p-3.5 bg-slate-50/50">
            <h4 className="font-black text-slate-900 uppercase text-[11px] pb-1 border-b border-slate-200 mb-2 flex items-center justify-between">
              <span>2. First Party (مالک شو روم / فریق اول)</span>
              <span className="text-[10px] text-slate-500 font-normal">Seller</span>
            </h4>
            <div className="space-y-1">
              <p><span className="text-slate-500 font-medium">Showroom / Name:</span> <strong className="text-slate-900">{shopName}</strong></p>
              <p><span className="text-slate-500 font-medium">Contact Phone (موبائل):</span> <strong className="font-mono">{shopPhone || "—"}</strong></p>
              <p><span className="text-slate-500 font-medium">Address (پتہ):</span> <strong>{shopAddress || "—"}</strong></p>
            </div>
          </div>

          {/* Buyer */}
          <div className="border border-slate-300 rounded-xl p-3.5 bg-slate-50/50">
            <h4 className="font-black text-slate-900 uppercase text-[11px] pb-1 border-b border-slate-200 mb-2 flex items-center justify-between">
              <span>3. Second Party (خریدار / فریق دوم)</span>
              <span className="text-[10px] text-slate-500 font-normal">Buyer</span>
            </h4>
            <div className="space-y-1">
              <p><span className="text-slate-500 font-medium">Name:</span> <strong className="text-slate-900">{installment.customer_name}</strong></p>
              <p><span className="text-slate-500 font-medium">S/O (ولدیت):</span> <strong>{installment.customer_father_name || "—"}</strong></p>
              <p><span className="text-slate-500 font-medium">Caste (قوم):</span> <strong>{installment.customer_caste || "—"}</strong></p>
              <p><span className="text-slate-500 font-medium">CNIC (شناختی کارڈ):</span> <strong className="font-mono">{installment.customer_cnic || "—"}</strong></p>
              <p><span className="text-slate-500 font-medium">Mobile Phone:</span> <strong className="font-mono">{installment.customer_phone}</strong></p>
              <p><span className="text-slate-500 font-medium">Address (پتہ):</span> <strong>{installment.customer_address || "—"}</strong></p>
            </div>
          </div>

          {/* Guarantor 1 */}
          <div className="border border-slate-300 rounded-xl p-3.5 bg-slate-50/50">
            <h4 className="font-black text-slate-900 uppercase text-[11px] pb-1 border-b border-slate-200 mb-2">
              3. Guarantor 1 (ضامن اول / گواہ)
            </h4>
            <div className="space-y-1">
              <p><span className="text-slate-500 font-medium">Name:</span> <strong className="text-slate-900">{installment.guarantor_1_name || "—"}</strong></p>
              <p><span className="text-slate-500 font-medium">S/O (ولدیت):</span> <strong>{installment.guarantor_1_father_name || "—"}</strong></p>
              <p><span className="text-slate-500 font-medium">Caste (قوم):</span> <strong>{installment.guarantor_1_caste || "—"}</strong></p>
              <p><span className="text-slate-500 font-medium">CNIC:</span> <strong className="font-mono">{installment.guarantor_1_cnic || "—"}</strong></p>
              <p><span className="text-slate-500 font-medium">Phone / Relation:</span> <strong className="font-mono">{installment.guarantor_1_phone || "—"} ({installment.guarantor_1_relation || "Zamin"})</strong></p>
              <p><span className="text-slate-500 font-medium">Address:</span> <strong>{installment.guarantor_1_address || "—"}</strong></p>
            </div>
          </div>
        </div>

        {/* Financial Summary Table */}
        <div className="mt-6">
          <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 border-b border-slate-300 pb-1 mb-2">
            4. Financial Terms & Payment Schedule (مالیاتی حساب و اقساط)
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
            <div className="bg-slate-100 p-3 rounded-xl border border-slate-200">
              <span className="text-[10px] text-slate-500 block font-bold uppercase">Total Financed Price</span>
              <span className="text-base font-black text-slate-900">{formatPKR(installment.total_price)}</span>
            </div>
            <div className="bg-emerald-50 p-3 rounded-xl border border-emerald-200 text-emerald-900">
              <span className="text-[10px] text-emerald-600 block font-bold uppercase">Advance / Down Payment</span>
              <span className="text-base font-black">{formatPKR(installment.down_payment)}</span>
            </div>
            <div className="bg-amber-50 p-3 rounded-xl border border-amber-200 text-amber-900">
              <span className="text-[10px] text-amber-600 block font-bold uppercase">Remaining Balance</span>
              <span className="text-base font-black">{formatPKR(installment.remaining_balance)}</span>
            </div>
            <div className="bg-violet-50 p-3 rounded-xl border border-violet-200 text-violet-900">
              <span className="text-[10px] text-violet-600 block font-bold uppercase">Monthly Installment (ماہانہ قسط)</span>
              <span className="text-base font-black">{formatPKR(installment.monthly_installment)} / mo</span>
            </div>
          </div>
        </div>

        {/* Schedule Mini-Table */}
        {schedules.length > 0 && (
          <div className="mt-6">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 border-b border-slate-300 pb-1 mb-2">
              5. Monthly Due Installments Schedule (شیڈول اقساط)
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left border border-slate-200 rounded-xl overflow-hidden">
                <thead className="bg-slate-100 text-[10px] uppercase font-bold text-slate-600">
                  <tr>
                    <th className="p-2 border-b">#</th>
                    <th className="p-2 border-b">Type / عنوان</th>
                    <th className="p-2 border-b">Due Date (تاریخ ادائیگی)</th>
                    <th className="p-2 border-b text-right">Amount (قسط رقم)</th>
                    <th className="p-2 border-b text-center">Status</th>
                    <th className="p-2 border-b">Paid Date / Receipt (رسید)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {schedules.map((s) => (
                    <tr key={s.id} className={s.status === "paid" ? "bg-emerald-50/40" : s.is_promise ? "bg-amber-50/50" : ""}>
                      <td className="p-2 font-bold font-mono">#{s.installment_no}</td>
                      <td className="p-2">
                        {s.is_promise ? (
                          <span className="font-bold text-amber-900 bg-amber-100 px-1.5 py-0.5 rounded text-[10px]">
                            ⭐ {s.promise_title || "وعدہ ادائیگی"}
                          </span>
                        ) : (
                          <span className="text-slate-700 font-semibold">ماہوار قسط</span>
                        )}
                      </td>
                      <td className="p-2 font-medium">{new Date(s.due_date).toLocaleDateString("en-PK", { day: "2-digit", month: "short", year: "numeric" })}</td>
                      <td className="p-2 text-right font-black">{formatPKR(s.due_amount)}</td>
                      <td className="p-2 text-center">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${s.status === "paid" ? "bg-emerald-100 text-emerald-800" : "bg-slate-200 text-slate-700"}`}>
                          {s.status}
                        </span>
                      </td>
                      <td className="p-2 text-[11px] text-slate-700 font-mono">
                        {s.paid_date ? (
                          <div>
                            <span>{new Date(s.paid_date).toLocaleDateString("en-PK")}</span>
                            {s.manual_receipt_no && (
                              <span className="text-emerald-700 font-bold ml-1">
                                (پرچی #{s.manual_receipt_no})
                              </span>
                            )}
                          </div>
                        ) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Legal Terms & Conditions in Urdu */}
        <div className="mt-6 border-t border-slate-200 pt-4 text-[10px] sm:text-[11px] text-slate-600 space-y-1.5 leading-relaxed bg-slate-50 p-4 rounded-xl">
          <p className="font-bold text-slate-800 uppercase">شرائط و ضوابط (Terms & Conditions):</p>
          <ol className="list-decimal list-inside space-y-1">
            <li>خریدار ہر ماہ کی مقررہ تاریخ سے قبل قسط ادا کرنے کا پابند ہوگا۔ مسلسل ۲ اقساط تاخیر کی صورت میں شوروم کو گاڑی تحویل میں لینے کا مکمل قانونی حق حاصل ہوگا۔</li>
            <li>گاڑی کے اصل کاغذات اور ٹرانسفر لیٹر تمام اقساط کی مکمل ادائیگی اور این او سی جاری ہونے کے بعد ہی خریدار کے حوالے کیے جائیں گے۔</li>
            <li>گاڑی میں ٹریکر اور انشورنس کا خرچ حسب معاہدہ خریدار کے ذمہ ہوگا اور دوران قسط گاڑی کو غیر قانونی کاموں یا بلا اطلاع شہر سے باہر منتقل کرنے کی ممانعت ہوگی۔</li>
            <li>ضامن فریق دوم کی عدم ادائیگی کی صورت میں قانونی و مالیاتی طور پر گاڑی اور رقم کی ادائیگی کا برابر کا ذمہ دار ہوگا۔</li>
          </ol>
        </div>

        {/* Signature & Thumb Impression Blocks */}
        <div className="mt-10 pt-4 border-t-2 border-slate-900 grid grid-cols-2 sm:grid-cols-4 gap-6 text-center text-xs">
          <div>
            <div className="h-14 border-b border-dashed border-slate-400 mb-2"></div>
            <p className="font-bold text-slate-900">دستخط بائع (مالک شوروم)</p>
            <p className="text-[10px] text-slate-400">Seller Signature / Stamp</p>
          </div>
          <div>
            <div className="h-14 border-b border-dashed border-slate-400 mb-2"></div>
            <p className="font-bold text-slate-900">دستخط و انگوٹھا خریدار</p>
            <p className="text-[10px] text-slate-400">Buyer Signature / Thumb</p>
          </div>
          <div>
            <div className="h-14 border-b border-dashed border-slate-400 mb-2"></div>
            <p className="font-bold text-slate-900">دستخط ضامن اول</p>
            <p className="text-[10px] text-slate-400">Guarantor 1 Signature</p>
          </div>
          <div>
            <div className="h-14 border-b border-dashed border-slate-400 mb-2"></div>
            <p className="font-bold text-slate-900">دستخط گواہ / ضامن دوم</p>
            <p className="text-[10px] text-slate-400">Witness 2 Signature</p>
          </div>
        </div>
      </div>
    </div>
  );
}
