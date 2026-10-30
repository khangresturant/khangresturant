/**
 * Advanced Multi-Token Product Search & Ranking Utility
 * Supports word-order agnostic searching (e.g., "cable interlink" matches "Interlink 3A Fast Charging Cable")
 * Tailored for Mobile Shops, Electronics, Supermarkets, Pharmacies & General Retail.
 */

export interface ProductSearchable {
  id?: string;
  name: string;
  code?: string | null;
  sku?: string | null;
  shelf_location?: string | null;
  category_id?: string | null;
  brand_id?: string | null;
  brands?: { name?: string } | { name?: string }[] | null;
  categories?: { name?: string } | { name?: string }[] | null;
  brand_name?: string | null;
  category_name?: string | null;
  formulations?: { name?: string } | null;
  custom_name?: string | null;
  translated_names?: Record<string, string> | null;
  product_barcodes?: Array<{ barcode?: string | null }> | null;
  product_variants?: Array<{
    id?: string;
    packing_name?: string | null;
    name?: string | null;
    product_barcodes?: Array<{ barcode?: string | null }> | null;
  }> | null;
  product_imeis?: Array<{
    imei1?: string | null;
    imei2?: string | null;
  }> | null;
}

/**
 * Checks if all words in `rawQuery` match the product fields in any order.
 */
export function matchProductTokens(product: ProductSearchable, rawQuery: string): boolean {
  if (!rawQuery || !rawQuery.trim()) return true;
  if (!product) return false;

  const tokens = rawQuery.toLowerCase().trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return true;

  const name = (product.name || "").toLowerCase();
  const code = (product.code || product.sku || "").toLowerCase();
  const shelf = (product.shelf_location || "").toLowerCase();
  const customName = (product.custom_name || "").toLowerCase();
  const formulation = (product.formulations?.name || "").toLowerCase();

  // Brand Name
  let brand = (product.brand_name || "").toLowerCase();
  if (!brand && product.brands) {
    if (Array.isArray(product.brands)) {
      brand = (product.brands[0]?.name || "").toLowerCase();
    } else {
      brand = (product.brands.name || "").toLowerCase();
    }
  }

  // Category Name
  let category = (product.category_name || "").toLowerCase();
  if (!category && product.categories) {
    if (Array.isArray(product.categories)) {
      category = (product.categories[0]?.name || "").toLowerCase();
    } else {
      category = (product.categories.name || "").toLowerCase();
    }
  }

  // Translated / Localized names
  let transNames = "";
  if (product.translated_names && typeof product.translated_names === "object") {
    transNames = Object.values(product.translated_names).join(" ").toLowerCase();
  }

  // Barcodes
  const barcodes = (product.product_barcodes || [])
    .map((b) => (b.barcode || "").toLowerCase())
    .join(" ");

  // Variants & Variant Barcodes
  const variants = (product.product_variants || [])
    .map((v) => {
      const vName = (v.packing_name || v.name || "").toLowerCase();
      const vBarcodes = (v.product_barcodes || []).map((b) => (b.barcode || "").toLowerCase()).join(" ");
      return `${vName} ${vBarcodes}`;
    })
    .join(" ");

  // IMEIs (Mobile Shops)
  const imeis = (product.product_imeis || [])
    .map((i) => `${i.imei1 || ""} ${i.imei2 || ""}`.toLowerCase())
    .join(" ");

  // Full unified searchable block
  const fullHaystack = `${name} ${code} ${shelf} ${brand} ${category} ${formulation} ${customName} ${transNames} ${barcodes} ${variants} ${imeis}`.toLowerCase();

  // Match: EVERY single token must exist somewhere in the searchable text
  return tokens.every((token) => fullHaystack.includes(token));
}

/**
 * Calculates a relevance score for ranking search results (higher score = better match).
 */
export function scoreProductMatch(product: ProductSearchable, rawQuery: string): number {
  if (!rawQuery || !rawQuery.trim() || !product) return 0;
  const query = rawQuery.toLowerCase().trim();
  const tokens = query.split(/\s+/).filter(Boolean);
  const name = (product.name || "").toLowerCase();
  const code = (product.code || product.sku || "").toLowerCase();

  let score = 0;

  // 1. Exact Name / Code match
  if (name === query || code === query) {
    score += 2000;
  }
  // 2. Name starts with exact query
  else if (name.startsWith(query)) {
    score += 1200;
  }
  // 3. Name contains the exact full query phrase
  else if (name.includes(query)) {
    score += 800;
  }
  // 4. Code starts with query
  else if (code.startsWith(query)) {
    score += 600;
  }

  // 5. Check tokens in name
  let tokensInName = 0;
  tokens.forEach((t) => {
    if (name.includes(t)) tokensInName++;
  });

  if (tokensInName === tokens.length) {
    score += 500; // All tokens inside the name
  } else {
    score += tokensInName * 80;
  }

  // 6. Barcode exact/prefix match
  if (
    (product.product_barcodes || []).some(
      (b) => (b.barcode || "").toLowerCase() === query || (b.barcode || "").toLowerCase().startsWith(query)
    )
  ) {
    score += 1500;
  }

  // 7. Variants match (e.g. searching "type c", "128gb", "black")
  const hasVariantMatch = (product.product_variants || []).some((v) => {
    const vName = (v.packing_name || v.name || "").toLowerCase();
    return tokens.some((t) => vName.includes(t));
  });
  if (hasVariantMatch) {
    score += 150;
  }

  return score;
}

/**
 * Helper to filter and sort a list of products by relevance.
 */
export function filterAndRankProducts<T extends ProductSearchable>(
  products: T[],
  query: string,
  options?: {
    categoryId?: string;
    brandId?: string;
  }
): T[] {
  if (!products || products.length === 0) return [];
  const trimmed = (query || "").trim();

  return products
    .filter((p) => {
      if (options?.categoryId && options.categoryId !== "all" && p.category_id !== options.categoryId) {
        return false;
      }
      if (options?.brandId && options.brandId !== "all" && p.brand_id !== options.brandId) {
        return false;
      }
      if (!trimmed) return true;
      return matchProductTokens(p, trimmed);
    })
    .sort((a, b) => {
      if (!trimmed) return 0;
      return scoreProductMatch(b, trimmed) - scoreProductMatch(a, trimmed);
    });
}
