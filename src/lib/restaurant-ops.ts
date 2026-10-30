"use client";

import type { SupabaseClient } from "@supabase/supabase-js";

export const CRUST_OPTIONS = [
  "Regular",
  "Thin Crust",
  "Pan",
  "Cheese Burst",
  "Stuffed",
] as const;

export type RestaurantStation = {
  id: string;
  shop_id: string;
  name: string;
  kitchen_hub: string | null;
  sort_order: number;
  is_active: boolean;
};

export const DEFAULT_STATIONS = [
  { name: "Grill", kitchen_hub: "Main Kitchen", sort_order: 1 },
  { name: "Fry", kitchen_hub: "Main Kitchen", sort_order: 2 },
  { name: "Oven / Pizza", kitchen_hub: "Main Kitchen", sort_order: 3 },
  { name: "Bar / Drinks", kitchen_hub: "Bar", sort_order: 4 },
  { name: "Dessert", kitchen_hub: "Pastry", sort_order: 5 },
];

export async function fetchStations(
  supabase: SupabaseClient,
  shopId: string
): Promise<RestaurantStation[]> {
  const { data, error } = await supabase
    .from("restaurant_stations")
    .select("id, shop_id, name, kitchen_hub, sort_order, is_active")
    .eq("shop_id", shopId)
    .eq("is_active", true)
    .order("sort_order", { ascending: true });
  if (error || !data) return [];
  return data as RestaurantStation[];
}

export async function seedDefaultStations(
  supabase: SupabaseClient,
  shopId: string
): Promise<number> {
  const { count } = await supabase
    .from("restaurant_stations")
    .select("id", { count: "exact", head: true })
    .eq("shop_id", shopId);
  if ((count || 0) > 0) return 0;
  const { error } = await supabase.from("restaurant_stations").insert(
    DEFAULT_STATIONS.map((s) => ({
      shop_id: shopId,
      name: s.name,
      kitchen_hub: s.kitchen_hub,
      sort_order: s.sort_order,
      is_active: true,
    }))
  );
  if (error) throw error;
  return DEFAULT_STATIONS.length;
}

export type ReservationRow = {
  id: string;
  shop_id: string;
  guest_name: string;
  guest_phone: string | null;
  party_size: number;
  reserved_at: string;
  table_id: string | null;
  notes: string | null;
  status: "booked" | "seated" | "cancelled" | "no_show" | "completed";
};

