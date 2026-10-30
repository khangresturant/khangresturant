-- Restaurant & Cafe Module Schema
-- Added June 2026

-- 1. Create Dining Tables Table
CREATE TABLE IF NOT EXISTS restaurant_tables (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id UUID REFERENCES shops(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    capacity INTEGER DEFAULT 4,
    status VARCHAR(50) DEFAULT 'available', -- 'available', 'occupied', 'cleaning'
    active_invoice_id UUID REFERENCES invoices(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Create Kitchen Orders (KOT) Table
CREATE TABLE IF NOT EXISTS kitchen_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id UUID REFERENCES shops(id) ON DELETE CASCADE,
    table_id UUID REFERENCES restaurant_tables(id) ON DELETE SET NULL,
    invoice_id UUID REFERENCES invoices(id) ON DELETE SET NULL,
    waiter_id UUID,
    status VARCHAR(50) DEFAULT 'cooking', -- 'cooking', 'ready', 'served', 'voided'
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Create KOT Line Items Table
CREATE TABLE IF NOT EXISTS kitchen_order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    kitchen_order_id UUID REFERENCES kitchen_orders(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id) ON DELETE CASCADE,
    quantity NUMERIC(15, 2) NOT NULL,
    remarks VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS (Row Level Security) and Policies
ALTER TABLE restaurant_tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE kitchen_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE kitchen_order_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all actions for authenticated users on restaurant_tables"
    ON restaurant_tables FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow all actions for authenticated users on kitchen_orders"
    ON kitchen_orders FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow all actions for authenticated users on kitchen_order_items"
    ON kitchen_order_items FOR ALL TO authenticated USING (true) WITH CHECK (true);
