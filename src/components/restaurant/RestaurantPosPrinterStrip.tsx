"use client";

import Link from "next/link";
import { type ReceiptSettings } from "@/components/ReceiptTemplate";
import { resolveRestaurantPrinterSlots } from "@/lib/restaurant-print-profile";
import { isSimpleKotCategoryConfigured, simpleKotSlipTitle } from "@/lib/restaurant-kot-split";

type Props = {
  receiptSettings: Partial<ReceiptSettings>;
  companyRow?: Record<string, unknown> | null;
  language: "en" | "ur" | string;
  categoryLabels?: string[];
};

export function RestaurantPosPrinterStrip({
  receiptSettings,
  companyRow,
  language,
  categoryLabels,
}: Props) {
  const slots = resolveRestaurantPrinterSlots(receiptSettings, companyRow);
  const isEn = language === "en";
  const simpleOn = isSimpleKotCategoryConfigured(receiptSettings);

  return (
    <div className="col-span-full rounded-lg border border-slate-200 bg-slate-50/90 px-2.5 py-2 text-[10px] text-slate-700 space-y-1">
      <div className="flex items-center justify-between gap-2">
        <span className="font-black uppercase tracking-wide text-slate-800">
          {isEn ? "Print routing (Business Settings)" : "پرنٹ روٹنگ (سیٹنگز)"}
        </span>
        <Link
          href="/dashboard/settings"
          className="font-bold text-blue-600 hover:underline shrink-0"
        >
          {isEn ? "Edit" : "تبدیل"}
        </Link>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
        {slots.map((slot, i) => (
          <div key={i} className="font-mono leading-snug">
            <span className="font-bold text-slate-900">P{i + 1}</span>{" "}
            {slot.name?.trim() || (isEn ? "(no name)" : "(نام نہیں)")}{" "}
            <span className="text-slate-500">
              KOT×{slot.kotCopies} · Bill×{slot.guestBillCopies} · Paid×
              {slot.paidReceiptCopies}
            </span>
          </div>
        ))}
      </div>
      {simpleOn && (
        <p className="text-[9px] text-amber-900 font-semibold border-t border-slate-200 pt-1">
          {isEn ? "Separate simple KOT:" : "الگ سادہ KOT:"}{" "}
          {simpleKotSlipTitle(receiptSettings)}
          {categoryLabels?.length
            ? ` · ${categoryLabels.join(", ")}`
            : null}
        </p>
      )}
    </div>
  );
}