// Shared types for the Purchase module

export type DBProduct = {
  id: string;
  name: string;
  code: string | null;
  unit: string | null;
  purchase_price_single: number;
  sale_price_single: number;
  current_stock: number;
  category_id: string | null;
  pack_size?: number | null;
  product_variants?: {
    id: string;
    packing_name: string;
    purchase_price: number;
    sale_price: number;
    stock_quantity: number;
    is_packing?: boolean;
    pack_size?: number | null;
  }[];
};

export type Supplier = {
  id: string;
  name: string;
  phone: string | null;
  current_balance: number;
  address: string | null;
};

export type Category = { id: string; name: string };

export type CartItem = {
  productId: string;
  variantId?: string;
  name: string;
  packingName?: string;
  purchasePrice: number;
  quantity: number;
  stock: number;
  salePrice?: number;
};

export type PurchaseOrder = {
  id: string;
  created_at: string;
  total_amount: number;
  paid_amount: number;
  discount: number;
  tax_amount: number;
  status: string;
  payment_mode: string;
  notes: string | null;
  invoice_number: string | null;
  is_voided: boolean;
  supplier_id: string | null;
  supplierName?: string;
  itemCount?: number;
};

export type PODetailItem = {
  id: string;
  product_id: string;
  variant_id: string | null;
  quantity: number;
  unit_price: number;
  subtotal: number;
  productName: string;
  unit: string;
  variantName: string;
};
