-- =============================================================================
-- HisabX Phase 2 — Atomic money RPCs
-- pos_checkout | void_invoice | restore_invoice | apply_party_payment | receive_purchase
-- Apply on staging first. Requires Phase 1 helpers (user_has_shop / is_superadmin) if present.
-- =============================================================================

-- Fallback shop access helpers if Phase 1 not applied yet ---------------------
CREATE OR REPLACE FUNCTION public.hx_user_has_shop(target uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT public.is_superadmin()),
    false
  )
  OR EXISTS (
    SELECT 1 FROM public.user_profiles up
    WHERE up.id = auth.uid() AND up.shop_id = target
  )
  OR EXISTS (
    SELECT 1 FROM public.user_shops us
    WHERE us.user_id = auth.uid() AND us.shop_id = target
  );
$$;

-- Safe stock helpers (create if missing) --------------------------------------
CREATE OR REPLACE FUNCTION public.decrement_product_stock(p_id uuid, qty numeric)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.products
  SET current_stock = COALESCE(current_stock, 0) - qty
  WHERE id = p_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.decrement_variant_stock(v_id uuid, qty numeric)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.product_variants
  SET stock_quantity = COALESCE(stock_quantity, 0) - qty
  WHERE id = v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.increment_party_balance(p_id uuid, amount numeric)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.parties
  SET current_balance = COALESCE(current_balance, 0) + amount
  WHERE id = p_id;
END;
$$;

