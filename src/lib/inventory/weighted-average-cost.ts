import type { ReceivePurchaseItem } from "@/lib/money/types";

/** Incoming unit cost for one PO line (bonus spreads cost; discount reduces net). */
export function incomingUnitFromPurchaseItem(item: ReceivePurchaseItem): {
  effectiveQty: number;
  effectiveUnit: number;
} {
  const qty = Number(item.quantity ?? 0);
  const bonus = Number(item.bonus_quantity ?? 0);
  const purchasePrice = Number(item.purchase_price ?? 0);
  const discount = Number(item.discount_amount ?? 0);
  const effectiveQty = qty + bonus;

  const landed = item.landed_unit_cost;
  if (landed != null && Number.isFinite(landed) && effectiveQty > 0) {
    return { effectiveQty, effectiveUnit: Number(landed) };
  }

  const effectiveCost = Math.max(0, purchasePrice * qty - discount);
  const effectiveUnit = effectiveQty > 0 ? effectiveCost / effectiveQty : purchasePrice;
  return { effectiveQty, effectiveUnit };
}

/** (oldQty × oldCost + newQty × newCost) ÷ totalQty */
export function weightedAverageUnitCost(
  oldQty: number,
  oldUnitCost: number,
  addQty: number,
  incomingUnitCost: number
): number {
  const newQty = oldQty + addQty;
  if (newQty <= 0) return incomingUnitCost;
  const blended = (oldQty * oldUnitCost + addQty * incomingUnitCost) / newQty;
  return Math.round(blended * 10000) / 10000;
}

type StockRow = Record<string, unknown>;

/** Update product/variant rows in-memory after a purchase line (WAC + stock). */
export function applyPurchaseLineStockWac(
  item: ReceivePurchaseItem,
  products: StockRow[],
  variants: StockRow[]
): void {
  const { effectiveQty, effectiveUnit } = incomingUnitFromPurchaseItem(item);
  if (effectiveQty <= 0) return;

  const salePrice =
    item.sale_price === null || item.sale_price === undefined
      ? null
      : Number(item.sale_price);
  const packSize = Number(item.pack_size ?? 0);
  const isPacking = Boolean(item.is_packing) && packSize > 0;

  if (item.variant_id) {
    const vIdx = variants.findIndex((v) => v.id === item.variant_id);
    if (vIdx >= 0) {
      const v = variants[vIdx];
      const oldVarStock = Number(v.stock_quantity ?? 0);
      const oldVarPrice = Number(v.purchase_price ?? effectiveUnit);
      const newVarStock = oldVarStock + effectiveQty;
      const newVarPrice = weightedAverageUnitCost(
        oldVarStock,
        oldVarPrice,
        effectiveQty,
        effectiveUnit
      );
      variants[vIdx] = {
        ...v,
        stock_quantity: newVarStock,
        purchase_price: newVarPrice,
        ...(salePrice != null ? { sale_price: salePrice } : {}),
      };
    }

    if (isPacking) {
      const pIdx = products.findIndex((pr) => pr.id === item.product_id);
      if (pIdx >= 0) {
        const pr = products[pIdx];
        const pricePerBase = effectiveUnit / packSize;
        const addBaseUnits = effectiveQty * packSize;
        const oldProdStock = Number(pr.current_stock ?? 0);
        const oldProdPrice = Number(pr.purchase_price_single ?? pricePerBase);
        const newProdStock = oldProdStock + addBaseUnits;
        const newProdPrice = weightedAverageUnitCost(
          oldProdStock,
          oldProdPrice,
          addBaseUnits,
          pricePerBase
        );
        products[pIdx] = {
          ...pr,
          current_stock: newProdStock,
          purchase_price_single: newProdPrice,
          ...(salePrice != null ? { sale_price_single: salePrice } : {}),
        };
      }
    } else {
      const pIdx = products.findIndex((pr) => pr.id === item.product_id);
      if (pIdx >= 0) {
        const sum = variants
          .filter((v) => v.product_id === item.product_id)
          .reduce((acc, v) => acc + Number(v.stock_quantity ?? 0), 0);
        products[pIdx] = { ...products[pIdx], current_stock: sum };
      }
    }
    return;
  }

  const pIdx = products.findIndex((pr) => pr.id === item.product_id);
  if (pIdx < 0) return;
  const pr = products[pIdx];
  const oldStock = Number(pr.current_stock ?? 0);
  const oldPrice = Number(pr.purchase_price_single ?? effectiveUnit);
  const newStock = oldStock + effectiveQty;
  const newPrice = weightedAverageUnitCost(oldStock, oldPrice, effectiveQty, effectiveUnit);
  products[pIdx] = {
    ...pr,
    current_stock: newStock,
    purchase_price_single: newPrice,
    ...(salePrice != null ? { sale_price_single: salePrice } : {}),
  };
}
