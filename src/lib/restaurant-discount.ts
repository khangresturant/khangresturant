/** Order-level discount rules (matches POSRESTURANT discountable subtotal). */

export type DiscountableLine = {
  unitPrice: number;
  quantity: number;
  /** When true, line is excluded from % and fixed order discount */
  notDiscounted?: boolean;
};

export function cartDiscountableSubtotal(lines: DiscountableLine[]): number {
  return lines.reduce((sum, line) => {
    if (line.notDiscounted) return sum;
    return sum + line.unitPrice * line.quantity;
  }, 0);
}

/**
 * Apply the greater of percentage discount or fixed discount,
 * capped so fixed discount cannot exceed discountable subtotal.
 */
export function computeRestaurantOrderDiscount(
  discountableSubtotal: number,
  fixedDiscount: number,
  discountPercent: number
): number {
  const sub = Math.max(0, discountableSubtotal);
  const pctAmount = (sub * Math.max(0, discountPercent)) / 100;
  const fixedCapped = Math.min(Math.max(0, fixedDiscount), sub);
  return Math.max(pctAmount, fixedCapped);
}
