-- =========================================================================
-- CAR & MOTORCYCLE SHOWROOM, PARTIES, INSTALLMENTS & DEEDS MIGRATION
-- Run once in Supabase Dashboard → SQL Editor or via Auto-Deploy
-- =========================================================================

-- 1. SHOWROOM PARTIES (BUYERS, SELLERS, DEALERS & GUARANTORS)
CREATE TABLE IF NOT EXISTS showroom_parties (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id UUID REFERENCES shops(id) ON DELETE CASCADE,
    party_type VARCHAR(20) DEFAULT 'buyer', -- buyer | seller | both | dealer
    is_dealer_showroom BOOLEAN DEFAULT false, -- Checkbox if party is a Showroom / Dealer
    name VARCHAR(150) NOT NULL,
    father_name VARCHAR(150),
    caste VARCHAR(100), -- قوم / برادری (e.g. Arain, Jatt, Rajput, Mughal, Baloch, etc.)
    cnic VARCHAR(30),
    phone VARCHAR(40) NOT NULL,
    whatsapp VARCHAR(40),
    city VARCHAR(100) DEFAULT 'Lahore',
    address TEXT,
    photo_url TEXT, -- Person profile photo (compressed / drive url)
    cnic_front_url TEXT,
    cnic_back_url TEXT,
    opening_balance NUMERIC(15, 2) DEFAULT 0,
    current_balance NUMERIC(15, 2) DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Upgrade existing showroom_parties columns if already created
ALTER TABLE showroom_parties ADD COLUMN IF NOT EXISTS is_dealer_showroom BOOLEAN DEFAULT false;
ALTER TABLE showroom_parties ADD COLUMN IF NOT EXISTS father_name VARCHAR(150);
ALTER TABLE showroom_parties ADD COLUMN IF NOT EXISTS caste VARCHAR(100);
ALTER TABLE showroom_parties ADD COLUMN IF NOT EXISTS photo_url TEXT;
ALTER TABLE showroom_parties ADD COLUMN IF NOT EXISTS cnic_front_url TEXT;
ALTER TABLE showroom_parties ADD COLUMN IF NOT EXISTS cnic_back_url TEXT;
ALTER TABLE showroom_parties ADD COLUMN IF NOT EXISTS whatsapp VARCHAR(40);
ALTER TABLE showroom_parties ADD COLUMN IF NOT EXISTS city VARCHAR(100) DEFAULT 'Lahore';
-- 2. SHOWROOM INVESTORS (CAPITAL & PROFIT/LOSS PARTNERS)
CREATE TABLE IF NOT EXISTS showroom_investors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id UUID REFERENCES shops(id) ON DELETE CASCADE,
    name VARCHAR(150) NOT NULL,
    father_name VARCHAR(150),
    phone VARCHAR(40) NOT NULL,
    whatsapp VARCHAR(40),
    cnic VARCHAR(30),
    city VARCHAR(100) DEFAULT 'Lahore',
    address TEXT,
    default_share_type VARCHAR(30) DEFAULT 'profit_only',
    default_share_value NUMERIC(15, 2) DEFAULT 50,
    total_invested NUMERIC(15, 2) DEFAULT 0,
    total_profit_earned NUMERIC(15, 2) DEFAULT 0,
    total_withdrawn NUMERIC(15, 2) DEFAULT 0,
    current_balance NUMERIC(15, 2) DEFAULT 0,
    notes TEXT,
    status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. SHOWROOM INVESTOR TRANSACTIONS (CAPITAL INFLOW, PROFIT ACCRUAL, PAYOUTS)
CREATE TABLE IF NOT EXISTS showroom_investor_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id UUID REFERENCES shops(id) ON DELETE CASCADE,
    investor_id UUID REFERENCES showroom_investors(id) ON DELETE CASCADE,
    vehicle_id UUID,
    tx_type VARCHAR(40) NOT NULL,
    share_type VARCHAR(30),
    share_percentage NUMERIC(8, 2),
    amount NUMERIC(15, 2) NOT NULL DEFAULT 0,
    account_id UUID,
    date DATE DEFAULT CURRENT_DATE,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. SHOWROOM VEHICLES (CARS & MOTORCYCLES / BIKES INVENTORY)
CREATE TABLE IF NOT EXISTS showroom_vehicles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id UUID REFERENCES shops(id) ON DELETE CASCADE,
    vehicle_type VARCHAR(30) DEFAULT 'car', -- car | bike | commercial
    make VARCHAR(100) NOT NULL,
    model VARCHAR(120) NOT NULL,
    year VARCHAR(30), -- Supports '2026', '2026/27', '2024/25'
    plate_number VARCHAR(40),
    is_applied_for BOOLEAN DEFAULT false,
    chassis_number VARCHAR(80),
    engine_number VARCHAR(80),
    color VARCHAR(40),
    engine_cc INTEGER,
    
    -- Document Custody & Status
    document_status VARCHAR(50) DEFAULT 'in_showroom', -- in_showroom | with_seller | with_customer | in_bank_excise | other
    document_location TEXT, -- e.g. "Showroom Safe Locker #2"
    document_notes TEXT,
    document_checklist JSONB DEFAULT '{"file_complete":false,"smart_card":false,"original_book":false,"return_file":false,"biometric_letter":false}'::jsonb,
    
    -- Purchase & Sourcing details
    purchase_party_id UUID REFERENCES showroom_parties(id) ON DELETE SET NULL,
    purchase_cost NUMERIC(15, 2) DEFAULT 0,
    purchase_date DATE DEFAULT CURRENT_DATE,
    purchase_payment_mode VARCHAR(30) DEFAULT 'cash', -- cash | bank | credit
    
    -- Investor Partnership details
    investor_id UUID REFERENCES showroom_investors(id) ON DELETE SET NULL,
    investor_share_type VARCHAR(50),
    investor_share_value NUMERIC(15, 2),
    investor_investment_amount NUMERIC(15, 2) DEFAULT 0,
    investor_profit_settled BOOLEAN DEFAULT false,
    investor_profit_amount NUMERIC(15, 2) DEFAULT 0,
    
    -- Selling Prices
    price NUMERIC(15, 2) DEFAULT 0, -- Default selling price
    cash_price NUMERIC(15, 2) DEFAULT 0,
    installment_price NUMERIC(15, 2) DEFAULT 0,
    daily_rental_rate NUMERIC(15, 2) DEFAULT 0,
    
    -- Status & Purpose
    purpose VARCHAR(20) DEFAULT 'sale', -- sale | rental | installment | both
    status VARCHAR(30) DEFAULT 'available', -- available | reserved | rented | sold | installment_active
    
    -- Media & Files (Compressed / Google Drive Folders)
    photos JSONB DEFAULT '[]'::jsonb, -- Array of photo URLs
    documents JSONB DEFAULT '[]'::jsonb, -- Array of document/file URLs (PDF/Images)
    drive_folder_id VARCHAR(150),
    
    -- Sold Record Info
    buyer_party_id UUID REFERENCES showroom_parties(id) ON DELETE SET NULL,
    buyer_name VARCHAR(120),
    buyer_phone VARCHAR(40),
    sold_at TIMESTAMPTZ,
    sold_price NUMERIC(15, 2),
    
    -- Regulatory and Tracking
    tracker_installed BOOLEAN DEFAULT false,
    tracker_company VARCHAR(100),
    excise_token_expiry DATE,
    insurance_expiry DATE,
    fitness_expiry DATE,
    route_permit_expiry DATE,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Upgrades for existing showroom_vehicles
ALTER TABLE showroom_vehicles ALTER COLUMN year TYPE VARCHAR(30) USING year::TEXT;
ALTER TABLE showroom_vehicles ADD COLUMN IF NOT EXISTS document_status VARCHAR(50) DEFAULT 'in_showroom';
ALTER TABLE showroom_vehicles ADD COLUMN IF NOT EXISTS document_location TEXT;
ALTER TABLE showroom_vehicles ADD COLUMN IF NOT EXISTS document_notes TEXT;
ALTER TABLE showroom_vehicles ADD COLUMN IF NOT EXISTS document_checklist JSONB DEFAULT '{"file_complete":false,"smart_card":false,"original_book":false,"return_file":false,"biometric_letter":false}'::jsonb;
ALTER TABLE showroom_vehicles ADD COLUMN IF NOT EXISTS vehicle_type VARCHAR(30) DEFAULT 'car';
ALTER TABLE showroom_vehicles ADD COLUMN IF NOT EXISTS is_applied_for BOOLEAN DEFAULT false;
ALTER TABLE showroom_vehicles ADD COLUMN IF NOT EXISTS chassis_number VARCHAR(80);
ALTER TABLE showroom_vehicles ADD COLUMN IF NOT EXISTS engine_number VARCHAR(80);
ALTER TABLE showroom_vehicles ADD COLUMN IF NOT EXISTS purchase_party_id UUID REFERENCES showroom_parties(id) ON DELETE SET NULL;
ALTER TABLE showroom_vehicles ADD COLUMN IF NOT EXISTS purchase_cost NUMERIC(15, 2) DEFAULT 0;
ALTER TABLE showroom_vehicles ADD COLUMN IF NOT EXISTS purchase_date DATE DEFAULT CURRENT_DATE;
ALTER TABLE showroom_vehicles ADD COLUMN IF NOT EXISTS purchase_payment_mode VARCHAR(30) DEFAULT 'cash';
ALTER TABLE showroom_vehicles ADD COLUMN IF NOT EXISTS cash_price NUMERIC(15, 2) DEFAULT 0;
ALTER TABLE showroom_vehicles ADD COLUMN IF NOT EXISTS installment_price NUMERIC(15, 2) DEFAULT 0;
ALTER TABLE showroom_vehicles ADD COLUMN IF NOT EXISTS photos JSONB DEFAULT '[]'::jsonb;
ALTER TABLE showroom_vehicles ADD COLUMN IF NOT EXISTS documents JSONB DEFAULT '[]'::jsonb;
ALTER TABLE showroom_vehicles ADD COLUMN IF NOT EXISTS drive_folder_id VARCHAR(150);
ALTER TABLE showroom_vehicles ADD COLUMN IF NOT EXISTS tracker_installed BOOLEAN DEFAULT false;
ALTER TABLE showroom_vehicles ADD COLUMN IF NOT EXISTS tracker_company VARCHAR(100);
ALTER TABLE showroom_vehicles ADD COLUMN IF NOT EXISTS buyer_party_id UUID REFERENCES showroom_parties(id) ON DELETE SET NULL;

-- Investor columns on showroom_vehicles
ALTER TABLE showroom_vehicles ADD COLUMN IF NOT EXISTS investor_id UUID REFERENCES showroom_investors(id) ON DELETE SET NULL;
ALTER TABLE showroom_vehicles ADD COLUMN IF NOT EXISTS investor_share_type VARCHAR(50);
ALTER TABLE showroom_vehicles ADD COLUMN IF NOT EXISTS investor_share_value NUMERIC(15, 2);
ALTER TABLE showroom_vehicles ADD COLUMN IF NOT EXISTS investor_investment_amount NUMERIC(15, 2) DEFAULT 0;
ALTER TABLE showroom_vehicles ADD COLUMN IF NOT EXISTS investor_profit_settled BOOLEAN DEFAULT false;
ALTER TABLE showroom_vehicles ADD COLUMN IF NOT EXISTS investor_profit_amount NUMERIC(15, 2) DEFAULT 0;

-- 5. SHOWROOM INSTALLMENTS (VEHICLE EMI / QIST AGREEMENTS)
CREATE TABLE IF NOT EXISTS showroom_installments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id UUID REFERENCES shops(id) ON DELETE CASCADE,
    vehicle_id UUID REFERENCES showroom_vehicles(id) ON DELETE SET NULL,
    party_id UUID REFERENCES showroom_parties(id) ON DELETE SET NULL,
    agreement_number VARCHAR(60) NOT NULL,
    
    -- Buyer / Customer Details
    customer_name VARCHAR(150) NOT NULL,
    customer_father_name VARCHAR(150),
    customer_caste VARCHAR(100),
    customer_cnic VARCHAR(30),
    customer_phone VARCHAR(40) NOT NULL,
    customer_phone_2 VARCHAR(40),
    customer_address TEXT,
    customer_city VARCHAR(80),
    customer_photo_url TEXT,
    
    -- Guarantor 1 (Zamin 1)
    guarantor_1_name VARCHAR(150),
    guarantor_1_father_name VARCHAR(150),
    guarantor_1_caste VARCHAR(100),
    guarantor_1_cnic VARCHAR(30),
    guarantor_1_phone VARCHAR(40),
    guarantor_1_relation VARCHAR(80),
    guarantor_1_address TEXT,
    guarantor_1_photo_url TEXT,
    
    -- Guarantor 2 (Zamin 2)
    guarantor_2_name VARCHAR(150),
    guarantor_2_father_name VARCHAR(150),
    guarantor_2_caste VARCHAR(100),
    guarantor_2_cnic VARCHAR(30),
    guarantor_2_phone VARCHAR(40),
    guarantor_2_relation VARCHAR(80),
    guarantor_2_address TEXT,
    guarantor_2_photo_url TEXT,
    
    -- Financial Parameters
    cash_price NUMERIC(15, 2) DEFAULT 0,
    markup_profit NUMERIC(15, 2) DEFAULT 0,
    total_price NUMERIC(15, 2) NOT NULL DEFAULT 0,
    down_payment NUMERIC(15, 2) NOT NULL DEFAULT 0,
    remaining_balance NUMERIC(15, 2) NOT NULL DEFAULT 0,
    total_installments INTEGER NOT NULL DEFAULT 12,
    monthly_installment NUMERIC(15, 2) NOT NULL DEFAULT 0,
    frequency VARCHAR(30) DEFAULT 'monthly', -- monthly | bi-monthly | weekly
    
    -- Dates & Tracking
    start_date DATE NOT NULL,
    first_due_date DATE NOT NULL,
    total_paid NUMERIC(15, 2) DEFAULT 0,
    status VARCHAR(30) DEFAULT 'active', -- active | completed | overdue | defaulted | cancelled
    
    -- Witnesses & Legal
    witness_1_name VARCHAR(120),
    witness_1_cnic VARCHAR(30),
    witness_1_phone VARCHAR(40),
    witness_2_name VARCHAR(120),
    witness_2_cnic VARCHAR(30),
    witness_2_phone VARCHAR(40),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE showroom_installments ADD COLUMN IF NOT EXISTS party_id UUID REFERENCES showroom_parties(id) ON DELETE SET NULL;
ALTER TABLE showroom_installments ADD COLUMN IF NOT EXISTS customer_caste VARCHAR(100);
ALTER TABLE showroom_installments ADD COLUMN IF NOT EXISTS customer_photo_url TEXT;
ALTER TABLE showroom_installments ADD COLUMN IF NOT EXISTS guarantor_1_caste VARCHAR(100);
ALTER TABLE showroom_installments ADD COLUMN IF NOT EXISTS guarantor_1_photo_url TEXT;
ALTER TABLE showroom_installments ADD COLUMN IF NOT EXISTS guarantor_2_caste VARCHAR(100);
ALTER TABLE showroom_installments ADD COLUMN IF NOT EXISTS guarantor_2_photo_url TEXT;
ALTER TABLE showroom_installments ADD COLUMN IF NOT EXISTS cash_price NUMERIC(15, 2) DEFAULT 0;
ALTER TABLE showroom_installments ADD COLUMN IF NOT EXISTS markup_profit NUMERIC(15, 2) DEFAULT 0;
ALTER TABLE showroom_installments ADD COLUMN IF NOT EXISTS witness_1_cnic VARCHAR(30);
ALTER TABLE showroom_installments ADD COLUMN IF NOT EXISTS witness_1_phone VARCHAR(40);
ALTER TABLE showroom_installments ADD COLUMN IF NOT EXISTS witness_2_cnic VARCHAR(30);
ALTER TABLE showroom_installments ADD COLUMN IF NOT EXISTS witness_2_phone VARCHAR(40);

-- 4. SHOWROOM INSTALLMENT SCHEDULES
CREATE TABLE IF NOT EXISTS showroom_installment_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id UUID REFERENCES shops(id) ON DELETE CASCADE,
    installment_id UUID REFERENCES showroom_installments(id) ON DELETE CASCADE,
    installment_no INTEGER NOT NULL,
    due_date DATE NOT NULL,
    due_amount NUMERIC(15, 2) NOT NULL DEFAULT 0,
    paid_amount NUMERIC(15, 2) DEFAULT 0,
    paid_date TIMESTAMPTZ,
    late_fee NUMERIC(15, 2) DEFAULT 0,
    discount NUMERIC(15, 2) DEFAULT 0,
    payment_method VARCHAR(50) DEFAULT 'cash', -- cash | bank | online
    received_by VARCHAR(120),
    receipt_no VARCHAR(60),
    status VARCHAR(20) DEFAULT 'unpaid', -- unpaid | paid | partial | overdue
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 5. SHOWROOM RENTALS
CREATE TABLE IF NOT EXISTS showroom_rentals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id UUID REFERENCES shops(id) ON DELETE CASCADE,
    vehicle_id UUID REFERENCES showroom_vehicles(id) ON DELETE SET NULL,
    customer_name VARCHAR(120) NOT NULL,
    customer_phone VARCHAR(40),
    customer_cnic VARCHAR(30),
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    returned_at TIMESTAMPTZ,
    daily_rate NUMERIC(15, 2) NOT NULL DEFAULT 0,
    security_deposit NUMERIC(15, 2) NOT NULL DEFAULT 0,
    deposit_returned NUMERIC(15, 2) DEFAULT 0,
    late_fee_per_day NUMERIC(15, 2) DEFAULT 0,
    late_fee_charged NUMERIC(15, 2) DEFAULT 0,
    notes TEXT,
    status VARCHAR(20) DEFAULT 'active', -- active | overdue | returned | cancelled
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for lightning fast queries
CREATE INDEX IF NOT EXISTS idx_showroom_parties_shop ON showroom_parties(shop_id);
CREATE INDEX IF NOT EXISTS idx_showroom_parties_type ON showroom_parties(party_type);
CREATE INDEX IF NOT EXISTS idx_showroom_parties_phone ON showroom_parties(phone);
CREATE INDEX IF NOT EXISTS idx_showroom_parties_cnic ON showroom_parties(cnic);

CREATE INDEX IF NOT EXISTS idx_showroom_vehicles_shop ON showroom_vehicles(shop_id);
CREATE INDEX IF NOT EXISTS idx_showroom_vehicles_status ON showroom_vehicles(status);
CREATE INDEX IF NOT EXISTS idx_showroom_vehicles_chassis ON showroom_vehicles(chassis_number);
CREATE INDEX IF NOT EXISTS idx_showroom_vehicles_plate ON showroom_vehicles(plate_number);

CREATE INDEX IF NOT EXISTS idx_showroom_installments_shop ON showroom_installments(shop_id);
CREATE INDEX IF NOT EXISTS idx_showroom_installments_vehicle ON showroom_installments(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_showroom_installments_party ON showroom_installments(party_id);
CREATE INDEX IF NOT EXISTS idx_showroom_installments_status ON showroom_installments(status);

CREATE INDEX IF NOT EXISTS idx_showroom_installment_schedules_shop ON showroom_installment_schedules(shop_id);
CREATE INDEX IF NOT EXISTS idx_showroom_installment_schedules_inst ON showroom_installment_schedules(installment_id);
CREATE INDEX IF NOT EXISTS idx_showroom_installment_schedules_status ON showroom_installment_schedules(status);

CREATE INDEX IF NOT EXISTS idx_showroom_rentals_shop ON showroom_rentals(shop_id);

-- RLS Security Policies
ALTER TABLE showroom_parties ENABLE ROW LEVEL SECURITY;
ALTER TABLE showroom_vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE showroom_investors ENABLE ROW LEVEL SECURITY;
ALTER TABLE showroom_investor_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE showroom_rentals ENABLE ROW LEVEL SECURITY;
ALTER TABLE showroom_installments ENABLE ROW LEVEL SECURITY;
ALTER TABLE showroom_installment_schedules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "showroom_parties_all" ON showroom_parties;
CREATE POLICY "showroom_parties_all" ON showroom_parties FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "showroom_vehicles_all" ON showroom_vehicles;
CREATE POLICY "showroom_vehicles_all" ON showroom_vehicles FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "showroom_investors_all" ON showroom_investors;
CREATE POLICY "showroom_investors_all" ON showroom_investors FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "showroom_investor_transactions_all" ON showroom_investor_transactions;
CREATE POLICY "showroom_investor_transactions_all" ON showroom_investor_transactions FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "showroom_rentals_all" ON showroom_rentals;
CREATE POLICY "showroom_rentals_all" ON showroom_rentals FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "showroom_installments_all" ON showroom_installments;
CREATE POLICY "showroom_installments_all" ON showroom_installments FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "showroom_installment_schedules_all" ON showroom_installment_schedules;
CREATE POLICY "showroom_installment_schedules_all" ON showroom_installment_schedules FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';
