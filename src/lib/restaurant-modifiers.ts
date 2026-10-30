"use client";

import type { SupabaseClient } from "@supabase/supabase-js";

export type RestaurantModifier = {
  id: string;
  shop_id: string;
  name: string;
  price_add: number;
  is_active: boolean;
  sort_order: number;
  applies_to: string; // "all" | category id later
};

export const DEFAULT_RESTAURANT_MODIFIERS: Omit<
  RestaurantModifier,
  "id" | "shop_id"
>[] = [
  { name: "Extra Cheese", price_add: 60, is_active: true, sort_order: 1, applies_to: "all" },
  { name: "Extra Patty/Filling", price_add: 100, is_active: true, sort_order: 2, applies_to: "all" },
  { name: "Mayo Dip", price_add: 30, is_active: true, sort_order: 3, applies_to: "all" },
  { name: "Salad Pack", price_add: 35, is_active: true, sort_order: 4, applies_to: "all" },
  { name: "Spicy", price_add: 0, is_active: true, sort_order: 5, applies_to: "all" },
  { name: "Less Oil", price_add: 0, is_active: true, sort_order: 6, applies_to: "all" },
];

export async function fetchRestaurantModifiers(
  supabase: SupabaseClient,
  shopId: string
): Promise<{ name: string; priceAdd: number; id?: string }[]> {
  const { data, error } = await supabase
    .from("restaurant_modifiers")
    .select("id, name, price_add, is_active, sort_order")
    .eq("shop_id", shopId)
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  if (error || !data || data.length === 0) {
    // Table missing or empty → safe POS fallback
    return DEFAULT_RESTAURANT_MODIFIERS.filter((m) => m.is_active).map((m) => ({
      name: m.name,
      priceAdd: m.price_add,
    }));
  }

  return data.map((m) => ({
    id: m.id,
    name: m.name,
    priceAdd: Number(m.price_add) || 0,
  }));
}

export async function seedDefaultModifiers(
  supabase: SupabaseClient,
  shopId: string
): Promise<number> {
  const { count } = await supabase
    .from("restaurant_modifiers")
    .select("id", { count: "exact", head: true })
    .eq("shop_id", shopId);

  if ((count || 0) > 0) return 0;

  const rows = DEFAULT_RESTAURANT_MODIFIERS.map((m) => ({
    shop_id: shopId,
    name: m.name,
    price_add: m.price_add,
    is_active: m.is_active,
    sort_order: m.sort_order,
    applies_to: m.applies_to,
  }));

  const { error } = await supabase.from("restaurant_modifiers").insert(rows);
  if (error) throw error;
  return rows.length;
}

export type VenuePresetId = "dhaba" | "cafe" | "pizza" | "bakery" | "fine_dining";

export const VENUE_PRESETS: Record<
  VenuePresetId,
  { label: string; tables: { name: string; capacity: number }[]; categories: string[] }
> = {
  dhaba: {
    label: "Dhaba / Roadside",
    tables: [
      { name: "T1", capacity: 4 },
      { name: "T2", capacity: 4 },
      { name: "T3", capacity: 6 },
      { name: "T4", capacity: 8 },
      { name: "Outdoor", capacity: 10 },
    ],
    categories: ["Breakfast", "Desi Mains", "Roti & Naan", "Drinks", "Tea"],
  },
  cafe: {
    label: "Cafe / Juice Bar",
    tables: [
      { name: "Window 1", capacity: 2 },
      { name: "Window 2", capacity: 2 },
      { name: "Sofa A", capacity: 4 },
      { name: "Sofa B", capacity: 4 },
      { name: "Counter", capacity: 1 },
    ],
    categories: ["Coffee", "Mocktails", "Sandwiches", "Desserts", "Snacks"],
  },
  pizza: {
    label: "Pizza / Fast Food",
    tables: [
      { name: "P1", capacity: 4 },
      { name: "P2", capacity: 4 },
      { name: "P3", capacity: 6 },
      { name: "Family", capacity: 8 },
      { name: "Takeaway Queue", capacity: 1 },
    ],
    categories: ["Pizza", "Burgers", "Fries & Sides", "Deals", "Drinks"],
  },
  bakery: {
    label: "Bakery & Sweets",
    tables: [
      { name: "Pickup 1", capacity: 1 },
      { name: "Pickup 2", capacity: 1 },
      { name: "Cafe Seat 1", capacity: 2 },
      { name: "Cafe Seat 2", capacity: 2 },
    ],
    categories: ["Bread", "Cakes", "Sweets", "Snacks", "Packaged"],
  },
  fine_dining: {
    label: "Large / Fine Dining",
    tables: [
      { name: "A1", capacity: 2 },
      { name: "A2", capacity: 2 },
      { name: "B1", capacity: 4 },
      { name: "B2", capacity: 4 },
      { name: "VIP", capacity: 8 },
      { name: "Banquet", capacity: 12 },
    ],
    categories: ["Starters", "Mains", "Grill", "Dessert", "Bar"],
  },
};

export async function applyVenuePreset(
  supabase: SupabaseClient,
  shopId: string,
  presetId: VenuePresetId
): Promise<{ tables: number; categories: number; modifiers: number }> {
  const preset = VENUE_PRESETS[presetId];
  if (!preset) throw new Error("Unknown venue preset");

  const { count: tableCount } = await supabase
    .from("restaurant_tables")
    .select("id", { count: "exact", head: true })
    .eq("shop_id", shopId);

  let tablesAdded = 0;
  if ((tableCount || 0) === 0) {
    const { error } = await supabase.from("restaurant_tables").insert(
      preset.tables.map((t) => ({
        shop_id: shopId,
        name: t.name,
        capacity: t.capacity,
        status: "available",
      }))
    );
    if (error) throw error;
    tablesAdded = preset.tables.length;
  }

  // Categories: use product_categories if present, else skip silently
  let categoriesAdded = 0;
  const { data: existingCats } = await supabase
    .from("categories")
    .select("id, name")
    .eq("shop_id", shopId);

  const existingNames = new Set(
    (existingCats || []).map((c) => String(c.name).toLowerCase())
  );
  const newCats = preset.categories.filter(
    (n) => !existingNames.has(n.toLowerCase())
  );
  if (newCats.length > 0) {
    const { error } = await supabase.from("categories").insert(
      newCats.map((name) => ({ shop_id: shopId, name }))
    );
    if (!error) categoriesAdded = newCats.length;
  }

  const modifiers = await seedDefaultModifiers(supabase, shopId);
  return { tables: tablesAdded, categories: categoriesAdded, modifiers };
}
