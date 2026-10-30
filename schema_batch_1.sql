-- Batch 1: Core, Settings, and Inventory Schema

-- 1. Core Systems
CREATE TABLE IF NOT EXISTS shops (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    address TEXT,
    phone VARCHAR(50),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS user_profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    shop_id UUID REFERENCES shops(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    role VARCHAR(50) DEFAULT 'salesman',
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id UUID REFERENCES shops(id),
    user_id UUID REFERENCES auth.users(id),
    action VARCHAR(255) NOT NULL,
    details JSONB,
    ip_address VARCHAR(45),
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS company_details (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id UUID REFERENCES shops(id),
    name VARCHAR(100) NOT NULL,
    address TEXT,
    phone VARCHAR(20),
    email VARCHAR(100),
    logo_path VARCHAR(255),
    website VARCHAR(500),
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS print_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id UUID REFERENCES shops(id),
    receipt_page_size VARCHAR(20) DEFAULT 'MM80',
    receipt_font VARCHAR(100) DEFAULT 'Arial',
    receipt_font_size INT DEFAULT 12,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Inventory & Products
CREATE TABLE IF NOT EXISTS categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id UUID REFERENCES shops(id),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS formulations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id UUID REFERENCES shops(id),
    name VARCHAR(200) NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS shelves (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id UUID REFERENCES shops(id),
    name VARCHAR(100) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id UUID REFERENCES shops(id),
    category_id UUID REFERENCES categories(id),
    formulation_id UUID REFERENCES formulations(id),
    shelf_id UUID REFERENCES shelves(id),
    name VARCHAR(100) NOT NULL,
    code VARCHAR(100),
    pack_size INT DEFAULT 1,
    purchase_price_pack FLOAT DEFAULT 0,
    sale_price_pack FLOAT DEFAULT 0,
    purchase_price_single FLOAT DEFAULT 0,
    sale_price_single FLOAT DEFAULT 0,
    min_stock_level FLOAT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Product Variants & Multiple Barcodes (User's specific request for Karyana)
CREATE TABLE IF NOT EXISTS product_variants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID REFERENCES products(id) ON DELETE CASCADE,
    shop_id UUID REFERENCES shops(id),
    packing_name VARCHAR(200) NOT NULL, -- renamed from variant_name
    purchase_price FLOAT DEFAULT 0,
    sale_price FLOAT DEFAULT 0,
    stock_quantity FLOAT DEFAULT 0, -- added to track variant stock
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS product_barcodes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID REFERENCES products(id) ON DELETE CASCADE,
    variant_id UUID REFERENCES product_variants(id) ON DELETE CASCADE,
    shop_id UUID REFERENCES shops(id),
    barcode VARCHAR(100) NOT NULL,
    pack_type VARCHAR(20) DEFAULT 'single', -- single or pack
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS warehouses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id UUID REFERENCES shops(id),
    name VARCHAR(100) NOT NULL,
    location TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS stock (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id UUID REFERENCES shops(id),
    product_id UUID REFERENCES products(id),
    warehouse_id UUID REFERENCES warehouses(id),
    quantity_pack FLOAT DEFAULT 0,
    quantity_single FLOAT DEFAULT 0,
    batch_number VARCHAR(100),
    expiry_date DATE,
    created_at TIMESTAMPTZ DEFAULT now()
);
