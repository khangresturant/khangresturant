-- ============================================================
-- HisabX: Full Row Level Security Policy Script
-- File: rls_all_tables.sql
-- Run once in Supabase Dashboard > SQL Editor
-- ============================================================

-- Helper function: retrieves shop_id dynamically from user_profiles
CREATE OR REPLACE FUNCTION get_my_shop_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT shop_id
  FROM public.user_profiles
  WHERE id = auth.uid()
  LIMIT 1;
$$;

-- ============================================================
-- CORE TABLES
-- ============================================================

-- products
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS products_tenant ON products;
CREATE POLICY products_tenant ON products
  FOR ALL TO authenticated
  USING (shop_id = get_my_shop_id())
  WITH CHECK (shop_id = get_my_shop_id());

-- product_variants
ALTER TABLE product_variants ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS variants_tenant ON product_variants;
CREATE POLICY variants_tenant ON product_variants
  FOR ALL TO authenticated
  USING (shop_id = get_my_shop_id())
  WITH CHECK (shop_id = get_my_shop_id());

-- parties
ALTER TABLE parties ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS parties_tenant ON parties;
CREATE POLICY parties_tenant ON parties
  FOR ALL TO authenticated
  USING (shop_id = get_my_shop_id())
  WITH CHECK (shop_id = get_my_shop_id());

-- invoices
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS invoices_tenant ON invoices;
CREATE POLICY invoices_tenant ON invoices
  FOR ALL TO authenticated
  USING (shop_id = get_my_shop_id())
  WITH CHECK (shop_id = get_my_shop_id());

-- invoice_items
ALTER TABLE invoice_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS invoice_items_tenant ON invoice_items;
CREATE POLICY invoice_items_tenant ON invoice_items
  FOR ALL TO authenticated
  USING (shop_id = get_my_shop_id())
  WITH CHECK (shop_id = get_my_shop_id());

-- stock_movements
ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS stock_movements_tenant ON stock_movements;
CREATE POLICY stock_movements_tenant ON stock_movements
  FOR ALL TO authenticated
  USING (shop_id = get_my_shop_id())
  WITH CHECK (shop_id = get_my_shop_id());

-- credit_transactions
ALTER TABLE credit_transactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS credit_tx_tenant ON credit_transactions;
CREATE POLICY credit_tx_tenant ON credit_transactions
  FOR ALL TO authenticated
  USING (shop_id = get_my_shop_id())
  WITH CHECK (shop_id = get_my_shop_id());

-- account_transactions
ALTER TABLE account_transactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS account_tx_tenant ON account_transactions;
CREATE POLICY account_tx_tenant ON account_transactions
  FOR ALL TO authenticated
  USING (shop_id = get_my_shop_id())
  WITH CHECK (shop_id = get_my_shop_id());

-- cash_accounts
ALTER TABLE cash_accounts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS cash_accounts_tenant ON cash_accounts;
CREATE POLICY cash_accounts_tenant ON cash_accounts
  FOR ALL TO authenticated
  USING (shop_id = get_my_shop_id())
  WITH CHECK (shop_id = get_my_shop_id());

-- day_closings
ALTER TABLE day_closings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS day_closings_tenant ON day_closings;
CREATE POLICY day_closings_tenant ON day_closings
  FOR ALL TO authenticated
  USING (shop_id = get_my_shop_id())
  WITH CHECK (shop_id = get_my_shop_id());

-- ============================================================
-- NEW VERTICAL TABLES
-- ============================================================

-- gold_products
ALTER TABLE gold_products ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS gold_products_tenant ON gold_products;
CREATE POLICY gold_products_tenant ON gold_products
  FOR ALL TO authenticated
  USING (shop_id = get_my_shop_id())
  WITH CHECK (shop_id = get_my_shop_id());

-- gold_transactions
ALTER TABLE gold_transactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS gold_transactions_tenant ON gold_transactions;
CREATE POLICY gold_transactions_tenant ON gold_transactions
  FOR ALL TO authenticated
  USING (shop_id = get_my_shop_id())
  WITH CHECK (shop_id = get_my_shop_id());

-- sabzi_products
ALTER TABLE sabzi_products ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS sabzi_products_tenant ON sabzi_products;
CREATE POLICY sabzi_products_tenant ON sabzi_products
  FOR ALL TO authenticated
  USING (shop_id = get_my_shop_id())
  WITH CHECK (shop_id = get_my_shop_id());

-- sabzi_sales
ALTER TABLE sabzi_sales ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS sabzi_sales_tenant ON sabzi_sales;
CREATE POLICY sabzi_sales_tenant ON sabzi_sales
  FOR ALL TO authenticated
  USING (shop_id = get_my_shop_id())
  WITH CHECK (shop_id = get_my_shop_id());

