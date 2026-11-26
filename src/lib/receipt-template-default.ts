import {
  DEFAULT_RECEIPT_SETTINGS,
  RECEIPT_TEMPLATES,
  type ReceiptSettings,
} from "@/components/ReceiptTemplate";

/**
 * Single Receipt Designer preset = layouts that print today
 * (restaurant KOT / guest bill / payment — high-ink, 80mm).
 */
export const RESTAURANT_DEFAULT_RECEIPT_TEMPLATE_ID = "restaurant-default";

const KNOWN_TEMPLATE_IDS = new Set(RECEIPT_TEMPLATES.map((t) => t.id));

/** Cleared when the user returns to the default restaurant slip. */
const DEFAULT_LAYOUT_RESET: Pick<
  ReceiptSettings,
  | "pageSize"
  | "fontFamily"
  | "fontSize"
  | "borderStyle"
  | "marginLeft"
  | "marginRight"
  | "marginTop"
  | "marginBottom"
> = {
  pageSize: DEFAULT_RECEIPT_SETTINGS.pageSize,
  fontFamily: DEFAULT_RECEIPT_SETTINGS.fontFamily,
  fontSize: DEFAULT_RECEIPT_SETTINGS.fontSize,
  borderStyle: DEFAULT_RECEIPT_SETTINGS.borderStyle,
  marginLeft: 0,
  marginRight: 0,
  marginTop: 0,
  marginBottom: 0,
};

export function normalizeReceiptTemplateId(templateId?: string | null): string {
  const id = (templateId || "").trim();
  if (!id) return RESTAURANT_DEFAULT_RECEIPT_TEMPLATE_ID;
  if (id === "falcon-kitchen-high-ink") {
    return RESTAURANT_DEFAULT_RECEIPT_TEMPLATE_ID;
  }
  if (KNOWN_TEMPLATE_IDS.has(id)) return id;
  return RESTAURANT_DEFAULT_RECEIPT_TEMPLATE_ID;
}

export function usesRestaurantDefaultPrintLayout(templateId?: string | null): boolean {
  return (
    normalizeReceiptTemplateId(templateId) ===
    RESTAURANT_DEFAULT_RECEIPT_TEMPLATE_ID
  );
}

/** True if this preset is the default card (incl. legacy ids). */
export function isReceiptDesignerDefaultSelected(templateId?: string | null): boolean {
  return usesRestaurantDefaultPrintLayout(templateId);
}

/**
 * User picked a template card — switching to Default drops alternative layout knobs.
 */
export function applyReceiptDesignerTemplateSelection(
  current: ReceiptSettings,
  selectedTemplateId: string
): ReceiptSettings {
  const templateId = normalizeReceiptTemplateId(selectedTemplateId);
  if (templateId === RESTAURANT_DEFAULT_RECEIPT_TEMPLATE_ID) {
    return {
      ...current,
      ...DEFAULT_LAYOUT_RESET,
      templateId: RESTAURANT_DEFAULT_RECEIPT_TEMPLATE_ID,
    };
  }
  return { ...current, templateId };
}

/** Restaurant print: honor designer choice; Default never uses leftover alternative CSS inputs. */
export function mergeRestaurantReceiptPrintSettings(
  settings?: Partial<ReceiptSettings>
): ReceiptSettings {
  const merged: ReceiptSettings = {
    ...DEFAULT_RECEIPT_SETTINGS,
    ...settings,
  };
  const templateId = normalizeReceiptTemplateId(merged.templateId);
  if (templateId === RESTAURANT_DEFAULT_RECEIPT_TEMPLATE_ID) {
    const marginMm = (value: unknown) => {
      const n = Number(value);
      return Number.isFinite(n) ? Math.max(0, n) : 0;
    };
    return {
      ...merged,
      ...DEFAULT_LAYOUT_RESET,
      marginLeft: marginMm(merged.marginLeft),
      marginRight: marginMm(merged.marginRight),
      pageSize: merged.pageSize === "MM58" ? "MM58" : DEFAULT_RECEIPT_SETTINGS.pageSize,
      templateId: RESTAURANT_DEFAULT_RECEIPT_TEMPLATE_ID,
    };
  }
  return { ...merged, templateId };
}

/** Live preview in Receipt Designer while Default is selected. */
export function receiptSettingsForDesignerPreview(
  settings: ReceiptSettings
): ReceiptSettings {
  if (!isReceiptDesignerDefaultSelected(settings.templateId)) {
    return settings;
  }
  return applyReceiptDesignerTemplateSelection(settings, RESTAURANT_DEFAULT_RECEIPT_TEMPLATE_ID);
}