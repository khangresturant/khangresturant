import type { MenuSize } from "@/lib/restaurant-deals";

export type CartAddOnLine = { name: string; priceAdd: number };

export function stripTrailingSizeFromName(name: string): string {
  return name
    .replace(/\s+(Personal|Small|Medium|Large|Family|XL|Extra Large)\s*$/i, "")
    .trim();
}

export function inferSizeFromProductName(name: string): string | null {
  const n = name.toLowerCase();
  if (n.includes("personal")) return "Personal";
  if (n.includes("family")) return "Family";
  if (/\bxl\b/.test(n) || n.includes("extra large")) return "XL";
  if (n.includes(" large")) return "Large";
  if (n.includes(" medium")) return "Medium";
  if (n.includes(" small")) return "Small";
  return null;
}

export type PosVariationOption = {
  name: string;
  priceAdd: number;
  absolutePrice: number;
  menuSizeId?: string | null;
};

/** POS sale options: DB sizes only when configured - no fake S/M/L and no Standard alongside sizes. */
export function variationOptionsForPos(
  product: { sale_price_single: number },
  sizes: MenuSize[] | null | undefined
): PosVariationOption[] {
  if (sizes?.length) {
    return [...sizes]
      .sort((a, b) => Number(a.sort_order ?? 0) - Number(b.sort_order ?? 0))
      .map((s) => ({
        name: s.size_name,
        priceAdd: Number(s.price) - Number(product.sale_price_single),
        absolutePrice: Number(s.price),
        menuSizeId: s.id,
      }));
  }
  return [
    {
      name: "Standard",
      priceAdd: 0,
      absolutePrice: Number(product.sale_price_single) || 0,
      menuSizeId: null,
    },
  ];
}

export function resolveDefaultVariation(
  product: { name: string; sale_price_single: number },
  sizes: MenuSize[] | null | undefined
): { name: string; priceAdd: number } {
  const opts = variationOptionsForPos(product, sizes);
  const first = opts[0];
  return { name: first.name, priceAdd: first.priceAdd };
}

export function unitSalePriceForVariation(
  product: { sale_price_single: number },
  sizes: MenuSize[] | null | undefined,
  selectedName: string
): number {
  const opts = variationOptionsForPos(product, sizes);
  const hit = opts.find((o) => o.name === selectedName) || opts[0];
  return (hit?.absolutePrice ?? Number(product.sale_price_single)) || 0;
}

export function buildCustomizedLineName(
  productName: string,
  sizeName: string,
  crust: string,
  weightKg?: number,
  useWeight?: boolean
): string {
  const base = stripTrailingSizeFromName(productName);
  let full = `${base} (${sizeName})`;
  if (crust && crust !== "Regular") {
    full += ` · ${crust}`;
  }
  if (useWeight && weightKg) {
    full += ` · ${weightKg}kg`;
  }
  return full;
}

export function buildKitchenRemarks(
  crust: string,
  addOns: CartAddOnLine[],
  specialInstructions: string
): string {
  let remarksStr = "";
  if (crust && crust !== "Regular") {
    remarksStr += `Crust: ${crust}`;
  }
  if (addOns.length) {
    const addOnPart = addOns.map((a) => (a.priceAdd > 0 ? `${a.name} (+Rs ${a.priceAdd})` : a.name)).join(", ");
    remarksStr += remarksStr ? ` | Add: ${addOnPart}` : `Add: ${addOnPart}`;
  }
  if (specialInstructions.trim()) {
    remarksStr += remarksStr
      ? ` | Instructions: ${specialInstructions.trim()}`
      : specialInstructions.trim();
  }
  return remarksStr;
}
