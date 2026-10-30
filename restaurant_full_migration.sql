-- Restaurant full migration (workflow + deals/sizes/waiter calls)
-- Run once in Supabase Dashboard → SQL Editor

-- === Order workflow ===
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS restaurant_order_status VARCHAR(50);
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS service_type VARCHAR(50);
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS table_id UUID REFERENCES restaurant_tables(id) ON DELETE SET NULL;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS bill_printed_at TIMESTAMPTZ;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS order_number VARCHAR(50);
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS customer_name VARCHAR(100);
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS customer_phone VARCHAR(30);
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS customer_address TEXT;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS delivery_fee NUMERIC(15, 2) DEFAULT 0;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS additional_charges NUMERIC(15, 2) DEFAULT 0;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS special_instructions TEXT;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS discount_percentage NUMERIC(5, 2) DEFAULT 0;
ALTER TABLE kitchen_orders ADD COLUMN IF NOT EXISTS invoice_id UUID REFERENCES invoices(id) ON DELETE SET NULL;
ALTER TABLE kitchen_orders ADD COLUMN IF NOT EXISTS waiter_id UUID;

-- === Deals, menu sizes, waiter calls ===
CREATE TABLE IF NOT EXISTS restaurant_menu_sizes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id UUID REFERENCES shops(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id) ON DELETE CASCADE,
    size_name VARCHAR(30) NOT NULL,
    size_description VARCHAR(100),
    price NUMERIC(15, 2) NOT NULL DEFAULT 0,
    is_available BOOLEAN DEFAULT true,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(shop_id, product_id, size_name)
);

CREATE TABLE IF NOT EXISTS restaurant_deals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id UUID REFERENCES shops(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    image_url TEXT,
    original_price NUMERIC(15, 2) NOT NULL DEFAULT 0,
    deal_price NUMERIC(15, 2) NOT NULL DEFAULT 0,
    discount_percentage NUMERIC(5, 2) DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    valid_from TIMESTAMPTZ,
    valid_until TIMESTAMPTZ,
    max_uses INTEGER,
    current_uses INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS restaurant_deal_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    deal_id UUID REFERENCES restaurant_deals(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id) ON DELETE SET NULL,
    item_type VARCHAR(30) DEFAULT 'item',
    quantity NUMERIC(15, 2) NOT NULL DEFAULT 1,
    size_name VARCHAR(30),
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS restaurant_waiter_calls (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id UUID REFERENCES shops(id) ON DELETE CASCADE,
    table_id UUID REFERENCES restaurant_tables(id) ON DELETE SET NULL,
    invoice_id UUID REFERENCES invoices(id) ON DELETE SET NULL,
    message VARCHAR(255) DEFAULT 'Waiter requested',
    call_type VARCHAR(30) DEFAULT 'help',
    status VARCHAR(20) DEFAULT 'pending',
    waiter_id UUID,
    acknowledged_at TIMESTAMPTZ,
    acknowledged_by UUID,
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE restaurant_menu_sizes ENABLE ROW LEVEL SECURITY;
ALTER TABLE restaurant_deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE restaurant_deal_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE restaurant_waiter_calls ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "restaurant_menu_sizes_all" ON restaurant_menu_sizes;
CREATE POLICY "restaurant_menu_sizes_all" ON restaurant_menu_sizes FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "restaurant_deals_all" ON restaurant_deals;
CREATE POLICY "restaurant_deals_all" ON restaurant_deals FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "restaurant_deal_items_all" ON restaurant_deal_items;
CREATE POLICY "restaurant_deal_items_all" ON restaurant_deal_items FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "restaurant_waiter_calls_all" ON restaurant_waiter_calls;
CREATE POLICY "restaurant_waiter_calls_all" ON restaurant_waiter_calls FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Rider + modifiers (P0)
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS rider_id UUID;

CREATE TABLE IF NOT EXISTS restaurant_modifiers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id UUID REFERENCES shops(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    price_add NUMERIC(15, 2) NOT NULL DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    sort_order INTEGER DEFAULT 0,
    applies_to VARCHAR(50) DEFAULT 'all',
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE restaurant_modifiers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "restaurant_modifiers_all" ON restaurant_modifiers;
CREATE POLICY "restaurant_modifiers_all" ON restaurant_modifiers FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- === P1/P2: floors, stations, tips, reservations, QR ===
ALTER TABLE restaurant_tables ADD COLUMN IF NOT EXISTS floor_name VARCHAR(50) DEFAULT 'Ground';
ALTER TABLE restaurant_tables ADD COLUMN IF NOT EXISTS section_name VARCHAR(50);

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
ALTER TABLE restaurant_menu_sizes ADD COLUMN IF NOT EXISTS crust_options TEXT;
ALTER TABLE restaurant_menu_sizes ADD COLUMN IF NOT EXISTS variant_label VARCHAR(50);
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS tip_amount NUMERIC(15, 2) DEFAULT 0;

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
DROP POLICY IF EXISTS "restaurant_qr_orders_insert_anon" ON restaurant_qr_orders;
CREATE POLICY "restaurant_qr_orders_insert_anon" ON restaurant_qr_orders FOR INSERT TO anon WITH CHECK (true);
DROP POLICY IF EXISTS "restaurant_qr_orders_select_anon" ON restaurant_qr_orders;
CREATE POLICY "restaurant_qr_orders_select_anon" ON restaurant_qr_orders FOR SELECT TO anon USING (true);
