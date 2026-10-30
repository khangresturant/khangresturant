-- =============================================================================
-- HisabX Phase 1 — Core RLS policies (G-01 / AUTHZ-01)
-- Apply on staging first. Review with your DBA before production.
-- =============================================================================
-- Prerequisites: tables shops, user_profiles, user_shops, products, invoices, etc.
-- Service role key bypasses RLS (server admin routes).

-- Helpers --------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.is_superadmin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_profiles up
    WHERE up.id = auth.uid()
      AND lower(coalesce(up.role, '')) = 'superadmin'
  );
$$;

CREATE OR REPLACE FUNCTION public.user_shop_ids()
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT shop_id
  FROM public.user_profiles
  WHERE id = auth.uid()
    AND shop_id IS NOT NULL
  UNION
  SELECT shop_id
  FROM public.user_shops
  WHERE user_id = auth.uid()
    AND shop_id IS NOT NULL;
$$;

CREATE OR REPLACE FUNCTION public.user_has_shop(target uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_superadmin()
    OR target IN (SELECT public.user_shop_ids());
$$;

REVOKE ALL ON FUNCTION public.is_superadmin() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.user_shop_ids() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.user_has_shop(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_superadmin() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.user_shop_ids() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.user_has_shop(uuid) TO authenticated, anon;

-- Generic enabler for shop-scoped tables ------------------------------------

DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'shops',
    'user_profiles',
    'user_shops',
    'products',
    'categories',
    'brands',
    'units',
    'product_variants',
    'product_barcodes',
    'product_imeis',
    'parties',
    'invoices',
    'invoice_items',
    'purchase_orders',
    'purchase_order_items',
    'returns',
    'return_items',
    'cash_accounts',
    'account_transactions',
    'credit_transactions',
    'expenses',
    'register_sessions',
    'company_details',
    'print_settings',
    'audit_logs',
    'gift_cards',
    'gift_card_transactions',
    'installment_plans',
    'installment_payments',
    'emi_schedules',
    'repair_tickets',
    'stock',
    'stock_adjustments'
  ];
BEGIN
  FOREACH t IN ARRAY tables
  LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = t
    ) THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    END IF;
  END LOOP;
END $$;

-- Drop old policies if re-running (idempotent-ish) --------------------------

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT policyname, tablename
    FROM pg_policies
    WHERE schemaname = 'public'
      AND policyname LIKE 'hx_rls_%'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.policyname, r.tablename);
  END LOOP;
END $$;

-- shops ---------------------------------------------------------------------

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='shops') THEN
    EXECUTE $p$
      CREATE POLICY hx_rls_shops_select ON public.shops
      FOR SELECT TO public
      USING (
        public.is_superadmin() 
        OR id IN (SELECT public.user_shop_ids())
        OR owner_id = auth.uid()
        OR auth.uid() IS NULL
      )
    $p$;
    EXECUTE $p$
      CREATE POLICY hx_rls_shops_update ON public.shops
      FOR UPDATE TO authenticated
      USING (public.is_superadmin() OR id IN (SELECT public.user_shop_ids()))
      WITH CHECK (public.is_superadmin() OR id IN (SELECT public.user_shop_ids()))
    $p$;
    -- insert typically via register flow / service role
    EXECUTE $p$
      CREATE POLICY hx_rls_shops_insert ON public.shops
      FOR INSERT TO public
      WITH CHECK (true)
    $p$;
  END IF;
END $$;

-- user_profiles -------------------------------------------------------------

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='user_profiles') THEN
    EXECUTE $p$
      CREATE POLICY hx_rls_profiles_select ON public.user_profiles
      FOR SELECT TO public
      USING (
        public.is_superadmin()
        OR id = auth.uid()
        OR shop_id IN (SELECT public.user_shop_ids())
        OR auth.uid() IS NULL
      )
    $p$;
    EXECUTE $p$
      CREATE POLICY hx_rls_profiles_update ON public.user_profiles
      FOR UPDATE TO authenticated
      USING (public.is_superadmin() OR id = auth.uid())
      WITH CHECK (public.is_superadmin() OR id = auth.uid())
    $p$;
    EXECUTE $p$
      CREATE POLICY hx_rls_profiles_insert ON public.user_profiles
      FOR INSERT TO public
      WITH CHECK (true)
    $p$;
  END IF;
END $$;

