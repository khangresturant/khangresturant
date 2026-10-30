-- Fertilizer and Seeds Module Schema
-- Added June 2026

-- 1. Create Seasonal Khata Table for Farmers
CREATE TABLE IF NOT EXISTS seasonal_khata (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id UUID REFERENCES shops(id) ON DELETE CASCADE,
    party_id UUID REFERENCES parties(id) ON DELETE CASCADE,
    crop_season VARCHAR(100) NOT NULL, -- e.g., 'Rabi (Wheat) 2026', 'Kharif (Cotton) 2026'
    credit_limit NUMERIC(15, 2) DEFAULT 0,
    outstanding_balance NUMERIC(15, 2) DEFAULT 0,
    expected_harvest_payback DATE,
    status VARCHAR(50) DEFAULT 'active', -- 'active', 'due_harvest', 'settled'
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Add batch_id and batch_number to invoice_items if they don't exist
ALTER TABLE invoice_items ADD COLUMN IF NOT EXISTS batch_id UUID REFERENCES product_batches(id) ON DELETE SET NULL;
ALTER TABLE invoice_items ADD COLUMN IF NOT EXISTS batch_number VARCHAR(100);

-- 3. Add government subsidy fields to invoices if they don't exist
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS subsidy_amount NUMERIC(15, 2) DEFAULT 0;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS subsidy_voucher VARCHAR(100);
