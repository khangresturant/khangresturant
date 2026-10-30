-- ==============================================================================
-- AUTOMATED REAL-TIME PARTY BALANCE RECONCILIATION ENGINE & DATABASE TRIGGERS
-- Ensures parties.current_balance is mathematically consistent and always in sync
-- with purchase_orders, invoices, credit_transactions, and returns.
-- ==============================================================================

-- 1. Create or replace the atomic Party Balance Recalculation function
CREATE OR REPLACE FUNCTION public.recalculate_party_balance(p_party_id UUID)
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_party RECORD;
  v_po_outstanding NUMERIC := 0;
  v_inv_outstanding NUMERIC := 0;
  v_sales_return NUMERIC := 0;
  v_purch_return NUMERIC := 0;
  v_manual_payments NUMERIC := 0;
  v_manual_charges NUMERIC := 0;
  v_computed_balance NUMERIC := 0;
BEGIN
  IF p_party_id IS NULL THEN
    RETURN 0;
  END IF;

  SELECT id, shop_id, type INTO v_party
  FROM public.parties
  WHERE id = p_party_id;

  IF NOT FOUND THEN
    RETURN 0;
  END IF;

  -- A. Purchase Orders (Gross outstanding credit balance owed to supplier)
  SELECT COALESCE(SUM(total_amount - paid_amount), 0)
  INTO v_po_outstanding
  FROM public.purchase_orders
  WHERE supplier_id = p_party_id AND is_voided = false;

  -- B. Sales Invoices (Gross outstanding credit balance receivable from customer)
  SELECT COALESCE(SUM(total_amount - paid_amount), 0)
  INTO v_inv_outstanding
  FROM public.invoices
  WHERE party_id = p_party_id AND is_voided = false AND COALESCE(status, '') != 'quotation';

  -- C. Returns
  BEGIN
    SELECT 
      COALESCE(SUM(CASE WHEN type = 'sales' THEN total_amount ELSE 0 END), 0),
      COALESCE(SUM(CASE WHEN type = 'purchase' THEN total_amount ELSE 0 END), 0)
    INTO v_sales_return, v_purch_return
    FROM public.returns
    WHERE party_id = p_party_id;
  EXCEPTION WHEN OTHERS THEN
    v_sales_return := 0;
    v_purch_return := 0;
  END;

  -- D. Manual Credit Transactions (Excluding automated billing logs)
  SELECT 
    COALESCE(SUM(CASE WHEN transaction_type IN ('payment', 'receive') THEN amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN transaction_type NOT IN ('payment', 'receive') THEN amount ELSE 0 END), 0)
  INTO v_manual_payments, v_manual_charges
  FROM public.credit_transactions
  WHERE customer_id = p_party_id
    AND NOT (
      COALESCE(remarks, '') ILIKE 'Purchase Order Billing #%' OR 
      COALESCE(remarks, '') ILIKE 'Purchase Bill #%' OR 
      COALESCE(remarks, '') ILIKE 'Invoice Billing #%' OR 
      COALESCE(remarks, '') ILIKE 'Invoice Bill #%' OR 
      COALESCE(remarks, '') ILIKE 'Sale Bill #%' OR
      COALESCE(remarks, '') ILIKE 'Edit Reversal POS Sale #%' OR
      COALESCE(remarks, '') ILIKE 'Purchase Void Reversal #%' OR
      COALESCE(remarks, '') ILIKE 'Voided Invoice #%' OR
      COALESCE(remarks, '') ILIKE 'Void POS Sale #%'
    );

  -- E. Net Balance Formula according to Party Role
  IF v_party.type = 'supplier' THEN
    v_computed_balance := (v_po_outstanding - v_purch_return) + v_manual_charges - v_manual_payments;
  ELSIF v_party.type = 'customer' THEN
    v_computed_balance := (v_inv_outstanding - v_sales_return) + v_manual_charges - v_manual_payments;
  ELSIF v_party.type = 'dual' THEN
    v_computed_balance := (v_inv_outstanding - v_sales_return) - (v_po_outstanding - v_purch_return) + v_manual_charges - v_manual_payments;
  ELSE
    v_computed_balance := (v_inv_outstanding - v_sales_return) + v_manual_charges - v_manual_payments;
  END IF;

  -- Update parties table
  UPDATE public.parties
  SET current_balance = ROUND(v_computed_balance, 2)
  WHERE id = p_party_id;

  RETURN v_computed_balance;
END;
$$;

