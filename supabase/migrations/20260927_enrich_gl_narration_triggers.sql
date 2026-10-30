-- =========================================================================
-- Upgrade GL Auto-Posting Triggers to include Customer & Supplier names
-- =========================================================================

CREATE OR REPLACE FUNCTION public.post_invoice_to_gl() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    v_journal_id   UUID;
    v_total_cost   DECIMAL(15,2) := 0;
    v_credit_amt   DECIMAL(15,2) := 0;
    v_cash_amt     DECIMAL(15,2) := 0;
    r_item         RECORD;
BEGIN
    IF NEW.status = 'completed'
        AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'completed')
    THEN
        -- 1. Create Journal Entry header with rich customer name & bill number
        INSERT INTO public.journal_entries (
            shop_id, entry_date, ref_type, ref_id, narration, closing_book_id
        ) VALUES (
            NEW.shop_id,
            COALESCE(NEW.created_at::DATE, CURRENT_DATE),
            'invoice',
            NEW.id,
            'POS Sale #' || UPPER(SUBSTRING(NEW.id::TEXT, 1, 8)) || COALESCE(' • Customer: ' || NULLIF(NEW.customer_name, ''), (SELECT ' • Customer: ' || name FROM public.parties WHERE id = NEW.party_id), ' • Walk-in Customer'),
            NEW.closing_book_id
        )
        RETURNING id INTO v_journal_id;

        -- 2. Calculate total COGS from invoice_items
        SELECT COALESCE(SUM(
            ii.quantity * COALESCE(p.purchase_price_single, 0)
        ), 0)
        INTO v_total_cost
        FROM public.invoice_items ii
        JOIN public.products p ON p.id = ii.product_id
        WHERE ii.invoice_id = NEW.id;

        -- 3. Determine cash vs credit split
        v_cash_amt   := COALESCE(NEW.paid_amount, 0);
        v_credit_amt := COALESCE(NEW.total_amount, 0) - v_cash_amt;

        -- 4A. Credit: Sales Revenue (4001)
        INSERT INTO public.journal_lines (entry_id, account_code, account_name, debit, credit)
        VALUES (v_journal_id, '4001', 'Sales Revenue', 0, COALESCE(NEW.total_amount, 0));

        -- 4B. Debit: Cash in Hand (1001) for the paid portion
        IF v_cash_amt > 0 THEN
            INSERT INTO public.journal_lines (entry_id, account_code, account_name, debit, credit)
            VALUES (v_journal_id, '1001', 'Cash & Bank Accounts', v_cash_amt, 0);
        END IF;

        -- 4C. Debit: Accounts Receivable (1002) for the credit portion
        IF v_credit_amt > 0 THEN
            INSERT INTO public.journal_lines (entry_id, account_code, account_name, debit, credit)
            VALUES (v_journal_id, '1002', 'Accounts Receivable (Customers)', v_credit_amt, 0);
        END IF;

        -- 4D. Debit COGS (5001) + Credit Inventory (1003)
        IF v_total_cost > 0 THEN
            INSERT INTO public.journal_lines (entry_id, account_code, account_name, debit, credit)
            VALUES (v_journal_id, '5001', 'Cost of Goods / Purchases', v_total_cost, 0);

            INSERT INTO public.journal_lines (entry_id, account_code, account_name, debit, credit)
            VALUES (v_journal_id, '1003', 'Stock / Inventory Asset', 0, v_total_cost);
        END IF;

        -- 4E. Post discount allowed (5002) if any
        IF COALESCE(NEW.discount, 0) > 0 THEN
            INSERT INTO public.journal_lines (entry_id, account_code, account_name, debit, credit)
            VALUES (v_journal_id, '5002', 'Discount Allowed', NEW.discount, 0);

            INSERT INTO public.journal_lines (entry_id, account_code, account_name, debit, credit)
            VALUES (v_journal_id, '4001', 'Sales Revenue', 0, -NEW.discount);
        END IF;

    END IF;
    RETURN NEW;
END;
$$;


CREATE OR REPLACE FUNCTION public.post_purchase_to_gl() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    v_journal_id   UUID;
    v_credit_amt   DECIMAL(15,2) := 0;
    v_cash_amt     DECIMAL(15,2) := 0;
BEGIN
    IF NEW.status IN ('PAID', 'PARTIAL', 'CREDIT')
        AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM NEW.status)
        AND NOT COALESCE(NEW.is_voided, FALSE)
    THEN
        -- 1. Create Journal Entry header with rich supplier name & PO number
        INSERT INTO public.journal_entries (
            shop_id, entry_date, ref_type, ref_id, narration, closing_book_id
        ) VALUES (
            NEW.shop_id,
            COALESCE(NEW.created_at::DATE, CURRENT_DATE),
            'purchase',
            NEW.id,
            'Purchase #' || UPPER(SUBSTRING(NEW.id::TEXT, 1, 8))
              || COALESCE(' | Inv: ' || NULLIF(NEW.invoice_number, ''), '')
              || COALESCE(' • Supplier: ' || NULLIF(NEW.supplier_name, ''), (SELECT ' • Supplier: ' || name FROM public.parties WHERE id = NEW.party_id), ''),
            NEW.closing_book_id
        )
        RETURNING id INTO v_journal_id;

        v_cash_amt   := COALESCE(NEW.paid_amount, 0);
        v_credit_amt := COALESCE(NEW.total_amount, 0) - v_cash_amt;

        -- 2A. Debit: Inventory / Stock Asset (1003)
        INSERT INTO public.journal_lines (entry_id, account_code, account_name, debit, credit)
        VALUES (v_journal_id, '1003', 'Stock / Inventory Asset', COALESCE(NEW.total_amount, 0), 0);

        -- 2B. Credit: Cash & Bank (1001) for paid portion
        IF v_cash_amt > 0 THEN
            INSERT INTO public.journal_lines (entry_id, account_code, account_name, debit, credit)
            VALUES (v_journal_id, '1001', 'Cash & Bank Accounts', 0, v_cash_amt);
        END IF;

        -- 2C. Credit: Accounts Payable (2001) for credit portion
        IF v_credit_amt > 0 THEN
            INSERT INTO public.journal_lines (entry_id, account_code, account_name, debit, credit)
            VALUES (v_journal_id, '2001', 'Accounts Payable (Suppliers)', 0, v_credit_amt);
        END IF;

        -- 2D. Post discount received (4002) if any
        IF COALESCE(NEW.discount, 0) > 0 THEN
            INSERT INTO public.journal_lines (entry_id, account_code, account_name, debit, credit)
            VALUES (v_journal_id, '1003', 'Stock / Inventory Asset', 0, NEW.discount);

            INSERT INTO public.journal_lines (entry_id, account_code, account_name, debit, credit)
            VALUES (v_journal_id, '4002', 'Discount Received', 0, -NEW.discount);
        END IF;

    END IF;
    RETURN NEW;
END;
$$;
