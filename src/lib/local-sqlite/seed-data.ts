export const FLAME9_LOCAL_SHOP_ID = "flame9-shop-local";
export const FLAME9_LOCAL_USER_ID = "flame9-admin-local";
export const FLAME9_STAFF_USER_ID = "flame9-staff-local";
export const FLAME9_RIDER_USER_ID = "flame9-rider-local";

export const FLAME9_STATION_IDS = {
  grill: "st-grill",
  fry: "st-fry",
  oven: "st-oven",
  bar: "st-bar",
  dessert: "st-dessert",
} as const;

const FLAME9_PIZZA_CRUSTS = "Regular,Thin Crust,Pan,Cheese Burst,Stuffed";

/** Default logins when using local SQLite (no cloud Supabase). */
export const FLAME9_LOCAL_LOGINS = {
  admin: { email: "admin@flame9.pizza", password: "admin123", role: "superadmin", name: "Flame 9 Admin" },
  staff: { email: "staff@flame9.pizza", password: "staff123", role: "staff", name: "POS Staff" },
} as const;

export function getFlame9SeedData(tableName: string): unknown[] {
  const shopId = FLAME9_LOCAL_SHOP_ID;
  const userId = FLAME9_LOCAL_USER_ID;

  switch (tableName) {
    case "shops":
      return [
        {
          id: shopId,
          name: "Flame 9 Pizza House & Café",
          industry_type: "restaurant",
          subscription_tier: "premium",
          subscription_expires_at: null,
          allow_negative_stock: true,
          has_loyalty: true,
          has_gift_cards: false,
          has_ecommerce: false,
        },
      ];
    case "user_profiles":
      return [
        {
          id: userId,
          shop_id: shopId,
          name: FLAME9_LOCAL_LOGINS.admin.name,
          email: FLAME9_LOCAL_LOGINS.admin.email,
          role: "superadmin",
          permissions: {
            panels: {
              dashboard: true,
              pos: true,
              sales: true,
              registers: true,
              purchase: true,
              products: true,
              categories: true,
              brands: true,
              units: true,
              khata: true,
              returns: true,
              expenses: true,
              accounts: true,
              reports: true,
              staff: true,
              backup: true,
            },
            actions: {
              edit_bill: true,
              delete_bill: true,
              edit_account: true,
              delete_account: true,
            },
          },
        },
        {
          id: FLAME9_STAFF_USER_ID,
          shop_id: shopId,
          name: FLAME9_LOCAL_LOGINS.staff.name,
          email: FLAME9_LOCAL_LOGINS.staff.email,
          role: "staff",
          permissions: {
            panels: {
              dashboard: true,
              pos: true,
              sales: true,
              registers: true,
              purchase: false,
              products: false,
              categories: false,
              brands: false,
              units: false,
              khata: false,
              returns: true,
              expenses: false,
              accounts: false,
              reports: false,
              staff: false,
              backup: false,
            },
            actions: { edit_bill: false, delete_bill: false, edit_account: false, delete_account: false },
          },
        },
        {
          id: FLAME9_RIDER_USER_ID,
          shop_id: shopId,
          name: "Ali Rider",
          email: "rider@flame9.pizza",
          role: "rider",
          phone: "0300-1112233",
          permissions: {
            panels: { dashboard: true, pos: true, sales: true },
            actions: { edit_bill: false, delete_bill: false },
          },
        },
      ];
    case "categories":
      return [
        { id: "cat-pizza", shop_id: shopId, name: "Pizza" },
        { id: "cat-cafe", shop_id: shopId, name: "Café" },
        { id: "cat-deals", shop_id: shopId, name: "Deals" },
        { id: "cat-raw", shop_id: shopId, name: "Raw Materials" },
      ];
    case "products":
      return [
        {
          id: "prod-margherita",
          shop_id: shopId,
          name: "Margherita Medium",
          unit: "pcs",
          purchase_price_single: 450,
          sale_price_single: 899,
          current_stock: 0,
          min_stock_level: 0,
          category_id: "cat-pizza",
          kitchen_station_id: FLAME9_STATION_IDS.oven,
          is_ingredient: false,
          not_discounted: false,
          show_in_restaurant_pos: true,
        },
        {
          id: "prod-pepperoni",
          shop_id: shopId,
          name: "Pepperoni Large",
          unit: "pcs",
          purchase_price_single: 550,
          sale_price_single: 1199,
          current_stock: 0,
          min_stock_level: 0,
          category_id: "cat-pizza",
          kitchen_station_id: FLAME9_STATION_IDS.oven,
          is_ingredient: false,
          not_discounted: false,
          show_in_restaurant_pos: true,
        },
        {
          id: "prod-latte",
          shop_id: shopId,
          name: "Café Latte",
          unit: "pcs",
          purchase_price_single: 120,
          sale_price_single: 450,
          current_stock: 0,
          min_stock_level: 0,
          category_id: "cat-cafe",
          kitchen_station_id: FLAME9_STATION_IDS.bar,
          is_ingredient: false,
          not_discounted: false,
          show_in_restaurant_pos: true,
        },
        {
          id: "ing-dough",
          shop_id: shopId,
          name: "Pizza Dough Ball",
          unit: "pcs",
          purchase_price_single: 85,
          sale_price_single: 0,
          current_stock: 200,
          min_stock_level: 30,
          category_id: "cat-raw",
          is_ingredient: true,
          note: "RAW_INGREDIENT",
        },
        {
          id: "ing-tomato-sauce",
          shop_id: shopId,
          name: "Tomato Pizza Sauce",
          unit: "kg",
          purchase_price_single: 320,
          sale_price_single: 0,
          current_stock: 25,
          min_stock_level: 5,
          category_id: "cat-raw",
          is_ingredient: true,
          note: "RAW_INGREDIENT",
        },
        {
          id: "ing-mozzarella",
          shop_id: shopId,
          name: "Mozzarella Cheese",
          unit: "kg",
          purchase_price_single: 1450,
          sale_price_single: 0,
          current_stock: 18,
          min_stock_level: 4,
          category_id: "cat-raw",
          is_ingredient: true,
          note: "RAW_INGREDIENT",
        },
        {
          id: "ing-pepperoni",
          shop_id: shopId,
          name: "Pepperoni Slices",
          unit: "kg",
          purchase_price_single: 2100,
          sale_price_single: 0,
          current_stock: 12,
          min_stock_level: 3,
          category_id: "cat-raw",
          is_ingredient: true,
          note: "RAW_INGREDIENT",
        },
        {
          id: "ing-coffee",
          shop_id: shopId,
          name: "Espresso Coffee Beans",
          unit: "kg",
          purchase_price_single: 3800,
          sale_price_single: 0,
          current_stock: 8,
          min_stock_level: 2,
          category_id: "cat-raw",
          is_ingredient: true,
          note: "RAW_INGREDIENT",
        },
        {
          id: "ing-milk",
          shop_id: shopId,
          name: "Fresh Milk",
          unit: "ltr",
          purchase_price_single: 220,
          sale_price_single: 0,
          current_stock: 40,
          min_stock_level: 10,
          category_id: "cat-raw",
          is_ingredient: true,
          note: "RAW_INGREDIENT",
        },
      ];
    case "product_recipes":
      return [
        { id: "rec-m1", parent_product_id: "prod-margherita", ingredient_product_id: "ing-dough", quantity: 1 },
        { id: "rec-m2", parent_product_id: "prod-margherita", ingredient_product_id: "ing-tomato-sauce", quantity: 0.12 },
        { id: "rec-m3", parent_product_id: "prod-margherita", ingredient_product_id: "ing-mozzarella", quantity: 0.15 },
        { id: "rec-p1", parent_product_id: "prod-pepperoni", ingredient_product_id: "ing-dough", quantity: 1 },
        { id: "rec-p2", parent_product_id: "prod-pepperoni", ingredient_product_id: "ing-tomato-sauce", quantity: 0.14 },
        { id: "rec-p3", parent_product_id: "prod-pepperoni", ingredient_product_id: "ing-mozzarella", quantity: 0.18 },
        { id: "rec-p4", parent_product_id: "prod-pepperoni", ingredient_product_id: "ing-pepperoni", quantity: 0.1 },
        { id: "rec-l1", parent_product_id: "prod-latte", ingredient_product_id: "ing-coffee", quantity: 0.018 },
        { id: "rec-l2", parent_product_id: "prod-latte", ingredient_product_id: "ing-milk", quantity: 0.22 },
      ];
    case "cash_accounts":
      return [
        { id: "acc-cash-flame9", shop_id: shopId, name: "Cash in Hand", current_balance: 25000 },
        { id: "acc-bank-flame9", shop_id: shopId, name: "Bank Account", current_balance: 150000 },
        { id: "acc-online-flame9", shop_id: shopId, name: "Online / JazzCash", current_balance: 12000 },
      ];
    case "register_sessions":
      return [
        {
          id: "reg-flame9-open",
          shop_id: shopId,
          user_id: userId,
          opening_balance: 5000,
          status: "open",
          opened_at: new Date().toISOString(),
        },
      ];
    case "invoice_items":
      return [];
    case "invoices":
      return [];
    case "payment_submissions":
      return [];
    case "account_transactions":
      return [];
    case "credit_transactions":
      return [];
    case "parties":
      return [{ id: "walkin", shop_id: shopId, name: "Walk-in Customer", phone: null, current_balance: 0, type: "customer" }];
    case "restaurant_tables":
      return [
        { id: "t1", shop_id: shopId, name: "T1", capacity: 4, status: "available", floor_name: "Ground" },
        { id: "t2", shop_id: shopId, name: "T2", capacity: 4, status: "available", floor_name: "Ground" },
        { id: "t3", shop_id: shopId, name: "T3", capacity: 6, status: "available", floor_name: "Family" },
      ];
    case "company_details":
      return [
        {
          id: shopId,
          shop_id: shopId,
          name: "Flame 9 Pizza House & Café",
          phone: "",
          email: "admin@flame9.pizza",
          logo_path: "/brands/flame9/logo.png",
          website: "",
        },
      ];
    case "print_settings":
      return [
        {
          id: `print-${shopId}`,
          shop_id: shopId,
          receipt_page_size: "MM80",
          receipt_font: "monospace",
          receipt_font_size: 11,
          receipt_design_settings: { activeLanguages: ["en", "ur"], billingLanguage: "en" },
        },
      ];
    case "restaurant_stations":
      return [
        { id: FLAME9_STATION_IDS.grill, shop_id: shopId, name: "Grill", kitchen_hub: "Main Kitchen", sort_order: 1, is_active: true },
        { id: FLAME9_STATION_IDS.fry, shop_id: shopId, name: "Fry", kitchen_hub: "Main Kitchen", sort_order: 2, is_active: true },
        { id: FLAME9_STATION_IDS.oven, shop_id: shopId, name: "Oven / Pizza", kitchen_hub: "Main Kitchen", sort_order: 3, is_active: true },
        { id: FLAME9_STATION_IDS.bar, shop_id: shopId, name: "Bar / Drinks", kitchen_hub: "Bar", sort_order: 4, is_active: true },
        { id: FLAME9_STATION_IDS.dessert, shop_id: shopId, name: "Dessert", kitchen_hub: "Pastry", sort_order: 5, is_active: true },
      ];
    case "kitchen_orders":
      return [];
    case "kitchen_order_items":
      return [];
    case "restaurant_modifiers":
      return [
        { id: "mod-cheese", shop_id: shopId, name: "Extra Cheese", price_add: 60, is_active: true, sort_order: 1, applies_to: "all" },
        { id: "mod-patty", shop_id: shopId, name: "Extra Patty/Filling", price_add: 100, is_active: true, sort_order: 2, applies_to: "all" },
        { id: "mod-mayo", shop_id: shopId, name: "Mayo Dip", price_add: 30, is_active: true, sort_order: 3, applies_to: "all" },
        { id: "mod-salad", shop_id: shopId, name: "Salad Pack", price_add: 35, is_active: true, sort_order: 4, applies_to: "all" },
        { id: "mod-spicy", shop_id: shopId, name: "Spicy", price_add: 0, is_active: true, sort_order: 5, applies_to: "all" },
        { id: "mod-less-oil", shop_id: shopId, name: "Less Oil", price_add: 0, is_active: true, sort_order: 6, applies_to: "all" },
      ];
    case "restaurant_menu_sizes":
      return [
        { id: "sz-marg-p", shop_id: shopId, product_id: "prod-margherita", size_name: "Personal", price: 699, sort_order: 1, is_available: true, crust_options: FLAME9_PIZZA_CRUSTS },
        { id: "sz-marg-m", shop_id: shopId, product_id: "prod-margherita", size_name: "Medium", price: 899, sort_order: 2, is_available: true, crust_options: FLAME9_PIZZA_CRUSTS },
        { id: "sz-marg-l", shop_id: shopId, product_id: "prod-margherita", size_name: "Large", price: 1099, sort_order: 3, is_available: true, crust_options: FLAME9_PIZZA_CRUSTS },
        { id: "sz-marg-f", shop_id: shopId, product_id: "prod-margherita", size_name: "Family", price: 1399, sort_order: 4, is_available: true, crust_options: FLAME9_PIZZA_CRUSTS },
        { id: "sz-pep-m", shop_id: shopId, product_id: "prod-pepperoni", size_name: "Medium", price: 1199, sort_order: 1, is_available: true, crust_options: FLAME9_PIZZA_CRUSTS },
        { id: "sz-pep-l", shop_id: shopId, product_id: "prod-pepperoni", size_name: "Large", price: 1399, sort_order: 2, is_available: true, crust_options: FLAME9_PIZZA_CRUSTS },
        { id: "sz-pep-xl", shop_id: shopId, product_id: "prod-pepperoni", size_name: "XL", price: 1599, sort_order: 3, is_available: true, crust_options: FLAME9_PIZZA_CRUSTS },
        { id: "sz-lat-s", shop_id: shopId, product_id: "prod-latte", size_name: "Small", price: 350, sort_order: 1, is_available: true, crust_options: "Regular" },
        { id: "sz-lat-m", shop_id: shopId, product_id: "prod-latte", size_name: "Medium", price: 450, sort_order: 2, is_available: true, crust_options: "Regular" },
        { id: "sz-lat-l", shop_id: shopId, product_id: "prod-latte", size_name: "Large", price: 550, sort_order: 3, is_available: true, crust_options: "Regular" },
      ];
    case "restaurant_reservations":
      return [];
    case "restaurant_deals":
      return [];
    case "restaurant_deal_items":
      return [];
    case "restaurant_waiter_calls":
      return [];
    default:
      return [];
  }
}

export const FLAME9_SQLITE_TABLES = [
  "shops",
  "user_profiles",
  "categories",
  "products",
  "product_recipes",
  "parties",
  "cash_accounts",
  "restaurant_tables",
  "restaurant_stations",
  "kitchen_orders",
  "kitchen_order_items",
  "restaurant_modifiers",
  "restaurant_menu_sizes",
  "restaurant_reservations",
  "restaurant_deals",
  "restaurant_deal_items",
  "restaurant_waiter_calls",
  "company_details",
  "print_settings",
  "invoices",
  "invoice_items",
  "payment_submissions",
  "register_sessions",
  "account_transactions",
  "credit_transactions",
];