export const P1P2_MIGRATION_SQL = `
-- Floors / sections on tables
ALTER TABLE restaurant_tables ADD COLUMN IF NOT EXISTS floor_name VARCHAR(50) DEFAULT 'Ground';
ALTER TABLE restaurant_tables ADD COLUMN IF NOT EXISTS section_name VARCHAR(50);

-- Kitchen stations (multi-kitchen hubs)
CREATE TABLE IF NOT EXISTS restaurant_stations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id UUID REFERENCES shops(id) ON DELETE CASCADE,
    name VARCHAR(80) NOT NULL,
    kitchen_hub VARCHAR(100),
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE kitchen_orders ADD COLUMN IF NOT EXISTS station_id UUID REFERENCES restaurant_stations(id) ON DELETE SET NULL;
ALTER TABLE kitchen_orders ADD COLUMN IF NOT EXISTS kitchen_hub VARCHAR(100);
ALTER TABLE products ADD COLUMN IF NOT EXISTS kitchen_station_id UUID;

-- Size / pizza variants
ALTER TABLE restaurant_menu_sizes ADD COLUMN IF NOT EXISTS crust_options TEXT;
ALTER TABLE restaurant_menu_sizes ADD COLUMN IF NOT EXISTS variant_label VARCHAR(50);

-- Tips
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS tip_amount NUMERIC(15, 2) DEFAULT 0;

-- Reservations
CREATE TABLE IF NOT EXISTS restaurant_reservations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id UUID REFERENCES shops(id) ON DELETE CASCADE,
    guest_name VARCHAR(120) NOT NULL,
    guest_phone VARCHAR(40),
    party_size INTEGER DEFAULT 2,
    reserved_at TIMESTAMPTZ NOT NULL,
    table_id UUID REFERENCES restaurant_tables(id) ON DELETE SET NULL,
    notes TEXT,
    status VARCHAR(30) DEFAULT 'booked',
    created_at TIMESTAMPTZ DEFAULT now()
);

-- QR guest order requests (lightweight)
CREATE TABLE IF NOT EXISTS restaurant_qr_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id UUID REFERENCES shops(id) ON DELETE CASCADE,
    table_id UUID REFERENCES restaurant_tables(id) ON DELETE SET NULL,
    guest_name VARCHAR(120),
    items_json TEXT NOT NULL,
    notes TEXT,
    status VARCHAR(30) DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE restaurant_stations ENABLE ROW LEVEL SECURITY;
ALTER TABLE restaurant_reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE restaurant_qr_orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "restaurant_stations_all" ON restaurant_stations;
CREATE POLICY "restaurant_stations_all" ON restaurant_stations FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "restaurant_reservations_all" ON restaurant_reservations;
CREATE POLICY "restaurant_reservations_all" ON restaurant_reservations FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "restaurant_qr_orders_all" ON restaurant_qr_orders;
CREATE POLICY "restaurant_qr_orders_all" ON restaurant_qr_orders FOR ALL TO authenticated USING (true) WITH CHECK (true);
-- Public insert for QR (anon) — enable if using anon key on public page
DROP POLICY IF EXISTS "restaurant_qr_orders_insert_anon" ON restaurant_qr_orders;
CREATE POLICY "restaurant_qr_orders_insert_anon" ON restaurant_qr_orders FOR INSERT TO anon WITH CHECK (true);
DROP POLICY IF EXISTS "restaurant_qr_orders_select_anon" ON restaurant_qr_orders;
CREATE POLICY "restaurant_qr_orders_select_anon" ON restaurant_qr_orders FOR SELECT TO anon USING (true);
`;

const OFFLINE_TAKEAWAY_KEY = "restaurant_offline_takeaway_queue";

export type OfflineTakeawayDraft = {
  id: string;
  shopId: string;
  createdAt: string;
  customerName: string;
  customerPhone: string;
  cart: {
    productId: string;
    name: string;
    price: number;
    quantity: number;
    remarks: string;
  }[];
  notes?: string;
};

export function loadOfflineTakeawayQueue(shopId: string): OfflineTakeawayDraft[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(OFFLINE_TAKEAWAY_KEY);
    const all: OfflineTakeawayDraft[] = raw ? JSON.parse(raw) : [];
    return all.filter((d) => d.shopId === shopId);
  } catch {
    return [];
  }
}

export function saveOfflineTakeawayDraft(draft: OfflineTakeawayDraft) {
  if (typeof window === "undefined") return;
  const raw = localStorage.getItem(OFFLINE_TAKEAWAY_KEY);
  const all: OfflineTakeawayDraft[] = raw ? JSON.parse(raw) : [];
  all.push(draft);
  localStorage.setItem(OFFLINE_TAKEAWAY_KEY, JSON.stringify(all));
}

export function clearOfflineTakeawayDraft(id: string) {
  if (typeof window === "undefined") return;
  const raw = localStorage.getItem(OFFLINE_TAKEAWAY_KEY);
  const all: OfflineTakeawayDraft[] = raw ? JSON.parse(raw) : [];
  localStorage.setItem(
    OFFLINE_TAKEAWAY_KEY,
    JSON.stringify(all.filter((d) => d.id !== id))
  );
}

export function parseCrustOptions(raw: string | null | undefined): string[] {
  if (!raw?.trim()) return [...CRUST_OPTIONS];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}
