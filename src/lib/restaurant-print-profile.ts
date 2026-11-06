import { type ReceiptSettings } from "@/components/ReceiptTemplate";
import { mergePrintSettingsFromRow } from "@/lib/merge-print-settings";

export type RestaurantPrintShopDetails = {
  name: string;
  phone?: string | null;
  address?: string | null;
  email?: string | null;
  website?: string | null;
};

/** Guest / delivery fields that belong on KOT + customer slips. */
export type RestaurantGuestDetails = {
  customerName?: string | null;
  customerPhone?: string | null;
  customerAddress?: string | null;
  waiterName?: string | null;
  riderName?: string | null;
  riderPhone?: string | null;
  specialInstructions?: string | null;
  deliveryFee?: number | null;
  additionalCharges?: number | null;
};

export function guestDetailsFromInvoice(
  inv: Record<string, unknown> | null | undefined,
  extras?: {
    waiterName?: string | null;
    riderName?: string | null;
    riderPhone?: string | null;
    partyName?: string | null;
    partyPhone?: string | null;
  }
): RestaurantGuestDetails {
  return {
    customerName: pickStr(inv?.customer_name, extras?.partyName) || null,
    customerPhone: pickStr(inv?.customer_phone, extras?.partyPhone) || null,
    customerAddress: pickStr(inv?.customer_address) || null,
    waiterName: extras?.waiterName?.trim() || null,
    riderName: extras?.riderName?.trim() || null,
    riderPhone: extras?.riderPhone?.trim() || null,
    specialInstructions: pickStr(inv?.special_instructions) || null,
    deliveryFee: Number(inv?.delivery_fee || 0) || 0,
    additionalCharges: Number(inv?.additional_charges || 0) || 0,
  };
}

export type RestaurantPrintRole = "kitchen" | "customer";

function pickStr(...vals: unknown[]): string {
  for (const v of vals) {
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return "";
}

/** Receipt header block - always from company_details (not shop display name alone). */
export function companyRowToShopDetails(
  companyRow: Record<string, unknown> | null | undefined,
  shopNameFallback?: string | null
): RestaurantPrintShopDetails {
  const name =
    pickStr(companyRow?.name) ||
    pickStr(shopNameFallback) ||
    "Restaurant";
  return {
    name,
    phone: pickStr(companyRow?.phone) || null,
    address: pickStr(companyRow?.address) || null,
    email: pickStr(companyRow?.email) || null,
    website: pickStr(companyRow?.website) || null,
  };
}

/** Merge print_settings + company_details (logo, printer names like POSRESTURANT pn). */
export function mergeRestaurantPrintProfile(
  companyRow: Record<string, unknown> | null | undefined,
  printRow: Record<string, unknown> | null | undefined
): ReceiptSettings {
  const base = mergePrintSettingsFromRow(printRow);
  const kitchenFromCompany = pickStr(
    companyRow?.kitchen_printer_name,
    companyRow?.printer_name,
    companyRow?.pn
  );
  const customerFromCompany = pickStr(companyRow?.customer_printer_name);

  const logoFromCompany = pickStr(companyRow?.logo_path);
  const logoUrl = pickStr(base.logoUrl) || logoFromCompany;

  return {
    ...base,
    logoUrl,
    showLogo: base.showLogo || !!logoUrl,
    kitchenPrinterName:
      pickStr(base.kitchenPrinterName, kitchenFromCompany) || "",
    customerPrinterName:
      pickStr(base.customerPrinterName, customerFromCompany) || "",
    restaurantLogoOnKot:
      base.restaurantLogoOnKot !== undefined ? base.restaurantLogoOnKot : true,
    restaurantPrintKitchenOnKot:
      base.restaurantPrintKitchenOnKot !== undefined
        ? base.restaurantPrintKitchenOnKot
        : true,
  };
}

export function resolvePrinterNameForRole(
  role: RestaurantPrintRole,
  settings: Partial<ReceiptSettings> | undefined,
  companyRow?: Record<string, unknown> | null
): string {
  if (role === "kitchen") {
    return pickStr(
      settings?.kitchenPrinterName,
      companyRow?.kitchen_printer_name,
      companyRow?.printer_name,
      companyRow?.pn
    );
  }
  return pickStr(settings?.customerPrinterName, companyRow?.customer_printer_name);
}
