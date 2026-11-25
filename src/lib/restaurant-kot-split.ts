import { type ReceiptSettings } from "@/components/ReceiptTemplate";
import type { RestaurantKOTLine } from "@/lib/restaurant-receipt-print";

export type KotLineWithMeta = RestaurantKOTLine & {
  product_id?: string | null;
  category_id?: string | null;
};

const ROTI_NAME_RE =
  /\b(ro+t[iy]?|roti|rooti|roty|naan|nan|paratha|chapati|chapatti|tandoori\s*roti|kulcha|sheermal|taftan|rumali|romali|bread|puri)\b/i;

const KATHI_NAME_RE = /\bkathi(\s*roll)?\b/i;

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
  return (
    clampIds(settings?.restaurantSimpleKotCategoryIds).length > 0 ||
    clampIds(settings?.restaurantSecondarySimpleKotCategoryIds).length > 0
  );
}

export function productNameMatchesSecondaryKot(name: string): boolean {
  return KATHI_NAME_RE.test(name.trim());
}

function lineBelongsOnSecondaryKot(
  line: KotLineWithMeta,
  settings: Partial<ReceiptSettings> | undefined,
  productIdToCategoryId?: Map<string, string>
): boolean {
  const categoryIds = new Set(
    clampIds(settings?.restaurantSecondarySimpleKotCategoryIds)
  );
  if (categoryIds.size === 0) return false;

  const categoryId =
    line.category_id?.trim() ||
    (line.product_id && productIdToCategoryId?.get(line.product_id)) ||
    "";

  if (categoryId && categoryIds.has(categoryId)) return true;

  if (settings?.restaurantSecondarySimpleKotMatchNames !== false) {
    return productNameMatchesSecondaryKot(line.name);
  }
  return false;
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
): {
  main: RestaurantKOTLine[];
  simple: RestaurantKOTLine[];
  secondary: RestaurantKOTLine[];
} {
  const main: RestaurantKOTLine[] = [];
  const simple: RestaurantKOTLine[] = [];
  const secondary: RestaurantKOTLine[] = [];

  if (!isSimpleKotCategoryConfigured(settings)) {
    return { main: lines.map(stripMeta), simple: [], secondary: [] };
  }

  for (const line of lines) {
    const stripped = stripMeta(line);
    if (lineBelongsOnSecondaryKot(line, settings, productIdToCategoryId)) {
      secondary.push(stripped);
    } else if (lineBelongsOnSimpleKot(line, settings, productIdToCategoryId)) {
      simple.push(stripped);
    } else {
      main.push(stripped);
    }
  }
  return { main, simple, secondary };
}

function stripMeta(line: KotLineWithMeta): RestaurantKOTLine {
  return {
    name: line.name,
    quantity: line.quantity,
    sizeLabel: line.sizeLabel,
    remarks: line.remarks,
  };
}

/** Merge duplicate bread/roti rows on the same slip (name + size + note). */
export function consolidateKotLines(lines: RestaurantKOTLine[]): RestaurantKOTLine[] {
  const merged: RestaurantKOTLine[] = [];
  const index = new Map<string, number>();

  for (const line of lines) {
    const name = (line.name || "").trim();
    const size = (line.sizeLabel || "").trim();
    const note = (line.remarks || "").trim();
    const key = `${name.toLowerCase()}|${size.toLowerCase()}|${note.toLowerCase()}`;
    const qty = Math.max(1, Math.floor(Number(line.quantity) || 1));
    const hit = index.get(key);
    if (hit !== undefined) {
      merged[hit].quantity += qty;
    } else {
      index.set(key, merged.length);
      merged.push({
        name,
        quantity: qty,
        sizeLabel: size || line.sizeLabel,
        remarks: line.remarks,
        description: line.description,
      });
    }
  }
  return merged;
}

export function simpleKotSlipTitle(settings: Partial<ReceiptSettings> | undefined): string {
  const custom = settings?.restaurantSimpleKotTitle?.trim();
  return custom || "ROTI / NAN";
}

export function secondaryKotSlipTitle(
  settings: Partial<ReceiptSettings> | undefined
): string {
  const custom = settings?.restaurantSecondarySimpleKotTitle?.trim();
  return custom || "KATHI";
}