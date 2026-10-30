-- Restaurant Order Workflow Migration
-- Adds unified order status, service type, and KOT-invoice linking

ALTER TABLE invoices ADD COLUMN IF NOT EXISTS restaurant_order_status VARCHAR(50);
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS service_type VARCHAR(50);
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS table_id UUID REFERENCES restaurant_tables(id) ON DELETE SET NULL;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS bill_printed_at TIMESTAMPTZ;

ALTER TABLE kitchen_orders ADD COLUMN IF NOT EXISTS invoice_id UUID REFERENCES invoices(id) ON DELETE SET NULL;
ALTER TABLE kitchen_orders ADD COLUMN IF NOT EXISTS waiter_id UUID;

ALTER TABLE invoices ADD COLUMN IF NOT EXISTS order_number VARCHAR(50);
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS customer_name VARCHAR(100);
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS customer_phone VARCHAR(30);
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS customer_address TEXT;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS delivery_fee NUMERIC(15, 2) DEFAULT 0;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS additional_charges NUMERIC(15, 2) DEFAULT 0;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS special_instructions TEXT;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS discount_percentage NUMERIC(5, 2) DEFAULT 0;

COMMENT ON COLUMN invoices.restaurant_order_status IS 'open | in_kitchen | ready | ready_to_bill | bill_printed | settled | cancelled';
COMMENT ON COLUMN invoices.service_type IS 'dining | takeaway | delivery';
COMMENT ON COLUMN kitchen_orders.invoice_id IS 'Links KOT ticket to restaurant order (draft invoice)';
