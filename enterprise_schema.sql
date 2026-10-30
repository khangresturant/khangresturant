-- Enterprise ERP Schema Expansion
-- Phase 1: Database Structure (Added June 2026)

-- 1. Alter Shops Table to include ERP Toggles
ALTER TABLE public.shops ADD COLUMN IF NOT EXISTS has_payroll BOOLEAN DEFAULT false;
ALTER TABLE public.shops ADD COLUMN IF NOT EXISTS has_tax BOOLEAN DEFAULT false;
ALTER TABLE public.shops ADD COLUMN IF NOT EXISTS has_assets_rec BOOLEAN DEFAULT false;

-- 2. Fixed Assets
CREATE TABLE IF NOT EXISTS fixed_assets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shop_id UUID REFERENCES shops(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    asset_type VARCHAR(100) NOT NULL, -- machinery, furniture, electronics, etc.
    purchase_date DATE NOT NULL,
    purchase_price DECIMAL(15, 2) NOT NULL,
    salvage_value DECIMAL(15, 2) DEFAULT 0,
    useful_life_years INT NOT NULL,
    current_value DECIMAL(15, 2) NOT NULL,
    status VARCHAR(50) DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

CREATE TABLE IF NOT EXISTS asset_depreciation_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    asset_id UUID REFERENCES fixed_assets(id) ON DELETE CASCADE,
    depreciation_date DATE NOT NULL,
    amount DECIMAL(15, 2) NOT NULL,
    remarks TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- 2. Payroll
CREATE TABLE IF NOT EXISTS payroll_slips (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shop_id UUID REFERENCES shops(id) ON DELETE CASCADE,
    staff_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
    month_year VARCHAR(20) NOT NULL, -- e.g., '2023-10'
    base_salary DECIMAL(15, 2) NOT NULL,
    allowances DECIMAL(15, 2) DEFAULT 0,
    deductions DECIMAL(15, 2) DEFAULT 0,
    net_payable DECIMAL(15, 2) NOT NULL,
    status VARCHAR(50) DEFAULT 'unpaid', -- unpaid, paid
    paid_date DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

CREATE TABLE IF NOT EXISTS payroll_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    slip_id UUID REFERENCES payroll_slips(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL, -- allowance, deduction
    name VARCHAR(100) NOT NULL,
    amount DECIMAL(15, 2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- 3. Bank Reconciliation
CREATE TABLE IF NOT EXISTS bank_statement_lines (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shop_id UUID REFERENCES shops(id) ON DELETE CASCADE,
    account_id UUID REFERENCES cash_accounts(id) ON DELETE CASCADE,
    transaction_date DATE NOT NULL,
    description TEXT NOT NULL,
    debit DECIMAL(15, 2) DEFAULT 0,
    credit DECIMAL(15, 2) DEFAULT 0,
    balance DECIMAL(15, 2) NOT NULL,
    is_reconciled BOOLEAN DEFAULT false,
    matched_transaction_id UUID REFERENCES account_transactions(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- 4. Audit Logs
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shop_id UUID REFERENCES shops(id) ON DELETE CASCADE,
    user_id UUID,
    action VARCHAR(50) NOT NULL, -- create, update, delete
    table_name VARCHAR(100) NOT NULL,
    record_id UUID NOT NULL,
    old_data JSONB,
    new_data JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- 5. Add Tax columns to Invoices and Purchase Orders
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS tax_rate DECIMAL(5, 2) DEFAULT 0;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS tax_amount DECIMAL(15, 2) DEFAULT 0;

ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS tax_rate DECIMAL(5, 2) DEFAULT 0;
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS tax_amount DECIMAL(15, 2) DEFAULT 0;

-- 6. Advanced Enterprise Toggles
ALTER TABLE shops ADD COLUMN IF NOT EXISTS has_payroll BOOLEAN DEFAULT false;
ALTER TABLE shops ADD COLUMN IF NOT EXISTS has_tax BOOLEAN DEFAULT false;
ALTER TABLE shops ADD COLUMN IF NOT EXISTS has_assets_rec BOOLEAN DEFAULT false;