-- 2. Bulk Reconciliation function for entire shop or all shops
CREATE OR REPLACE FUNCTION public.reconcile_all_party_balances(p_shop_id UUID DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  r RECORD;
  v_count INT := 0;
BEGIN
  FOR r IN 
    SELECT id 
    FROM public.parties 
    WHERE (p_shop_id IS NULL OR shop_id = p_shop_id)
  LOOP
    PERFORM public.recalculate_party_balance(r.id);
    v_count := v_count + 1;
  END LOOP;

  RETURN jsonb_build_object('status', 'success', 'reconciled_parties_count', v_count);
END;
$$;

-- 3. Trigger Function on Purchase Orders
CREATE OR REPLACE FUNCTION public.trg_fn_sync_party_on_po()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.supplier_id IS NOT NULL THEN
      PERFORM public.recalculate_party_balance(OLD.supplier_id);
    END IF;
    RETURN OLD;
  ELSE
    IF NEW.supplier_id IS NOT NULL THEN
      PERFORM public.recalculate_party_balance(NEW.supplier_id);
    END IF;
    IF TG_OP = 'UPDATE' AND OLD.supplier_id IS NOT NULL AND OLD.supplier_id IS DISTINCT FROM NEW.supplier_id THEN
      PERFORM public.recalculate_party_balance(OLD.supplier_id);
    END IF;
    RETURN NEW;
  END IF;
END;
$$;

-- 4. Trigger Function on Invoices
CREATE OR REPLACE FUNCTION public.trg_fn_sync_party_on_invoice()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.party_id IS NOT NULL THEN
      PERFORM public.recalculate_party_balance(OLD.party_id);
    END IF;
    RETURN OLD;
  ELSE
    IF NEW.party_id IS NOT NULL THEN
      PERFORM public.recalculate_party_balance(NEW.party_id);
    END IF;
    IF TG_OP = 'UPDATE' AND OLD.party_id IS NOT NULL AND OLD.party_id IS DISTINCT FROM NEW.party_id THEN
      PERFORM public.recalculate_party_balance(OLD.party_id);
    END IF;
    RETURN NEW;
  END IF;
END;
$$;

-- 5. Trigger Function on Credit Transactions (Payments, Adjustments)
CREATE OR REPLACE FUNCTION public.trg_fn_sync_party_on_credit_tx()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.customer_id IS NOT NULL THEN
      PERFORM public.recalculate_party_balance(OLD.customer_id);
    END IF;
    RETURN OLD;
  ELSE
    IF NEW.customer_id IS NOT NULL THEN
      PERFORM public.recalculate_party_balance(NEW.customer_id);
    END IF;
    IF TG_OP = 'UPDATE' AND OLD.customer_id IS NOT NULL AND OLD.customer_id IS DISTINCT FROM NEW.customer_id THEN
      PERFORM public.recalculate_party_balance(OLD.customer_id);
    END IF;
    RETURN NEW;
  END IF;
END;
$$;

-- 6. Trigger Function on Returns
CREATE OR REPLACE FUNCTION public.trg_fn_sync_party_on_return()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.party_id IS NOT NULL THEN
      PERFORM public.recalculate_party_balance(OLD.party_id);
    END IF;
    RETURN OLD;
  ELSE
    IF NEW.party_id IS NOT NULL THEN
      PERFORM public.recalculate_party_balance(NEW.party_id);
    END IF;
    IF TG_OP = 'UPDATE' AND OLD.party_id IS NOT NULL AND OLD.party_id IS DISTINCT FROM NEW.party_id THEN
      PERFORM public.recalculate_party_balance(OLD.party_id);
    END IF;
    RETURN NEW;
  END IF;
END;
$$;

-- Drop existing if any, then create triggers
DROP TRIGGER IF EXISTS trg_party_balance_sync_po ON public.purchase_orders;
CREATE TRIGGER trg_party_balance_sync_po
  AFTER INSERT OR UPDATE OR DELETE ON public.purchase_orders
  FOR EACH ROW EXECUTE FUNCTION public.trg_fn_sync_party_on_po();

DROP TRIGGER IF EXISTS trg_party_balance_sync_inv ON public.invoices;
CREATE TRIGGER trg_party_balance_sync_inv
  AFTER INSERT OR UPDATE OR DELETE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.trg_fn_sync_party_on_invoice();

DROP TRIGGER IF EXISTS trg_party_balance_sync_ctx ON public.credit_transactions;
CREATE TRIGGER trg_party_balance_sync_ctx
  AFTER INSERT OR UPDATE OR DELETE ON public.credit_transactions
  FOR EACH ROW EXECUTE FUNCTION public.trg_fn_sync_party_on_credit_tx();

DROP TRIGGER IF EXISTS trg_party_balance_sync_ret ON public.returns;
CREATE TRIGGER trg_party_balance_sync_ret
  AFTER INSERT OR UPDATE OR DELETE ON public.returns
  FOR EACH ROW EXECUTE FUNCTION public.trg_fn_sync_party_on_return();