-- ---------------------------------------------------------------------------
-- pos_checkout(p_payload jsonb) → jsonb { invoice_id, created_at, status }
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.pos_checkout(p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_shop_id uuid := (p_payload->>'shop_id')::uuid;
  v_invoice_id uuid := COALESCE((p_payload->>'invoice_id')::uuid, gen_random_uuid());
  v_edit_id uuid := NULLIF(p_payload->>'edit_invoice_id','')::uuid;
  v_party_id uuid := NULLIF(p_payload->>'party_id','')::uuid;
  v_account_id uuid := NULLIF(p_payload->>'account_id','')::uuid;
  v_register_id uuid := NULLIF(p_payload->>'register_session_id','')::uuid;
  v_total numeric := COALESCE((p_payload->>'total_amount')::numeric, 0);
  v_tax numeric := COALESCE((p_payload->>'tax_amount')::numeric, 0);
  v_discount numeric := COALESCE((p_payload->>'discount')::numeric, 0);
  v_paid numeric := COALESCE((p_payload->>'paid_amount')::numeric, 0);
  v_status text := COALESCE(p_payload->>'status', 'paid');
  v_payment_mode text := COALESCE(p_payload->>'payment_mode', 'cash');
  v_remarks text := p_payload->>'remarks';
  v_credit_amount numeric := COALESCE((p_payload->>'credit_amount')::numeric, 0);
  v_cash_amount numeric := COALESCE((p_payload->>'cash_amount')::numeric, 0);
  v_gift_card_id uuid := NULLIF(p_payload->>'gift_card_id','')::uuid;
  v_gift_card_amount numeric := COALESCE((p_payload->>'gift_card_amount')::numeric, 0);
  v_loyalty_delta numeric := COALESCE((p_payload->>'loyalty_points_delta')::numeric, 0);
  v_is_quotation boolean := COALESCE((p_payload->>'is_quotation')::boolean, false);
  v_item jsonb;
  v_item_id uuid;
  v_product_id uuid;
  v_variant_id uuid;
  v_qty numeric;
  v_stock_qty numeric;
  v_imei_ids jsonb;
  v_imei_id uuid;
  v_created_at timestamptz;
  v_existing uuid;
  v_old_item record;
  v_pack record;
  v_emi jsonb;
BEGIN
  IF v_shop_id IS NULL THEN
    RAISE EXCEPTION 'shop_id is required';
  END IF;

  IF auth.uid() IS NOT NULL AND NOT public.hx_user_has_shop(v_shop_id) THEN
    RAISE EXCEPTION 'Access denied for shop %', v_shop_id;
  END IF;

  -- Idempotent create: same invoice id already exists
  IF v_edit_id IS NULL THEN
    SELECT id, created_at, status INTO v_existing, v_created_at, v_status
    FROM public.invoices WHERE id = v_invoice_id;
    IF FOUND THEN
      RETURN jsonb_build_object(
        'invoice_id', v_existing,
        'created_at', v_created_at,
        'status', v_status,
        'idempotent', true
      );
    END IF;
  END IF;

  -- Edit path: reverse old stock / credit before replacing
  IF v_edit_id IS NOT NULL THEN
    v_invoice_id := v_edit_id;

    FOR v_old_item IN
      SELECT product_id, variant_id, quantity FROM public.invoice_items WHERE invoice_id = v_edit_id
    LOOP
      IF v_old_item.variant_id IS NOT NULL THEN
        SELECT is_packing, pack_size INTO v_pack FROM public.product_variants WHERE id = v_old_item.variant_id;
        IF v_pack.is_packing AND COALESCE(v_pack.pack_size, 0) > 0 THEN
          PERFORM public.decrement_product_stock(v_old_item.product_id, -v_old_item.quantity * v_pack.pack_size);
        ELSE
          PERFORM public.decrement_variant_stock(v_old_item.variant_id, -v_old_item.quantity);
        END IF;
      ELSE
        PERFORM public.decrement_product_stock(v_old_item.product_id, -v_old_item.quantity);
      END IF;
    END LOOP;

    -- Free IMEIs previously sold on this invoice
    UPDATE public.product_imeis pi
    SET status = 'available', sold_invoice_item_id = NULL
    WHERE pi.sold_invoice_item_id IN (
      SELECT id FROM public.invoice_items WHERE invoice_id = v_edit_id
    );

    -- Reverse unpaid credit on old invoice
    DECLARE
      v_old_party uuid;
      v_old_status text;
      v_old_total numeric;
      v_old_paid numeric;
      v_unpaid numeric;
    BEGIN
      SELECT party_id, status, total_amount, COALESCE(paid_amount,0)
        INTO v_old_party, v_old_status, v_old_total, v_old_paid
      FROM public.invoices WHERE id = v_edit_id;

      IF v_old_party IS NOT NULL AND v_old_status IS DISTINCT FROM 'paid' AND v_old_status IS DISTINCT FROM 'quotation' THEN
        v_unpaid := v_old_total - v_old_paid;
        IF v_unpaid > 0 THEN
          PERFORM public.increment_party_balance(v_old_party, -v_unpaid);
        END IF;
      END IF;
    END;

    DELETE FROM public.invoice_items WHERE invoice_id = v_edit_id;
    DELETE FROM public.emi_schedules WHERE invoice_id = v_edit_id;

    UPDATE public.invoices SET
      party_id = v_party_id,
      total_amount = v_total,
      tax_amount = v_tax,
      discount = v_discount,
      status = v_status,
      paid_amount = v_paid,
      payment_mode = v_payment_mode,
      register_session_id = v_register_id,
      account_id = v_account_id,
      is_edited = true,
      remarks = COALESCE(v_remarks, remarks)
    WHERE id = v_edit_id
    RETURNING created_at INTO v_created_at;
  ELSE
    INSERT INTO public.invoices (
      id, shop_id, party_id, total_amount, tax_amount, discount,
      status, paid_amount, payment_mode, register_session_id, account_id, remarks, is_voided
    ) VALUES (
      v_invoice_id, v_shop_id, v_party_id, v_total, v_tax, v_discount,
      v_status, v_paid, v_payment_mode, v_register_id, v_account_id, v_remarks, false
    )
    RETURNING created_at INTO v_created_at;
  END IF;

  -- Line items + stock + IMEI
  FOR v_item IN SELECT * FROM jsonb_array_elements(COALESCE(p_payload->'items', '[]'::jsonb))
  LOOP
    v_product_id := (v_item->>'product_id')::uuid;
    v_variant_id := NULLIF(v_item->>'variant_id','')::uuid;
    v_qty := COALESCE((v_item->>'quantity')::numeric, 0);
    v_stock_qty := COALESCE((v_item->>'stock_qty')::numeric, v_qty);

    INSERT INTO public.invoice_items (
      invoice_id, product_id, variant_id, quantity, unit_price, subtotal,
      packing_name, warranty, sold_imeis
    ) VALUES (
      v_invoice_id,
      v_product_id,
      v_variant_id,
      v_qty,
      COALESCE((v_item->>'unit_price')::numeric, 0),
      COALESCE((v_item->>'subtotal')::numeric, 0),
      NULLIF(v_item->>'packing_name',''),
      NULLIF(v_item->>'warranty',''),
      NULLIF(v_item->>'sold_imeis','')
    )
    RETURNING id INTO v_item_id;

    IF NOT v_is_quotation THEN
      IF v_variant_id IS NOT NULL AND COALESCE((v_item->>'is_packing')::boolean, false)
         AND COALESCE((v_item->>'pack_size')::numeric, 0) > 0 THEN
        PERFORM public.decrement_product_stock(
          v_product_id,
          v_stock_qty * (v_item->>'pack_size')::numeric
        );
      ELSIF v_variant_id IS NOT NULL THEN
        PERFORM public.decrement_variant_stock(v_variant_id, v_stock_qty);
      ELSE
        PERFORM public.decrement_product_stock(v_product_id, v_stock_qty);
      END IF;

      -- Mark IMEIs sold
      v_imei_ids := COALESCE(v_item->'imei_ids', '[]'::jsonb);
      FOR v_imei_id IN SELECT (jsonb_array_elements_text(v_imei_ids))::uuid
      LOOP
        UPDATE public.product_imeis
        SET status = 'sold', sold_invoice_item_id = v_item_id
        WHERE id = v_imei_id AND shop_id = v_shop_id;
      END LOOP;
    END IF;
  END LOOP;

  IF NOT v_is_quotation THEN
    -- Party credit
    IF v_credit_amount > 0 AND v_party_id IS NOT NULL THEN
      PERFORM public.increment_party_balance(v_party_id, v_credit_amount);
      INSERT INTO public.credit_transactions (shop_id, customer_id, amount, transaction_type, remarks)
      VALUES (
        v_shop_id, v_party_id, v_credit_amount, 'charge',
        'POS Sale #' || upper(left(v_invoice_id::text, 8))
      );
    END IF;

    -- Cash account deposit
    IF v_cash_amount > 0 AND v_account_id IS NOT NULL THEN
      UPDATE public.cash_accounts
      SET current_balance = COALESCE(current_balance, 0) + v_cash_amount
      WHERE id = v_account_id AND shop_id = v_shop_id;

      INSERT INTO public.account_transactions (
        shop_id, account_id, type, amount, ref_type, ref_id, remarks
      ) VALUES (
        v_shop_id, v_account_id, 'deposit', v_cash_amount, 'invoice', v_invoice_id,
        'POS Sale #' || upper(left(v_invoice_id::text, 8))
      );
    END IF;

    -- Gift card
    IF v_gift_card_id IS NOT NULL AND v_gift_card_amount > 0 THEN
      UPDATE public.gift_cards
      SET balance = GREATEST(0, COALESCE(balance, 0) - v_gift_card_amount)
      WHERE id = v_gift_card_id;

      INSERT INTO public.gift_card_transactions (gift_card_id, amount, transaction_type)
      VALUES (v_gift_card_id, v_gift_card_amount, 'debit');
    END IF;

    -- Loyalty
    IF v_loyalty_delta <> 0 AND v_party_id IS NOT NULL THEN
      UPDATE public.parties
      SET loyalty_points = GREATEST(0, COALESCE(loyalty_points, 0) + v_loyalty_delta)
      WHERE id = v_party_id;
    END IF;

    -- EMI schedules
    FOR v_emi IN SELECT * FROM jsonb_array_elements(COALESCE(p_payload->'emi_schedules', '[]'::jsonb))
    LOOP
      INSERT INTO public.emi_schedules (invoice_id, due_date, installment_amount, late_fee, status)
      VALUES (
        v_invoice_id,
        (v_emi->>'due_date')::date,
        COALESCE((v_emi->>'amount')::numeric, 0),
        0,
        COALESCE(v_emi->>'status', 'unpaid')
      );
    END LOOP;
  END IF;

  -- Audit
  INSERT INTO public.audit_logs (shop_id, user_id, action, table_name, record_id, details)
  VALUES (
    v_shop_id,
    auth.uid(),
    CASE WHEN v_edit_id IS NOT NULL THEN 'INVOICE_EDITED' ELSE 'INVOICE_CREATED' END,
    'invoices',
    v_invoice_id,
    jsonb_build_object(
      'total_amount', v_total,
      'payment_mode', v_payment_mode,
      'via', 'pos_checkout'
    )
  );

  RETURN jsonb_build_object(
    'invoice_id', v_invoice_id,
    'created_at', v_created_at,
    'status', v_status,
    'idempotent', false
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.pos_checkout(jsonb) TO authenticated;

-- ---------------------------------------------------------------------------
-- void_invoice / restore_invoice
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.void_invoice(p_invoice_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inv record;
  v_item record;
  v_pack record;
  v_unpaid numeric;
  v_cash numeric;
BEGIN
  SELECT * INTO v_inv FROM public.invoices WHERE id = p_invoice_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Invoice not found'; END IF;
  IF v_inv.is_voided THEN
    RETURN jsonb_build_object('invoice_id', p_invoice_id, 'already_voided', true);
  END IF;
  IF auth.uid() IS NOT NULL AND NOT public.hx_user_has_shop(v_inv.shop_id) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;
  IF v_inv.status = 'quotation' THEN
    UPDATE public.invoices SET is_voided = true WHERE id = p_invoice_id;
    RETURN jsonb_build_object('invoice_id', p_invoice_id, 'voided', true);
  END IF;

  -- Restock
  FOR v_item IN SELECT * FROM public.invoice_items WHERE invoice_id = p_invoice_id
  LOOP
    IF v_item.variant_id IS NOT NULL THEN
      SELECT is_packing, pack_size INTO v_pack FROM public.product_variants WHERE id = v_item.variant_id;
      IF v_pack.is_packing AND COALESCE(v_pack.pack_size, 0) > 0 THEN
        PERFORM public.decrement_product_stock(v_item.product_id, -v_item.quantity * v_pack.pack_size);
      ELSE
        PERFORM public.decrement_variant_stock(v_item.variant_id, -v_item.quantity);
      END IF;
    ELSE
      PERFORM public.decrement_product_stock(v_item.product_id, -v_item.quantity);
    END IF;
  END LOOP;

  -- Free IMEIs
  UPDATE public.product_imeis
  SET status = 'available', sold_invoice_item_id = NULL
  WHERE sold_invoice_item_id IN (SELECT id FROM public.invoice_items WHERE invoice_id = p_invoice_id);

  -- Reverse unpaid khata
  IF v_inv.party_id IS NOT NULL AND v_inv.status IS DISTINCT FROM 'paid' THEN
    v_unpaid := COALESCE(v_inv.total_amount, 0) - COALESCE(v_inv.paid_amount, 0);
    IF v_unpaid > 0 THEN
      PERFORM public.increment_party_balance(v_inv.party_id, -v_unpaid);
    END IF;
  END IF;

  -- Reverse cash deposit for this invoice (sum deposit account_transactions)
  SELECT COALESCE(SUM(amount), 0) INTO v_cash
  FROM public.account_transactions
  WHERE ref_type = 'invoice' AND ref_id = p_invoice_id AND type = 'deposit';

  IF v_cash > 0 AND v_inv.account_id IS NOT NULL THEN
    UPDATE public.cash_accounts
    SET current_balance = COALESCE(current_balance, 0) - v_cash
    WHERE id = v_inv.account_id;

    INSERT INTO public.account_transactions (
      shop_id, account_id, type, amount, ref_type, ref_id, remarks
    ) VALUES (
      v_inv.shop_id, v_inv.account_id, 'withdrawal', v_cash, 'invoice_void', p_invoice_id,
      'Void sale #' || upper(left(p_invoice_id::text, 8))
    );
  END IF;

  UPDATE public.invoices SET is_voided = true WHERE id = p_invoice_id;

  INSERT INTO public.audit_logs (shop_id, user_id, action, table_name, record_id, details)
  VALUES (v_inv.shop_id, auth.uid(), 'INVOICE_VOIDED', 'invoices', p_invoice_id, jsonb_build_object('via', 'void_invoice'));

  RETURN jsonb_build_object('invoice_id', p_invoice_id, 'voided', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.restore_invoice(p_invoice_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inv record;
  v_item record;
  v_pack record;
  v_unpaid numeric;
BEGIN
  SELECT * INTO v_inv FROM public.invoices WHERE id = p_invoice_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Invoice not found'; END IF;
  IF NOT COALESCE(v_inv.is_voided, false) THEN
    RETURN jsonb_build_object('invoice_id', p_invoice_id, 'already_active', true);
  END IF;
  IF auth.uid() IS NOT NULL AND NOT public.hx_user_has_shop(v_inv.shop_id) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  IF v_inv.status IS DISTINCT FROM 'quotation' THEN
    FOR v_item IN SELECT * FROM public.invoice_items WHERE invoice_id = p_invoice_id
    LOOP
      IF v_item.variant_id IS NOT NULL THEN
        SELECT is_packing, pack_size INTO v_pack FROM public.product_variants WHERE id = v_item.variant_id;
        IF v_pack.is_packing AND COALESCE(v_pack.pack_size, 0) > 0 THEN
          PERFORM public.decrement_product_stock(v_item.product_id, v_item.quantity * v_pack.pack_size);
        ELSE
          PERFORM public.decrement_variant_stock(v_item.variant_id, v_item.quantity);
        END IF;
      ELSE
        PERFORM public.decrement_product_stock(v_item.product_id, v_item.quantity);
      END IF;
    END LOOP;

    IF v_inv.party_id IS NOT NULL AND v_inv.status IS DISTINCT FROM 'paid' THEN
      v_unpaid := COALESCE(v_inv.total_amount, 0) - COALESCE(v_inv.paid_amount, 0);
      IF v_unpaid > 0 THEN
        PERFORM public.increment_party_balance(v_inv.party_id, v_unpaid);
      END IF;
    END IF;
  END IF;

  UPDATE public.invoices SET is_voided = false WHERE id = p_invoice_id;

  INSERT INTO public.audit_logs (shop_id, user_id, action, table_name, record_id, details)
  VALUES (v_inv.shop_id, auth.uid(), 'INVOICE_RESTORED', 'invoices', p_invoice_id, jsonb_build_object('via', 'restore_invoice'));

  RETURN jsonb_build_object('invoice_id', p_invoice_id, 'restored', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.void_invoice(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.restore_invoice(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- apply_party_payment
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.apply_party_payment(p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_shop_id uuid := (p_payload->>'shop_id')::uuid;
  v_party_id uuid := (p_payload->>'party_id')::uuid;
  v_amount numeric := COALESCE((p_payload->>'amount')::numeric, 0);
  v_balance_diff numeric := COALESCE((p_payload->>'balance_diff')::numeric, 0);
  v_tx_type text := COALESCE(p_payload->>'transaction_type', 'payment');
  v_account_id uuid := NULLIF(p_payload->>'account_id','')::uuid;
  v_account_tx_type text := COALESCE(p_payload->>'account_tx_type', 'deposit');
  v_remarks text := COALESCE(p_payload->>'remarks', '');
  v_tx_id uuid;
BEGIN
  IF v_shop_id IS NULL OR v_party_id IS NULL OR v_amount <= 0 THEN
    RAISE EXCEPTION 'shop_id, party_id and positive amount required';
  END IF;
  IF auth.uid() IS NOT NULL AND NOT public.hx_user_has_shop(v_shop_id) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  INSERT INTO public.credit_transactions (shop_id, customer_id, amount, transaction_type, remarks)
  VALUES (v_shop_id, v_party_id, v_amount, v_tx_type, v_remarks)
  RETURNING id INTO v_tx_id;

  IF v_account_id IS NOT NULL THEN
    IF v_account_tx_type = 'deposit' THEN
      UPDATE public.cash_accounts
      SET current_balance = COALESCE(current_balance, 0) + v_amount
      WHERE id = v_account_id AND shop_id = v_shop_id;
    ELSE
      UPDATE public.cash_accounts
      SET current_balance = COALESCE(current_balance, 0) - v_amount
      WHERE id = v_account_id AND shop_id = v_shop_id;
    END IF;

    INSERT INTO public.account_transactions (
      shop_id, account_id, type, amount, ref_type, ref_id, remarks
    ) VALUES (
      v_shop_id, v_account_id, v_account_tx_type, v_amount, 'party_tx', v_tx_id, v_remarks
    );
  END IF;

  PERFORM public.increment_party_balance(v_party_id, v_balance_diff);

  INSERT INTO public.audit_logs (shop_id, user_id, action, table_name, record_id, details)
  VALUES (
    v_shop_id, auth.uid(), 'PARTY_PAYMENT', 'credit_transactions', v_tx_id,
    jsonb_build_object('amount', v_amount, 'party_id', v_party_id, 'via', 'apply_party_payment')
  );

  RETURN jsonb_build_object('transaction_id', v_tx_id, 'ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.apply_party_payment(jsonb) TO authenticated;

-- ---------------------------------------------------------------------------
-- receive_purchase — atomic PO + stock + cash/credit (simplified WAC)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.receive_purchase(p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_shop_id uuid := (p_payload->>'shop_id')::uuid;
  v_po_id uuid := COALESCE((p_payload->>'purchase_order_id')::uuid, gen_random_uuid());
  v_supplier_id uuid := NULLIF(p_payload->>'supplier_id','')::uuid;
  v_total numeric := COALESCE((p_payload->>'total_amount')::numeric, 0);
  v_paid numeric := COALESCE((p_payload->>'paid_amount')::numeric, 0);
  v_discount numeric := COALESCE((p_payload->>'discount')::numeric, 0);
  v_tax numeric := COALESCE((p_payload->>'tax_amount')::numeric, 0);
  v_status text := COALESCE(p_payload->>'status', 'PAID');
  v_payment_mode text := COALESCE(p_payload->>'payment_mode', 'cash');
  v_notes text := p_payload->>'notes';
  v_invoice_number text := p_payload->>'invoice_number';
  v_account_id uuid := NULLIF(p_payload->>'account_id','')::uuid;
  v_credit_amount numeric := GREATEST(0, v_total - v_paid);
  v_item jsonb;
  v_product_id uuid;
  v_variant_id uuid;
  v_qty numeric;
  v_bonus numeric;
  v_eff_qty numeric;
  v_purchase_price numeric;
  v_sale_price numeric;
  v_existing uuid;
  v_party_type text;
  v_inc numeric;
BEGIN
  IF v_shop_id IS NULL THEN RAISE EXCEPTION 'shop_id required'; END IF;
  IF auth.uid() IS NOT NULL AND NOT public.hx_user_has_shop(v_shop_id) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  SELECT id INTO v_existing FROM public.purchase_orders WHERE id = v_po_id;
  IF FOUND THEN
    RETURN jsonb_build_object('purchase_order_id', v_existing, 'idempotent', true);
  END IF;

  INSERT INTO public.purchase_orders (
    id, shop_id, supplier_id, total_amount, paid_amount, discount, tax_amount,
    status, payment_mode, notes, invoice_number, is_voided, account_id
  ) VALUES (
    v_po_id, v_shop_id, v_supplier_id, v_total, v_paid, v_discount, v_tax,
    v_status, v_payment_mode, v_notes, v_invoice_number, false,
    CASE WHEN v_paid > 0 THEN v_account_id ELSE NULL END
  );

  IF v_credit_amount > 0 AND v_supplier_id IS NOT NULL THEN
    SELECT type INTO v_party_type FROM public.parties WHERE id = v_supplier_id;
    v_inc := CASE WHEN v_party_type = 'dual' THEN -v_credit_amount ELSE v_credit_amount END;
    PERFORM public.increment_party_balance(v_supplier_id, v_inc);
    INSERT INTO public.credit_transactions (shop_id, customer_id, amount, transaction_type, remarks)
    VALUES (
      v_shop_id, v_supplier_id, v_credit_amount, 'charge',
      'Purchase Order #' || upper(left(v_po_id::text, 8))
    );
  END IF;

  IF v_paid > 0 AND v_account_id IS NOT NULL THEN
    UPDATE public.cash_accounts
    SET current_balance = COALESCE(current_balance, 0) - v_paid
    WHERE id = v_account_id AND shop_id = v_shop_id;

    INSERT INTO public.account_transactions (
      shop_id, account_id, type, amount, ref_type, ref_id, remarks
    ) VALUES (
      v_shop_id, v_account_id, 'withdrawal', v_paid, 'purchase', v_po_id,
      'Purchase #' || upper(left(v_po_id::text, 8))
    );
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(COALESCE(p_payload->'items', '[]'::jsonb))
  LOOP
    v_product_id := (v_item->>'product_id')::uuid;
    v_variant_id := NULLIF(v_item->>'variant_id','')::uuid;
    v_qty := COALESCE((v_item->>'quantity')::numeric, 0);
    v_bonus := COALESCE((v_item->>'bonus_quantity')::numeric, 0);
    v_eff_qty := v_qty + v_bonus;
    v_purchase_price := COALESCE((v_item->>'purchase_price')::numeric, 0);
    v_sale_price := NULLIF(v_item->>'sale_price','')::numeric;

    INSERT INTO public.purchase_order_items (
      purchase_order_id, product_id, variant_id, quantity, unit_price, purchase_price,
      subtotal, bonus_quantity, discount_amount, batch_number, expiry_date
    ) VALUES (
      v_po_id, v_product_id, v_variant_id, v_qty, v_purchase_price, v_purchase_price,
      v_purchase_price * v_qty, v_bonus,
      COALESCE((v_item->>'discount_amount')::numeric, 0),
      NULLIF(v_item->>'batch_number',''),
      NULLIF(v_item->>'expiry_date','')::date
    );

    -- Stock in (simple increment; WAC optional via payload flags later)
    IF v_variant_id IS NOT NULL THEN
      UPDATE public.product_variants
      SET stock_quantity = COALESCE(stock_quantity, 0) + v_eff_qty,
          purchase_price = v_purchase_price,
          sale_price = COALESCE(v_sale_price, sale_price)
      WHERE id = v_variant_id;

      -- packing → also bump parent base stock
      IF COALESCE((v_item->>'is_packing')::boolean, false)
         AND COALESCE((v_item->>'pack_size')::numeric, 0) > 0 THEN
        UPDATE public.products
        SET current_stock = COALESCE(current_stock, 0) + (v_eff_qty * (v_item->>'pack_size')::numeric)
        WHERE id = v_product_id;
      END IF;
    ELSE
      UPDATE public.products
      SET current_stock = COALESCE(current_stock, 0) + v_eff_qty,
          purchase_price_single = v_purchase_price,
          sale_price_single = COALESCE(v_sale_price, sale_price_single)
      WHERE id = v_product_id;
    END IF;
  END LOOP;

  INSERT INTO public.audit_logs (shop_id, user_id, action, table_name, record_id, details)
  VALUES (
    v_shop_id, auth.uid(), 'PURCHASE_RECEIVED', 'purchase_orders', v_po_id,
    jsonb_build_object('total', v_total, 'via', 'receive_purchase')
  );

  RETURN jsonb_build_object('purchase_order_id', v_po_id, 'ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.receive_purchase(jsonb) TO authenticated;

-- ---------------------------------------------------------------------------
-- Journal balance constraint (when tables exist)
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'journal_lines'
  ) THEN
    CREATE OR REPLACE FUNCTION public.hx_assert_journal_balanced()
    RETURNS trigger
    LANGUAGE plpgsql
    AS $fn$
    DECLARE
      v_entry uuid;
      v_debits numeric;
      v_credits numeric;
    BEGIN
      v_entry := COALESCE(NEW.journal_entry_id, OLD.journal_entry_id);
      SELECT
        COALESCE(SUM(CASE WHEN COALESCE(debit, 0) > 0 THEN debit ELSE 0 END), 0),
        COALESCE(SUM(CASE WHEN COALESCE(credit, 0) > 0 THEN credit ELSE 0 END), 0)
      INTO v_debits, v_credits
      FROM public.journal_lines
      WHERE journal_entry_id = v_entry;

      -- Only enforce when entry has lines and is "complete" (both sides non-zero)
      IF v_debits > 0 AND v_credits > 0 AND abs(v_debits - v_credits) > 0.009 THEN
        RAISE EXCEPTION 'Unbalanced journal entry %: debits % credits %', v_entry, v_debits, v_credits;
      END IF;
      RETURN COALESCE(NEW, OLD);
    END;
    $fn$;

    DROP TRIGGER IF EXISTS trg_hx_journal_balance ON public.journal_lines;
    -- Deferred-style: check after statement would be better; row-level after insert/update
    -- Uses constraint trigger if available
    CREATE CONSTRAINT TRIGGER trg_hx_journal_balance
      AFTER INSERT OR UPDATE OR DELETE ON public.journal_lines
      DEFERRABLE INITIALLY DEFERRED
      FOR EACH ROW
      EXECUTE FUNCTION public.hx_assert_journal_balanced();
  END IF;
END $$;

-- Return over-return guard helper (optional column link)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'returns'
  ) THEN
    ALTER TABLE public.returns
      ADD COLUMN IF NOT EXISTS original_invoice_id uuid REFERENCES public.invoices(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.assert_return_qty(
  p_invoice_id uuid,
  p_product_id uuid,
  p_return_qty numeric
)
RETURNS void
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sold numeric;
  v_returned numeric;
BEGIN
  SELECT COALESCE(SUM(quantity), 0) INTO v_sold
  FROM public.invoice_items
  WHERE invoice_id = p_invoice_id AND product_id = p_product_id;

  SELECT COALESCE(SUM(ri.quantity), 0) INTO v_returned
  FROM public.return_items ri
  JOIN public.returns r ON r.id = ri.return_id
  WHERE r.original_invoice_id = p_invoice_id
    AND ri.product_id = p_product_id
    AND COALESCE(r.is_voided, false) = false;

  IF p_return_qty + v_returned > v_sold THEN
    RAISE EXCEPTION 'Return qty % exceeds remaining sold qty % for product %',
      p_return_qty, (v_sold - v_returned), p_product_id;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.assert_return_qty(uuid, uuid, numeric) TO authenticated;

NOTIFY pgrst, 'reload schema';
