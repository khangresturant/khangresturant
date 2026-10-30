DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT t.table_name
        FROM information_schema.tables t
        JOIN information_schema.columns c 
            ON t.table_name = c.table_name AND c.column_name = 'shop_id'
        WHERE t.table_schema = 'public'
          AND NOT EXISTS (
              SELECT 1 FROM pg_indexes i 
              WHERE i.schemaname = 'public' 
                AND i.tablename = t.table_name 
                AND i.indexdef LIKE '%shop_id%'
          )
    ) LOOP
        EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON public.%I USING btree (shop_id);', 'idx_' || r.table_name || '_shop_id', r.table_name);
        RAISE NOTICE 'Created index on %', r.table_name;
    END LOOP;
END
$$;

CREATE INDEX IF NOT EXISTS idx_stock_product_id ON public.stock USING btree (product_id);
CREATE INDEX IF NOT EXISTS idx_register_sessions_status ON public.register_sessions USING btree (status);
CREATE INDEX IF NOT EXISTS idx_register_sessions_opened_at ON public.register_sessions USING btree (opened_at DESC);
CREATE INDEX IF NOT EXISTS idx_parties_type ON public.parties USING btree (type);
CREATE INDEX IF NOT EXISTS idx_parties_name ON public.parties USING btree (name);
CREATE INDEX IF NOT EXISTS idx_formulations_name ON public.formulations USING btree (name);
CREATE INDEX IF NOT EXISTS idx_closing_books_closed_at ON public.closing_books USING btree (closed_at DESC);

ANALYZE;
