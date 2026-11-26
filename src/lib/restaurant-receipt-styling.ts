/**
 * Maps Receipt Designer settings → restaurant KOT / guest / payment slip CSS.
 * Hardcoded kitchen-order styles stay default; other template presets use configuration high-ink CSS.
 */

import {
  DEFAULT_RECEIPT_SETTINGS,
  type ReceiptSettings,
} from "@/components/ReceiptTemplate";
import {
  buildRestaurantKitchenReceiptHeadStyles,
  THERMAL_HIGH_INK_CSS,
} from "@/lib/fast-food-order-view-receipts";
import {
  RESTAURANT_DEFAULT_RECEIPT_TEMPLATE_ID,
  normalizeReceiptTemplateId,
  usesRestaurantDefaultPrintLayout,
} from "@/lib/receipt-template-default";
import {
  THERMAL_58_CONTENT_MM,
  THERMAL_58_ROLL_MM,
  THERMAL_80_CONTENT_MM,
  THERMAL_ROLL_HARDWARE_MM,
  buildConfigurationThermalSlipCss,
} from "@/lib/thermalPrinter";

/** @deprecated Use RESTAURANT_DEFAULT_RECEIPT_TEMPLATE_ID */
export const RESTAURANT_KITCHEN_HIGH_INK_TEMPLATE_ID =
  RESTAURANT_DEFAULT_RECEIPT_TEMPLATE_ID;

export type RestaurantReceiptDocumentStyle = {
  css: string;
  thermalWidthMetaMm: number;
  inkMeta: "restaurant-high" | "configuration-high";
};

export { RESTAURANT_DEFAULT_RECEIPT_TEMPLATE_ID, normalizeReceiptTemplateId };

/** @deprecated Use usesRestaurantDefaultPrintLayout */
export const usesRestaurantKitchenHardcodedStyles = usesRestaurantDefaultPrintLayout;

export function resolveRestaurantRollDimensions(
  settings?: Partial<ReceiptSettings>
): { rollWidthMm: number; contentWidthMm: number } {
  const pageSize = settings?.pageSize || DEFAULT_RECEIPT_SETTINGS.pageSize;
  if (pageSize === "MM58") {
    return { rollWidthMm: THERMAL_58_ROLL_MM, contentWidthMm: THERMAL_58_CONTENT_MM };
  }
  return {
    rollWidthMm: THERMAL_ROLL_HARDWARE_MM,
    contentWidthMm: THERMAL_80_CONTENT_MM,
  };
}

/** Designer font size + family, forced solid black (thermal head). */
export function restaurantDesignerTypeCss(settings?: Partial<ReceiptSettings>): string {
  const fontPx = Math.min(Math.max(Number(settings?.fontSize) || 11, 8), 20);
  const family = settings?.fontFamily || "monospace";
  const fontCss =
    family === "sans-serif"
      ? "Arial, Helvetica, sans-serif"
      : family === "serif"
        ? "'Times New Roman', Times, Georgia, serif"
        : family === "urdu"
          ? "'Noto Nastaliq Urdu', 'Jameel Noori Nastaleeq', Tahoma, sans-serif"
          : "'Courier New', Courier, monospace";
  const shopPx = Math.min(fontPx + 3, 22);
  const marginMm = (value: unknown) => {
    const n = Number(value);
    return Number.isFinite(n) ? Math.max(0, n) : 0;
  };
  const leftMm = marginMm(settings?.marginLeft);
  const rightMm = marginMm(settings?.marginRight);
  return `
.receipt-container,
.receipt-container .info,
.receipt-container .info p,
.receipt-container .totals,
.receipt-container .totals p,
.receipt-container .footer,
.receipt-container .footer p,
.receipt-container th,
.receipt-container td,
.receipt-container .header p {
  font-family: ${fontCss} !important;
  font-size: ${fontPx}px !important;
  -webkit-font-smoothing: none !important;
  text-rendering: geometricPrecision !important;
}
.receipt-container .shop-name,
.receipt-container .header .shop-name {
  font-size: ${shopPx}px !important;
  text-align: center !important;
}
.receipt-container .header,
.receipt-container .header p {
  text-align: center !important;
}
.receipt-container .kitchen-order-heading,
.receipt-container .section-title {
  text-align: center !important;
  font-weight: 900 !important;
  font-size: ${Math.min(Math.max(fontPx + 5, 16), 24)}px !important;
  line-height: 1.25 !important;
  letter-spacing: 0.6px !important;
  padding: 5px 8px !important;
  margin: 5px 0 6px 0 !important;
  border: 2px solid #000 !important;
  border-radius: 3px !important;
  text-transform: uppercase !important;
  box-sizing: border-box !important;
  width: 100% !important;
  display: block !important;
}
.receipt-container {
  padding-left: ${leftMm}mm !important;
  padding-right: ${rightMm}mm !important;
}
.receipt-container, .receipt-container * {
  -webkit-font-smoothing: none !important;
  text-rendering: geometricPrecision !important;
  transform: none !important;
  filter: none !important;
}
.receipt-container img.receipt-logo {
  display: inline-block !important;
  max-width: 70% !important;
  height: 28px !important;
  image-rendering: crisp-edges;
}
.receipt-container table.restaurant-bill-items th,
.receipt-container table.restaurant-bill-items td {
  font-size: 9px !important;
  line-height: 1.15 !important;
}
`;
}

export function resolveRestaurantReceiptDocumentStyle(
  settings?: Partial<ReceiptSettings>
): RestaurantReceiptDocumentStyle {
  const merged = {
    ...DEFAULT_RECEIPT_SETTINGS,
    ...settings,
    templateId: normalizeReceiptTemplateId(settings?.templateId),
  };
  const { rollWidthMm, contentWidthMm } = resolveRestaurantRollDimensions(merged);
  const typeCss = restaurantDesignerTypeCss(merged);

  const highInk = THERMAL_HIGH_INK_CSS;

  if (usesRestaurantDefaultPrintLayout(normalizeReceiptTemplateId(merged.templateId))) {
    return {
      css: `${buildRestaurantKitchenReceiptHeadStyles(contentWidthMm, rollWidthMm)}\n${typeCss}\n${highInk}`,
      thermalWidthMetaMm: rollWidthMm,
      inkMeta: "restaurant-high",
    };
  }

  try {
    return {
      css: `${buildConfigurationThermalSlipCss(merged, {
        rollWidthMm,
        contentWidthMm,
        rootSelector: ".receipt-container",
      })}\n${typeCss}\n${highInk}`,
      thermalWidthMetaMm: rollWidthMm,
      inkMeta: "restaurant-high",
    };
  } catch {
    return {
      css: `${buildRestaurantKitchenReceiptHeadStyles(contentWidthMm, rollWidthMm)}\n${typeCss}\n${highInk}`,
      thermalWidthMetaMm: rollWidthMm,
      inkMeta: "restaurant-high",
    };
  }
}

export function restaurantSlipHeadMetaTags(
  settings?: Partial<ReceiptSettings>
): string {
  const resolved = resolveRestaurantReceiptDocumentStyle(settings);
  return `<meta name="x-thermal-width-mm" content="${resolved.thermalWidthMetaMm}" />
  <meta name="x-thermal-format" content="roll" />
  <meta name="x-thermal-ink-level" content="${resolved.inkMeta}" />
  <meta name="x-receipt-template-id" content="${normalizeReceiptTemplateId(settings?.templateId)}" />`;
}