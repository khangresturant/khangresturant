-- ============================================================
-- atomic_pos_checkout v2 (corrected for actual table schemas)
-- Handles in ONE Postgres transaction:
--   1. Invoice upsert (new or edit)
--   2. Invoice items insert + IMEI mark sold
--   3. Stock decrement (products / product_variants)
--   4. Cash account balance update + account_transactions log
--   5. Gift card balance deduction + gift_card_transactions log
--   6. Loyalty points earn / burn on parties table
--   7. Party credit balance update (credit / emi mode)
--   8. EMI schedule rows in emi_schedules
--
-- Full rollback on any error.
-- ============================================================
CREATE OR REPLACE FUNCTION public.atomic_pos_checkout(
  p_invoice  JSONB,
  p_items    JSONB,
  p_payment  JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_invoice_id      UUID;
  v_shop_id         UUID;
  v_party_id        UUID;
  v_payment_mode    TEXT;
  v_total_amount    NUMERIC;
  v_discount_amount NUMERIC;
  v_tax_amount      NUMERIC;
  v_status          TEXT;
  v_session_id      UUID;
  v_account_id      UUID;
  v_remarks         TEXT;
  v_edit_invoice_id UUID;

  v_cash_amount          NUMERIC;
  v_credit_amount        NUMERIC;
  v_gift_card_id         UUID;
  v_gift_card_amount     NUMERIC;
  v_loyalty_delta        NUMERIC;

  item                   JSONB;
  v_product_id           UUID;
  v_variant_id           UUID;
  v_quantity             NUMERIC;
  v_unit_price           NUMERIC;
  v_subtotal             NUMERIC;
  v_stock_qty            NUMERIC;
  v_is_packing           BOOLEAN;
  v_pack_size            NUMERIC;
  v_item_id              UUID;

  v_current_gc_balance   NUMERIC;
  v_current_party_points NUMERIC;
  v_current_acc_balance  NUMERIC;

  emi_row                JSONB;
BEGIN
  -- Extract invoice
  v_invoice_id      := (p_invoice->>'id')::UUID;
  v_shop_id         := (p_invoice->>'shop_id')::UUID;
  v_party_id        := NULLIF(p_invoice->>'party_id', '')::UUID;
  v_payment_mode    := COALESCE(p_invoice->>'payment_mode', 'cash');
  v_total_amount    := COALESCE((p_invoice->>'total_amount')::NUMERIC, 0);
  v_discount_amount := COALESCE((p_invoice->>'discount_amount')::NUMERIC, 0);
  v_tax_amount      := COALESCE((p_invoice->>'tax_amount')::NUMERIC, 0);
  v_status          := COALESCE(p_invoice->>'status', 'paid');
  v_session_id      := NULLIF(p_invoice->>'register_session_id', '')::UUID;
  v_account_id      := NULLIF(p_invoice->>'account_id', '')::UUID;
  v_remarks         := p_invoice->>'remarks';
  v_edit_invoice_id := NULLIF(p_invoice->>'edit_invoice_id', '')::UUID;

  -- Extract payment
  v_cash_amount      := COALESCE((p_payment->>'cash_amount')::NUMERIC, 0);
  v_credit_amount    := COALESCE((p_payment->>'credit_amount')::NUMERIC, 0);
  v_gift_card_id     := NULLIF(p_payment->>'gift_card_id', '')::UUID;
  v_gift_card_amount := COALESCE((p_payment->>'gift_card_amount')::NUMERIC, 0);
  v_loyalty_delta    := COALESCE((p_payment->>'loyalty_points_delta')::NUMERIC, 0);

  -- 1. Upsert invoice
  IF v_edit_invoice_id IS NOT NULL THEN
    UPDATE invoices
    SET
      party_id             = v_party_id,
      total_amount         = v_total_amount,
      tax_amount           = v_tax_amount,
      discount             = v_discount_amount,
      status               = v_status,
      paid_amount          = CASE
                               WHEN v_payment_mode IN ('credit','emi') THEN v_cash_amount
                               WHEN v_payment_mode = 'quotation'       THEN 0
                               ELSE v_total_amount
                             END,
      payment_mode         = v_payment_mode,
      register_session_id  = v_session_id,
      account_id           = v_account_id,
      remarks              = v_remarks,
      is_edited            = TRUE
    WHERE id = v_edit_invoice_id AND shop_id = v_shop_id;
    v_invoice_id := v_edit_invoice_id;
  ELSE
    INSERT INTO invoices (
      id, shop_id, party_id, total_amount, tax_amount, discount,
      status, paid_amount, payment_mode, register_session_id, account_id, remarks
    ) VALUES (
      v_invoice_id, v_shop_id, v_party_id, v_total_amount, v_tax_amount, v_discount_amount,
      v_status,
      CASE
        WHEN v_payment_mode IN ('credit','emi') THEN v_cash_amount
        WHEN v_payment_mode = 'quotation'       THEN 0
        ELSE v_total_amount
      END,
      v_payment_mode, v_session_id, v_account_id, v_remarks
    )
    ON CONFLICT (id) DO NOTHING;
  END IF;

  -- 2. Invoice items + stock
  FOR item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_product_id := (item->>'product_id')::UUID;
    v_variant_id := NULLIF(item->>'variant_id', '')::UUID;
    v_quantity   := COALESCE((item->>'quantity')::NUMERIC, 1);
    v_unit_price := COALESCE((item->>'unit_price')::NUMERIC, 0);
    v_subtotal   := COALESCE((item->>'subtotal')::NUMERIC, v_unit_price * v_quantity);
    v_stock_qty  := COALESCE((item->>'stock_qty')::NUMERIC, v_quantity);
    v_is_packing := COALESCE((item->>'is_packing')::BOOLEAN, FALSE);
    v_pack_size  := NULLIF(item->>'pack_size', '')::NUMERIC;

    INSERT INTO invoice_items (
      invoice_id, product_id, variant_id, quantity, unit_price, subtotal,
      packing_name, warranty, sold_imeis
    ) VALUES (
      v_invoice_id, v_product_id, v_variant_id, v_quantity, v_unit_price, v_subtotal,
      NULLIF(item->>'packing_name', ''),
      NULLIF(item->>'warranty', ''),
      NULLIF(item->>'sold_imeis', '')
    )
    ON CONFLICT DO NOTHING
    RETURNING id INTO v_item_id;

    -- Mark IMEIs sold
    IF item->'imei_ids' IS NOT NULL AND jsonb_array_length(item->'imei_ids') > 0 AND v_item_id IS NOT NULL THEN
      UPDATE product_imeis
      SET status = 'sold', sold_invoice_item_id = v_item_id
      WHERE id = ANY(
        ARRAY(SELECT (e::TEXT)::UUID FROM jsonb_array_elements_text(item->'imei_ids') AS e)
      );
    END IF;

    -- Stock decrement
    IF v_payment_mode <> 'quotation' THEN
      IF v_variant_id IS NOT NULL THEN
        IF v_is_packing AND v_pack_size IS NOT NULL THEN
          UPDATE products SET current_stock = current_stock - (v_stock_qty * v_pack_size)
          WHERE id = v_product_id AND shop_id = v_shop_id;
        ELSE
          UPDATE product_variants SET stock_quantity = stock_quantity - v_stock_qty
          WHERE id = v_variant_id;
          UPDATE products SET current_stock = (
            SELECT COALESCE(SUM(stock_quantity), 0) FROM product_variants WHERE product_id = v_product_id
          ) WHERE id = v_product_id AND shop_id = v_shop_id;
        END IF;
      ELSE
        UPDATE products SET current_stock = current_stock - v_stock_qty
        WHERE id = v_product_id AND shop_id = v_shop_id;
      END IF;
    END IF;
  END LOOP;

  -- 3. Cash account transaction
  IF v_account_id IS NOT NULL AND v_cash_amount > 0 AND v_payment_mode <> 'quotation' THEN
    SELECT current_balance INTO v_current_acc_balance
    FROM cash_accounts WHERE id = v_account_id AND shop_id = v_shop_id FOR UPDATE;
    IF FOUND THEN
      UPDATE cash_accounts SET current_balance = v_current_acc_balance + v_cash_amount
      WHERE id = v_account_id;
      INSERT INTO account_transactions (shop_id, account_id, type, amount, ref_type, ref_id, remarks)
      VALUES (v_shop_id, v_account_id, 'deposit', v_cash_amount, 'invoice', v_invoice_id,
              'POS Sale #' || UPPER(LEFT(v_invoice_id::TEXT, 8)));
    END IF;
  END IF;

  -- 4. Gift card deduction
  IF v_gift_card_id IS NOT NULL AND v_gift_card_amount > 0 THEN
    SELECT balance INTO v_current_gc_balance
    FROM gift_cards WHERE id = v_gift_card_id AND shop_id = v_shop_id FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'INVALID_GIFT_CARD: Gift card not found';
    END IF;
    IF v_current_gc_balance < v_gift_card_amount THEN
      RAISE EXCEPTION 'INSUFFICIENT_GIFT_CARD_BALANCE: Balance % < requested %',
        v_current_gc_balance, v_gift_card_amount;
    END IF;
    UPDATE gift_cards SET balance = GREATEST(0, v_current_gc_balance - v_gift_card_amount)
    WHERE id = v_gift_card_id;
    INSERT INTO gift_card_transactions (gift_card_id, amount, transaction_type)
    VALUES (v_gift_card_id, v_gift_card_amount, 'debit');
  END IF;

  -- 5. Loyalty points
  IF v_loyalty_delta <> 0 AND v_party_id IS NOT NULL THEN
    SELECT COALESCE(loyalty_points, 0) INTO v_current_party_points
    FROM parties WHERE id = v_party_id AND shop_id = v_shop_id FOR UPDATE;
    IF FOUND THEN
      UPDATE parties SET loyalty_points = GREATEST(0, v_current_party_points + v_loyalty_delta)
      WHERE id = v_party_id AND shop_id = v_shop_id;
    END IF;
  END IF;

  -- 6. Party credit balance
  IF v_credit_amount > 0 AND v_party_id IS NOT NULL AND v_payment_mode <> 'quotation' THEN
    UPDATE parties SET current_balance = COALESCE(current_balance, 0) + v_credit_amount
    WHERE id = v_party_id AND shop_id = v_shop_id;
  END IF;

  -- 7. EMI schedules
  IF p_payment->>'emi_schedules' IS NOT NULL
     AND jsonb_array_length(p_payment->'emi_schedules') > 0
     AND v_payment_mode = 'emi' THEN
    FOR emi_row IN SELECT * FROM jsonb_array_elements(p_payment->'emi_schedules') LOOP
      INSERT INTO emi_schedules (invoice_id, due_date, installment_amount, late_fee, status)
      VALUES (
        v_invoice_id,
        (emi_row->>'due_date')::DATE,
        COALESCE((emi_row->>'amount')::NUMERIC, 0),
        0,
        COALESCE(emi_row->>'status', 'unpaid')
      )
      ON CONFLICT DO NOTHING;
    END LOOP;
  END IF;

  RETURN jsonb_build_object('status', 'ok', 'invoice_id', v_invoice_id);

EXCEPTION WHEN OTHERS THEN
  RAISE; -- full rollback, caller sees the error
END;
$$;

GRANT EXECUTE ON FUNCTION public.atomic_pos_checkout(JSONB, JSONB, JSONB) TO authenticated;
