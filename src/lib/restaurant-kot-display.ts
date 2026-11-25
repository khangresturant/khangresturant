import { receiptSizeColumnValue } from "@/lib/restaurant-receipt-size";

/** Kitchen line label: size merged into name when not already present. */
export function mergeSizeIntoKitchenDisplayName(
  name: string,
  sizeLabel?: string | null
): string {
  const base = (name || "Item").trim();
  const col = receiptSizeColumnValue(base, sizeLabel);
  if (!col) return base;
  return `${base} (${col})`;
}