-- print_orders
ALTER TABLE print_orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS print_orders_tenant ON print_orders;
CREATE POLICY print_orders_tenant ON print_orders
  FOR ALL TO authenticated
  USING (shop_id = get_my_shop_id())
  WITH CHECK (shop_id = get_my_shop_id());

-- print_items
ALTER TABLE print_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS print_items_tenant ON print_items;
CREATE POLICY print_items_tenant ON print_items
  FOR ALL TO authenticated
  USING (shop_id = get_my_shop_id())
  WITH CHECK (shop_id = get_my_shop_id());

-- lpg_cylinders
ALTER TABLE lpg_cylinders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS lpg_cylinders_tenant ON lpg_cylinders;
CREATE POLICY lpg_cylinders_tenant ON lpg_cylinders
  FOR ALL TO authenticated
  USING (shop_id = get_my_shop_id())
  WITH CHECK (shop_id = get_my_shop_id());

-- lpg_sales
ALTER TABLE lpg_sales ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS lpg_sales_tenant ON lpg_sales;
CREATE POLICY lpg_sales_tenant ON lpg_sales
  FOR ALL TO authenticated
  USING (shop_id = get_my_shop_id())
  WITH CHECK (shop_id = get_my_shop_id());

-- lpg_customers
ALTER TABLE lpg_customers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS lpg_customers_tenant ON lpg_customers;
CREATE POLICY lpg_customers_tenant ON lpg_customers
  FOR ALL TO authenticated
  USING (shop_id = get_my_shop_id())
  WITH CHECK (shop_id = get_my_shop_id());

-- weight_logs
ALTER TABLE weight_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS weight_logs_tenant ON weight_logs;
CREATE POLICY weight_logs_tenant ON weight_logs
  FOR ALL TO authenticated
  USING (shop_id = get_my_shop_id())
  WITH CHECK (shop_id = get_my_shop_id());

-- fbr_logs
ALTER TABLE fbr_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS fbr_logs_tenant ON fbr_logs;
CREATE POLICY fbr_logs_tenant ON fbr_logs
  FOR ALL TO authenticated
  USING (shop_id = get_my_shop_id())
  WITH CHECK (shop_id = get_my_shop_id());

-- ============================================================
-- DIRECT MEMBERSHIPS & TENANCY CONTROL
-- ============================================================

-- shops
ALTER TABLE shops ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS shops_tenant_select ON shops;
CREATE POLICY shops_tenant_select ON shops
  FOR SELECT TO public
  USING (
    id IN (
      SELECT shop_id 
      FROM public.user_shops 
      WHERE user_id = auth.uid()
    )
    OR owner_id = auth.uid()
    OR auth.uid() IS NULL
  );

DROP POLICY IF EXISTS shops_tenant_update ON shops;
CREATE POLICY shops_tenant_update ON shops
  FOR UPDATE TO authenticated
  USING (id = get_my_shop_id())
  WITH CHECK (id = get_my_shop_id());

DROP POLICY IF EXISTS shops_tenant_delete ON shops;
CREATE POLICY shops_tenant_delete ON shops
  FOR DELETE TO authenticated
  USING (id = get_my_shop_id());

DROP POLICY IF EXISTS shops_insert ON shops;
CREATE POLICY shops_insert ON shops
  FOR INSERT TO public
  WITH CHECK (true);

-- user_shops
ALTER TABLE user_shops ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS user_shops_tenant_select ON user_shops;
CREATE POLICY user_shops_tenant_select ON user_shops
  FOR SELECT TO authenticated
  USING (shop_id = get_my_shop_id() OR user_id = auth.uid());

DROP POLICY IF EXISTS user_shops_tenant_insert ON user_shops;
CREATE POLICY user_shops_tenant_insert ON user_shops
  FOR INSERT TO public
  WITH CHECK (true);

DROP POLICY IF EXISTS user_shops_tenant_update ON user_shops;
CREATE POLICY user_shops_tenant_update ON user_shops
  FOR UPDATE TO authenticated
  USING (shop_id = get_my_shop_id() OR user_id = auth.uid())
  WITH CHECK (shop_id = get_my_shop_id() OR user_id = auth.uid());

DROP POLICY IF EXISTS user_shops_tenant_delete ON user_shops;
CREATE POLICY user_shops_tenant_delete ON user_shops
  FOR DELETE TO authenticated
  USING (shop_id = get_my_shop_id() OR user_id = auth.uid());

