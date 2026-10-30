import type { PosCheckoutItem, PosCheckoutPayload } from "./types";

export type CartLikeItem = {
  productId: string;
  variantId?: string;
  name: string;
  isCustomItem?: boolean;
  packingName?: string;
  price: number;
  quantity: number;
  discount?: number;
  discountType?: "percentage" | "fixed";
  has_imei?: boolean;
  warranty?: string;
  selectedImeis?: Array<{ id: string; imei1: string; imei2?: string | null }>;
  conversionFactor?: number;
  unitType?: "multiplier" | "divisor";
  purchasePrice?: number;
  batchNumber?: string | null;
  expiryDate?: string | null;
  batchId?: string | null;
  shelfLocation?: string | null;
};

export type ProductLike = {
  id: string;
  product_variants?: Array<{
    id: string;
    is_packing?: boolean;
    pack_size?: number | null;
  }>;
};

function lineSubtotal(item: CartLikeItem): number {
  const discVal = item.discount || 0;
  const gross = item.price * item.quantity;
  return Math.max(
    0,
    item.discountType === "percentage" ? gross - (gross * discVal) / 100 : gross - discVal
  );
}

function stockQtyForItem(item: CartLikeItem): number {
  let qty = item.quantity;
  if (item.variantId?.startsWith("auto-") && item.conversionFactor) {
    if (item.unitType === "divisor") {
      qty = item.quantity / item.conversionFactor;
    } else {
      qty = item.quantity * item.conversionFactor;
    }
  }
  return qty;
}

export function buildPosCheckoutItems(
  cart: CartLikeItem[],
  products: ProductLike[]
): PosCheckoutItem[] {
  return cart.map((item) => {
    const isCustom = !!item.isCustomItem || item.productId?.startsWith("custom-");
    const variantId =
      !isCustom && item.variantId && !item.variantId.startsWith("auto-") ? item.variantId : null;
    const product = isCustom ? undefined : products.find((p) => p.id === item.productId);
    const variant = variantId
      ? product?.product_variants?.find((v) => v.id === variantId)
      : undefined;

    return {
      product_id: isCustom ? null : item.productId,
      custom_name: isCustom ? item.name : null,
      variant_id: variantId,
      quantity: item.quantity,
      unit_price: item.price,
      purchase_price: item.purchasePrice || 0,
      subtotal: lineSubtotal(item),
      packing_name: item.packingName || null,
      warranty: item.warranty || null,
      sold_imeis:
        item.has_imei && item.selectedImeis && item.selectedImeis.length > 0
          ? item.selectedImeis
              .map(
                (i) =>
                  `IMEI 1: ${i.imei1}` + (i.imei2 ? `, IMEI 2: ${i.imei2}` : "")
              )
              .join(" | ")
          : null,
      stock_qty: isCustom ? 0 : stockQtyForItem(item),
      is_packing: !!variant?.is_packing,
      pack_size: variant?.pack_size ?? null,
      imei_ids: item.selectedImeis?.map((i) => i.id) || [],
      batch_number: item.batchNumber || null,
      expiry_date: item.expiryDate || null,
      shelf_location: item.shelfLocation || null,
    };
  });
}

export function buildPosCheckoutPayload(args: {
  shopId: string;
  cart: CartLikeItem[];
  products: ProductLike[];
  customerId: string | null;
  total: number;
  taxAmount: number;
  discountRupees: number;
  paidAmount: number;
  invoiceStatus: string;
  paymentMode: string;
  registerSessionId: string | null;
  accountId: string | null;
  remarks: string | null;
  creditAmount: number;
  cashAmount: number;
  giftCardId?: string | null;
  giftCardAmount?: number;
  loyaltyDelta?: number;
  isQuotation?: boolean;
  editInvoiceId?: string | null;
  invoiceId?: string;
  emiSchedules?: Array<{ dueDate: string; amount: number }>;
  operatorName?: string;
}): PosCheckoutPayload {
  const invoiceId = args.invoiceId || crypto.randomUUID();

  return {
    invoice: {
      id: invoiceId,
      shop_id: args.shopId,
      party_id: args.customerId,
      total_amount: args.total,
      discount_amount: args.discountRupees,
      tax_amount: args.taxAmount,
      payment_mode: args.paymentMode,
      register_session_id: args.registerSessionId,
      account_id: args.accountId,
      remarks: args.remarks,
      status: args.invoiceStatus,
      edit_invoice_id: args.editInvoiceId || null,
    },
    items: buildPosCheckoutItems(args.cart, args.products),
    payment: {
      cash_amount: args.cashAmount,
      credit_amount: args.creditAmount,
      gift_card_id: args.giftCardId || null,
      gift_card_amount: args.giftCardAmount || 0,
      loyalty_points_delta: args.loyaltyDelta || 0,
      operator_name: args.operatorName || "Operator",
      emi_schedules: (args.emiSchedules || []).map((s) => ({
        due_date: s.dueDate,
        amount: s.amount,
        status: "unpaid",
      })),
    },
    side_effects: {
      is_quotation: !!args.isQuotation,
    },
  };
}
