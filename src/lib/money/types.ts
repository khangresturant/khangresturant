/** Payload types for Phase 2 money RPCs */

export type PosCheckoutItem = {
  product_id?: string | null;
  custom_name?: string | null;
  variant_id?: string | null;
  quantity: number;
  unit_price: number;
  subtotal: number;
  packing_name?: string | null;
  warranty?: string | null;
  sold_imeis?: string | null;
  /** Quantity to apply to stock (base units / conversion already applied) */
  stock_qty: number;
  is_packing?: boolean;
  pack_size?: number | null;
  imei_ids?: string[];
  purchase_price?: number;
  batch_number?: string | null;
  expiry_date?: string | null;
  shelf_location?: string | null;
};

export type PosCheckoutInvoice = {
  id: string;
  shop_id: string;
  party_id?: string | null;
  total_amount: number;
  discount_amount: number;
  tax_amount: number;
  payment_mode: string;
  register_session_id?: string | null;
  account_id?: string | null;
  remarks?: string | null;
  status: string;
  edit_invoice_id?: string | null;
};

export type PosCheckoutPayment = {
  cash_amount: number;
  credit_amount: number;
  gift_card_id?: string | null;
  gift_card_amount: number;
  loyalty_points_delta: number;
  operator_name?: string;
  emi_schedules: Array<{ due_date: string; amount: number; status?: string }>;
};

export type PosCheckoutSideEffects = {
  is_quotation?: boolean;
  client_meta?: Record<string, any>;
};

export type PosCheckoutPayload = {
  invoice: PosCheckoutInvoice;
  items: PosCheckoutItem[];
  payment: PosCheckoutPayment;
  side_effects?: PosCheckoutSideEffects;
};

export type PosCheckoutResult = {
  invoice_id: string;
  created_at?: string;
  status?: string;
  idempotent?: boolean;
};

export type PartyPaymentPayload = {
  shop_id: string;
  party_id: string;
  amount: number;
  balance_diff: number;
  transaction_type: string;
  account_id?: string | null;
  account_tx_type?: "deposit" | "withdrawal";
  remarks?: string;
};

export type ReceivePurchaseItem = {
  product_id: string;
  variant_id?: string | null;
  quantity: number;
  bonus_quantity?: number;
  purchase_price: number;
  sale_price?: number | null;
  discount_amount?: number;
  batch_number?: string | null;
  expiry_date?: string | null;
  is_packing?: boolean;
  pack_size?: number | null;
  imeis?: Array<{ imei1: string; imei2?: string | null }> | null;
};

export type ReceivePurchasePayload = {
  purchase_order_id?: string;
  shop_id: string;
  supplier_id?: string | null;
  total_amount: number;
  paid_amount: number;
  discount?: number;
  tax_amount?: number;
  status: string;
  payment_mode: string;
  notes?: string | null;
  invoice_number?: string | null;
  account_id?: string | null;
  items: ReceivePurchaseItem[];
};
