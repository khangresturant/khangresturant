export const MENU_SIZE_OPTIONS = ["Small", "Medium", "Large", "XL"] as const;

export type MenuSizeName = (typeof MENU_SIZE_OPTIONS)[number];

export type RestaurantDeal = {
  id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  original_price: number;
  deal_price: number;
  discount_percentage: number;
  is_active: boolean;
  restaurant_deal_items?: {
    id: string;
    product_id: string | null;
    quantity: number;
    size_name: string | null;
    item_type: string;
    products?: { name: string } | null;
  }[];
};

export type MenuSize = {
  id: string;
  product_id: string;
  size_name: string;
  size_description: string | null;
  price: number;
  is_available: boolean;
  sort_order: number;
  products?: { name: string } | null;
};

export type WaiterCall = {
  id: string;
  table_id: string | null;
  invoice_id: string | null;
  message: string;
  call_type: string;
  status: string;
  created_at: string;
  restaurant_tables?: { name: string } | null;
};

export function dealSavingsPercent(original: number, deal: number): number {
  if (original <= 0) return 0;
  return Math.round(((original - deal) / original) * 100);
}

export function formatDealLabel(deal: RestaurantDeal): string {
  const save = dealSavingsPercent(Number(deal.original_price), Number(deal.deal_price));
  return `${deal.name} — Rs ${Number(deal.deal_price).toLocaleString()} (save ${save}%)`;
}