-- user_shops ----------------------------------------------------------------

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='user_shops') THEN
    EXECUTE $p$
      CREATE POLICY hx_rls_user_shops_select ON public.user_shops
      FOR SELECT TO authenticated
      USING (public.is_superadmin() OR user_id = auth.uid() OR shop_id IN (SELECT public.user_shop_ids()))
    $p$;
    EXECUTE $p$
      CREATE POLICY hx_rls_user_shops_insert ON public.user_shops
      FOR INSERT TO public
      WITH CHECK (true)
    $p$;
    EXECUTE $p$
      CREATE POLICY hx_rls_user_shops_update ON public.user_shops
      FOR UPDATE TO authenticated
      USING (public.is_superadmin() OR user_id = auth.uid())
      WITH CHECK (public.is_superadmin() OR user_id = auth.uid())
    $p$;
    EXECUTE $p$
      CREATE POLICY hx_rls_user_shops_delete ON public.user_shops
      FOR DELETE TO authenticated
      USING (public.is_superadmin() OR user_id = auth.uid())
    $p$;
  END IF;
END $$;

-- Shop-scoped tables (shop_id column) ---------------------------------------

DO $$
DECLARE
  t text;
  shop_tables text[] := ARRAY[
    'products','categories','brands','units','product_variants','product_barcodes',
    'product_imeis','parties','invoices','purchase_orders','returns','cash_accounts',
    'account_transactions','credit_transactions','expenses','register_sessions',
    'company_details','print_settings','audit_logs','gift_cards',
    'installment_plans','repair_tickets','stock','stock_adjustments'
  ];
BEGIN
  FOREACH t IN ARRAY shop_tables
  LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = t AND column_name = 'shop_id'
    ) THEN
      EXECUTE format(
        'CREATE POLICY hx_rls_%s_select ON public.%I FOR SELECT TO authenticated USING (public.is_superadmin() OR public.user_has_shop(shop_id))',
        t, t
      );
      EXECUTE format(
        'CREATE POLICY hx_rls_%s_insert ON public.%I FOR INSERT TO authenticated WITH CHECK (public.is_superadmin() OR public.user_has_shop(shop_id))',
        t, t
      );
      EXECUTE format(
        'CREATE POLICY hx_rls_%s_update ON public.%I FOR UPDATE TO authenticated USING (public.is_superadmin() OR public.user_has_shop(shop_id)) WITH CHECK (public.is_superadmin() OR public.user_has_shop(shop_id))',
        t, t
      );
      EXECUTE format(
        'CREATE POLICY hx_rls_%s_delete ON public.%I FOR DELETE TO authenticated USING (public.is_superadmin() OR public.user_has_shop(shop_id))',
        t, t
      );
    END IF;
  END LOOP;
END $$;

-- Child tables via parent invoice / PO / return ----------------------------

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='invoice_items') THEN
    EXECUTE $p$
      CREATE POLICY hx_rls_invoice_items_all ON public.invoice_items
      FOR ALL TO authenticated
      USING (
        public.is_superadmin() OR EXISTS (
          SELECT 1 FROM public.invoices i
          WHERE i.id = invoice_items.invoice_id
            AND public.user_has_shop(i.shop_id)
        )
      )
      WITH CHECK (
        public.is_superadmin() OR EXISTS (
          SELECT 1 FROM public.invoices i
          WHERE i.id = invoice_items.invoice_id
            AND public.user_has_shop(i.shop_id)
        )
      )
    $p$;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='purchase_order_items') THEN
    EXECUTE $p$
      CREATE POLICY hx_rls_po_items_all ON public.purchase_order_items
      FOR ALL TO authenticated
      USING (
        public.is_superadmin() OR EXISTS (
          SELECT 1 FROM public.purchase_orders po
          WHERE po.id = purchase_order_items.purchase_order_id
            AND public.user_has_shop(po.shop_id)
        )
      )
      WITH CHECK (
        public.is_superadmin() OR EXISTS (
          SELECT 1 FROM public.purchase_orders po
          WHERE po.id = purchase_order_items.purchase_order_id
            AND public.user_has_shop(po.shop_id)
        )
      )
    $p$;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='return_items') THEN
    EXECUTE $p$
      CREATE POLICY hx_rls_return_items_all ON public.return_items
      FOR ALL TO authenticated
      USING (
        public.is_superadmin() OR EXISTS (
          SELECT 1 FROM public.returns r
          WHERE r.id = return_items.return_id
            AND public.user_has_shop(r.shop_id)
        )
      )
      WITH CHECK (
        public.is_superadmin() OR EXISTS (
          SELECT 1 FROM public.returns r
          WHERE r.id = return_items.return_id
            AND public.user_has_shop(r.shop_id)
        )
      )
    $p$;
  END IF;
END $$;

-- Public receipt: allow anon read of non-voided invoices by id is NOT granted.
-- Public page should use a controlled RPC or service role later (PRC-01).

NOTIFY pgrst, 'reload schema';
