-- Restaurant extended features: sizes, deals, waiter calls

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
