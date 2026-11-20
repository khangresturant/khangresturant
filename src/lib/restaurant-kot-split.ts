import { type ReceiptSettings } from "@/components/ReceiptTemplate";
import type { RestaurantKOTLine } from "@/lib/restaurant-receipt-print";

export type KotLineWithMeta = RestaurantKOTLine & {
  product_id?: string | null;
  category_id?: string | null;
};

const ROTI_NAME_RE =
  /\b(ro+t[iy]?|roti|rooti|roty|naan|nan|paratha|chapati|chapatti|tandoori\s*roti)\b/i;

function clampIds(ids: unknown): string[] {
  if (!Array.isArray(ids)) return [];
  return ids.map((x) => String(x || "").trim()).filter(Boolean);
}

/** Product name hints when category is already configured (spelling variants). */
export function productNameMatchesSimpleKot(name: string): boolean {
  return ROTI_NAME_RE.test(name.trim());
}

export function isSimpleKotCategoryConfigured(
  settings: Partial<ReceiptSettings> | undefined
): boolean {
  return clampIds(settings?.restaurantSimpleKotCategoryIds).length > 0;
}

export function lineBelongsOnSimpleKot(
  line: KotLineWithMeta,
  settings: Partial<ReceiptSettings> | undefined,
  productIdToCategoryId?: Map<string, string>
): boolean {
  const categoryIds = new Set(clampIds(settings?.restaurantSimpleKotCategoryIds));
  if (categoryIds.size === 0) return false;

  const categoryId =
    line.category_id?.trim() ||
    (line.product_id && productIdToCategoryId?.get(line.product_id)) ||
    "";

  if (categoryId && categoryIds.has(categoryId)) return true;

  if (settings?.restaurantSimpleKotMatchNames !== false) {
    return productNameMatchesSimpleKot(line.name);
  }
  return false;
}

export function splitKotLinesForPrint(
  lines: KotLineWithMeta[],
  settings: Partial<ReceiptSettings> | undefined,
  productIdToCategoryId?: Map<string, string>
): { main: RestaurantKOTLine[]; simple: RestaurantKOTLine[] } {
  const main: RestaurantKOTLine[] = [];
  const simple: RestaurantKOTLine[] = [];

  if (!isSimpleKotCategoryConfigured(settings)) {
    return { main: lines.map(stripMeta), simple: [] };
  }

  for (const line of lines) {
    const stripped = stripMeta(line);
    if (lineBelongsOnSimpleKot(line, settings, productIdToCategoryId)) {
      simple.push(stripped);
    } else {
      main.push(stripped);
    }
  }
  return { main, simple };
}

function stripMeta(line: KotLineWithMeta): RestaurantKOTLine {
  return {
    name: line.name,
    quantity: line.quantity,
    sizeLabel: line.sizeLabel,
    remarks: line.remarks,
  };
}

export function simpleKotSlipTitle(settings: Partial<ReceiptSettings> | undefined): string {
  const custom = settings?.restaurantSimpleKotTitle?.trim();
  return custom || "ROTI / NAN";
}