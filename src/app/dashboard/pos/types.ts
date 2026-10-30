export type DBProduct = {
  id: string;
  name: string;
  code: string | null;
  unit: string | null;
  sale_price_single: number;
  purchase_price_single: number;
  current_stock: number;
  pack_size?: number | null;
  min_stock_level?: number | null;
  category_id?: string | null;
  measurement_type?: "standard" | "dimension" | "length" | null;
  has_imei?: boolean | null;
  formulation_id?: string | null;
  formulations?: any;
  warranty?: string | null;
  product_barcodes?: { barcode: string }[];
  product_variants?: {
    id: string;
    packing_name: string;
    sale_price: number;
    purchase_price: number;
    stock_quantity: number;
    is_packing?: boolean;
    pack_size?: number | null;
    product_barcodes?: { barcode: string }[];
  }[];
  translated_names?: any;
  note?: string | null;
  image_url?: string | null;
  shelf_location?: string | null;
};


export type Party = {
  id: string;
  name: string;
  phone: string | null;
  current_balance: number;
  address?: string | null;
  type?: string | null;
  credit_limit?: number | null;
  loyalty_points?: number | null;
};

export type Category = {
  id: string;
  name: string;
};

export type ProductBatch = {
  id: string;
  product_id: string;
  batch_number: string | null;
  expiry_date: string | null;
  stock_quantity: number;
  purchase_price?: number;
  sale_price?: number;
};

export type CartItem = {
  productId: string;
  variantId?: string;
  name: string;
  packingName?: string;
  price: number;
  purchasePrice: number;
  quantity: number;
  stock: number;
  isAutoSubunit?: boolean;
  conversionFactor?: number;
  unitType?: "multiplier" | "divisor";
  has_imei?: boolean;
  warranty?: string;
  selectedImeis?: Array<{ id: string; imei1: string; imei2?: string | null }>;
  translated_names?: any;
  note?: string | null;
  discount?: number;
  discountType?: "percentage" | "fixed";
  batchNumber?: string | null;
  expiryDate?: string | null;
  batchId?: string | null;
  availableBatches?: ProductBatch[];
  shelfLocation?: string | null;
  syncPriceToCatalog?: boolean;
  isCustomItem?: boolean;
};
