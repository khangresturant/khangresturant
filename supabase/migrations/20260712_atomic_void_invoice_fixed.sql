-- ============================================================
-- atomic_void_invoice (fixed for schema correctness)
-- Reverses:
--   1. Invoice status set to voided
--   2. Stock restored to products and variants (packing-aware)
--   3. product_batches restored
--   4. product_imeis status set back to available and unlinked
--   5. cash_accounts balance reversed (paid_amount deducted)
--   6. parties credit_balance updated & credit_transactions logged
--   7. emi_schedules deleted
-- Full rollback on error.
-- ============================================================
CREATE OR REPLACE FUNCTION public.atomic_void_invoice(
  p_invoice_id UUID,
  p_reason     TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_inv            RECORD;
  v_item           RECORD;
  v_is_packing     BOOLEAN;
  v_pack_size      NUMERIC;
BEGIN
  -- 1. Fetch and lock invoice
  SELECT * INTO v_inv FROM invoices WHERE id = p_invoice_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'INVOICE_NOT_FOUND:%', p_invoice_id;
  END IF;

  IF v_inv.status = 'voided' THEN
    RAISE EXCEPTION 'ALREADY_VOIDED:%', p_invoice_id;
  END IF;

  -- 2. Mark invoice as voided
  UPDATE invoices
  SET
    status = 'voided',
    void_reason = p_reason,
    voided_at = NOW(),
    updated_at = NOW()
  WHERE id = p_invoice_id;

  -- 3. Reverse stock and batches
  FOR v_item IN
    SELECT ii.product_id, ii.variant_id, ii.quantity, ii.batch_id, ii.batch_number
    FROM invoice_items ii WHERE ii.invoice_id = p_invoice_id
  LOOP
    IF v_item.variant_id IS NOT NULL THEN
      SELECT is_packing, pack_size INTO v_is_packing, v_pack_size
      FROM product_variants WHERE id = v_item.variant_id;

      IF FOUND AND v_is_packing AND v_pack_size IS NOT NULL THEN
        UPDATE products
        SET current_stock = current_stock + (v_item.quantity * v_pack_size), updated_at = NOW()
        WHERE id = v_item.product_id AND shop_id = v_inv.shop_id;
      ELSE
        UPDATE product_variants
        SET stock_quantity = stock_quantity + v_item.quantity, updated_at = NOW()
        WHERE id = v_item.variant_id;

        UPDATE products
        SET current_stock = (
          SELECT COALESCE(SUM(stock_quantity), 0)
          FROM product_variants
          WHERE product_id = v_item.product_id
        ), updated_at = NOW()
        WHERE id = v_item.product_id AND shop_id = v_inv.shop_id;
      END IF;
    ELSE
      UPDATE products
      SET current_stock = current_stock + v_item.quantity, updated_at = NOW()
      WHERE id = v_item.product_id AND shop_id = v_inv.shop_id;
    END IF;

    -- Reverse batch stock if applicable
    IF v_item.batch_id IS NOT NULL THEN
      UPDATE product_batches
      SET stock_quantity = stock_quantity + v_item.quantity
      WHERE id = v_item.batch_id;
    ELSIF v_item.batch_number IS NOT NULL THEN
      UPDATE product_batches
      SET stock_quantity = stock_quantity + v_item.quantity
      WHERE shop_id = v_inv.shop_id AND product_id = v_item.product_id AND batch_number = v_item.batch_number;
    END IF;
  END LOOP;

  -- 4. Restore sold IMEIs back to available
  UPDATE product_imeis
  SET status = 'available', sold_invoice_item_id = NULL
  WHERE sold_invoice_item_id IN (
    SELECT id FROM invoice_items WHERE invoice_id = p_invoice_id
  );

  -- 5. Revert cash account deposit if cash was received
  IF v_inv.account_id IS NOT NULL AND COALESCE(v_inv.paid_amount, 0) > 0 AND v_inv.payment_mode <> 'quotation' THEN
    UPDATE cash_accounts
    SET current_balance = current_balance - v_inv.paid_amount
    WHERE id = v_inv.account_id;

    INSERT INTO account_transactions (
      shop_id, account_id, type, amount, ref_type, ref_id, remarks
    ) VALUES (
      v_inv.shop_id, v_inv.account_id, 'withdrawal', v_inv.paid_amount,
      'invoice', p_invoice_id,
      'Void POS Sale #' || UPPER(LEFT(p_invoice_id::TEXT, 8))
    );
  END IF;

  -- 6. Revert customer credit balance
  IF COALESCE(v_inv.credit_amount, 0) > 0 AND v_inv.party_id IS NOT NULL THEN
    UPDATE parties
    SET current_balance = current_balance - v_inv.credit_amount
    WHERE id = v_inv.party_id AND shop_id = v_inv.shop_id;

    INSERT INTO credit_transactions (
      shop_id, customer_id, amount, transaction_type, remarks
    ) VALUES (
      v_inv.shop_id, v_inv.party_id, v_inv.credit_amount, 'payment',
      'Voided Invoice #' || UPPER(LEFT(p_invoice_id::TEXT, 8))
    );
  END IF;

  -- 7. Delete EMI schedules if applicable
  IF v_inv.payment_mode = 'emi' THEN
    DELETE FROM emi_schedules WHERE invoice_id = p_invoice_id;
  END IF;

  RETURN jsonb_build_object('status', 'voided', 'invoice_id', p_invoice_id);

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('status', 'failed', 'error', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION public.atomic_void_invoice(UUID, TEXT) TO authenticated;
