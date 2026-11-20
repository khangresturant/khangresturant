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

/** Slip types routed per printer (0 copies = do not print). */
export type RestaurantPrintJobType = "kot" | "guestBill" | "paidReceipt";

export type RestaurantPrinterSlot = {
  name: string;
  kotCopies: number;
  guestBillCopies: number;
  paidReceiptCopies: number;
};

export type RestaurantPrintDispatch = {
  printerName: string;
  copies: number;
};

const MAX_PRINTER_SLOTS = 2;

function pickStr(...vals: unknown[]): string {
  for (const v of vals) {
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return "";
}

function clampCopyCount(value: unknown): number {
  const n = Math.floor(Number(value));
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.min(n, 99);
}

function normalizeSlot(
  raw: Partial<RestaurantPrinterSlot> | undefined,
  legacyDefaults?: Partial<RestaurantPrinterSlot>
): RestaurantPrinterSlot {
  return {
    name: pickStr(raw?.name, legacyDefaults?.name),
    kotCopies: clampCopyCount(
      raw?.kotCopies !== undefined ? raw.kotCopies : legacyDefaults?.kotCopies
    ),
    guestBillCopies: clampCopyCount(
      raw?.guestBillCopies !== undefined
        ? raw.guestBillCopies
        : legacyDefaults?.guestBillCopies
    ),
    paidReceiptCopies: clampCopyCount(
      raw?.paidReceiptCopies !== undefined
        ? raw.paidReceiptCopies
        : legacyDefaults?.paidReceiptCopies
    ),
  };
}

/** Two printer rows for settings UI + print routing (legacy kitchen/customer when slots missing). */
export function resolveRestaurantPrinterSlots(
  settings: Partial<ReceiptSettings> | undefined,
  companyRow?: Record<string, unknown> | null
): RestaurantPrinterSlot[] {
  const kitchen = pickStr(
    settings?.kitchenPrinterName,
    companyRow?.kitchen_printer_name,
    companyRow?.printer_name,
    companyRow?.pn
  );
  const customer = pickStr(
    settings?.customerPrinterName,
    companyRow?.customer_printer_name
  );

  const stored = settings?.restaurantPrinterSlots;
  if (Array.isArray(stored) && stored.length > 0) {
    const slot0 = normalizeSlot(stored[0], {
      name: kitchen,
      kotCopies: 1,
      guestBillCopies: 0,
      paidReceiptCopies: 0,
    });
    const slot1 = normalizeSlot(stored[1], {
      name: customer,
      kotCopies: 0,
      guestBillCopies: 1,
      paidReceiptCopies: 1,
    });
    return [slot0, slot1].slice(0, MAX_PRINTER_SLOTS);
  }

  return [
    normalizeSlot(undefined, {
      name: kitchen,
      kotCopies: kitchen ? 1 : 0,
      guestBillCopies: 0,
      paidReceiptCopies: 0,
    }),
    normalizeSlot(undefined, {
      name: customer,
      kotCopies: 0,
      guestBillCopies: customer ? 1 : 0,
      paidReceiptCopies: customer ? 1 : 0,
    }),
  ];
}

export function defaultRestaurantPrinterSlotsFromCompany(
  kitchenName: string,
  customerName: string
): RestaurantPrinterSlot[] {
  const kitchen = kitchenName.trim();
  const customer = customerName.trim();
  return [
    normalizeSlot(undefined, {
      name: kitchen,
      kotCopies: kitchen ? 1 : 0,
      guestBillCopies: 0,
      paidReceiptCopies: 0,
    }),
    normalizeSlot(undefined, {
      name: customer,
      kotCopies: 0,
      guestBillCopies: customer ? 1 : 0,
      paidReceiptCopies: customer ? 1 : 0,
    }),
  ];
}

function copiesForJob(
  slot: RestaurantPrinterSlot,
  job: RestaurantPrintJobType
): number {
  if (job === "kot") return slot.kotCopies;
  if (job === "guestBill") return slot.guestBillCopies;
  return slot.paidReceiptCopies;
}

/** Printers + copy counts for a slip type (skips 0 copies and blank names). */
export function resolveRestaurantPrintDispatches(
  job: RestaurantPrintJobType,
  settings: Partial<ReceiptSettings> | undefined,
  companyRow?: Record<string, unknown> | null
): RestaurantPrintDispatch[] {
  const slots = resolveRestaurantPrinterSlots(settings, companyRow);
  const out: RestaurantPrintDispatch[] = [];
  for (const slot of slots) {
    const name = slot.name.trim();
    const copies = copiesForJob(slot, job);
    if (!name || copies <= 0) continue;
    out.push({ printerName: name, copies });
  }
  return out;
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
    restaurantPrinterSlots: resolveRestaurantPrinterSlots(
      {
        ...base,
        kitchenPrinterName:
          pickStr(base.kitchenPrinterName, kitchenFromCompany) || "",
        customerPrinterName:
          pickStr(base.customerPrinterName, customerFromCompany) || "",
      },
      companyRow
    ),
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
