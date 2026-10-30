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

export function resolveDefaultVariation(
  product: { name: string; sale_price_single: number },
  sizes: MenuSize[] | null | undefined
): { name: string; priceAdd: number } {
  const inferred = inferSizeFromProductName(product.name);
  if (sizes?.length) {
    const match =
      (inferred &&
        sizes.find((s) => s.size_name.toLowerCase() === inferred.toLowerCase())) ||
      sizes.find((s) => s.size_name.toLowerCase() === "medium") ||
      sizes[0];
    if (match) {
      return {
        name: match.size_name,
        priceAdd: Number(match.price) - product.sale_price_single,
      };
    }
  }
  if (inferred) {
    const fallback = [
      { name: "Small", priceAdd: -Math.round(product.sale_price_single * 0.15) },
      { name: "Medium", priceAdd: 0 },
      { name: "Large", priceAdd: Math.round(product.sale_price_single * 0.25) },
      { name: "XL", priceAdd: Math.round(product.sale_price_single * 0.5) },
    ];
    const f = fallback.find((x) => x.name.toLowerCase() === inferred.toLowerCase());
    if (f) return f;
  }
  return { name: "Medium", priceAdd: 0 };
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
