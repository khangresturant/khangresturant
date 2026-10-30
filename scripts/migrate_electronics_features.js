const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

const connStr = process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL;
const isRemoteSSL = connStr.includes('sslmode=require') || connStr.includes('supabase.co') || connStr.includes('pooler');

const client = new Client({
  connectionString: connStr,
  ssl: isRemoteSSL ? { rejectUnauthorized: false } : false
});

async function run() {
  await client.connect();
  console.log('Connected to Postgres successfully!');
  
  // 1. Update repair_tickets columns
  await client.query(`
    ALTER TABLE IF EXISTS public.repair_tickets 
      ADD COLUMN IF NOT EXISTS pattern_lock text,
      ADD COLUMN IF NOT EXISTS passcode varchar(50),
      ADD COLUMN IF NOT EXISTS advance_amount numeric(10,2) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS spare_parts jsonb DEFAULT '[]'::jsonb,
      ADD COLUMN IF NOT EXISTS technician_name varchar(100),
      ADD COLUMN IF NOT EXISTS delivery_date timestamp with time zone;
  `);
  console.log('repair_tickets columns verified/added.');

  // 2. Update invoices for guarantor details in EMI
  await client.query(`
    ALTER TABLE IF EXISTS public.invoices
      ADD COLUMN IF NOT EXISTS guarantor_name varchar(150),
      ADD COLUMN IF NOT EXISTS guarantor_cnic varchar(50),
      ADD COLUMN IF NOT EXISTS guarantor_phone varchar(50),
      ADD COLUMN IF NOT EXISTS guarantor_relation varchar(50),
      ADD COLUMN IF NOT EXISTS guarantor_address text;
  `);
  console.log('invoices guarantor columns verified/added.');

  // 3. Create used_mobile_purchases table
  await client.query(`
    CREATE TABLE IF NOT EXISTS public.used_mobile_purchases (
      id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
      shop_id uuid REFERENCES public.shops(id) ON DELETE CASCADE,
      customer_id uuid REFERENCES public.parties(id) ON DELETE SET NULL,
      customer_name varchar(150) NOT NULL,
      customer_cnic varchar(50) NOT NULL,
      customer_father_name varchar(150),
      customer_phone varchar(50) NOT NULL,
      customer_address text,
      customer_photo_url text,
      cnic_front_url text,
      cnic_back_url text,
      brand varchar(100) NOT NULL,
      device_model varchar(150) NOT NULL,
      color varchar(50),
      storage_capacity varchar(50),
      imei_1 varchar(50) NOT NULL,
      imei_2 varchar(50),
      pta_status varchar(50) DEFAULT 'Official PTA Approved',
      battery_health integer,
      condition_rating varchar(50) DEFAULT '10/10 Condition',
      accessories_included jsonb DEFAULT '[]'::jsonb,
      fault_notes text,
      purchase_price numeric(12,2) NOT NULL DEFAULT 0,
      payment_mode varchar(30) DEFAULT 'cash',
      affidavit_agreed boolean DEFAULT true,
      created_product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
      status varchar(30) DEFAULT 'in_stock',
      created_at timestamp with time zone DEFAULT now(),
      updated_at timestamp with time zone DEFAULT now()
    );

    ALTER TABLE IF EXISTS public.used_mobile_purchases ENABLE ROW LEVEL SECURITY;

    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'used_mobile_purchases' AND policyname = 'Allow all on used_mobile_purchases'
      ) THEN
        CREATE POLICY "Allow all on used_mobile_purchases" ON public.used_mobile_purchases FOR ALL USING (true) WITH CHECK (true);
      END IF;
    END $$;

    GRANT ALL ON TABLE public.used_mobile_purchases TO anon, authenticated, service_role;
  `);
  console.log('used_mobile_purchases table created and granted permissions successfully!');

  await client.end();
}

run().catch(e => {
  console.error('Migration error:', e.message);
  process.exit(1);
});
