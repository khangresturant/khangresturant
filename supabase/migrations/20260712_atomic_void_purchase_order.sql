-- ============================================================
-- atomic_void_purchase_order
-- Atomically voids a purchase order and reverses all stock, WAC
-- updates, supplier balance (khata), and cash account paid amount
-- in a single transaction.
-- ============================================================
CREATE OR REPLACE FUNCTION public.atomic_void_purchase_order(
  p_po_id   UUID,
  p_reason  TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_po             RECORD;
  v_item           RECORD;
  v_is_packing     BOOLEAN;
  v_pack_size      NUMERIC;

  v_supplier_type  TEXT;
  v_supplier_bal   NUMERIC;
  v_credit_amt     NUMERIC;
  v_balance_delta  NUMERIC;

  v_acc_balance    NUMERIC;
BEGIN
  -- 1. Lock and fetch purchase order
  SELECT * INTO v_po FROM purchase_orders WHERE id = p_po_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'PURCHASE_ORDER_NOT_FOUND:%', p_po_id;
  END IF;

  IF v_po.is_voided = TRUE THEN
    RAISE EXCEPTION 'ALREADY_VOIDED:%', p_po_id;
  END IF;

  -- 2. Mark PO as voided
  UPDATE purchase_orders
  SET
    is_voided = TRUE,
    notes = COALESCE(notes, '') || ' | Void reason: ' || p_reason,
    updated_at = NOW()
  WHERE id = p_po_id;

  -- 3. Reverse stock updates
  FOR v_item IN
    SELECT product_id, variant_id, quantity, bonus_quantity, batch_number
    FROM purchase_order_items WHERE purchase_order_id = p_po_id
  LOOP
    IF v_item.variant_id IS NOT NULL THEN
      SELECT is_packing, pack_size INTO v_is_packing, v_pack_size
      FROM product_variants WHERE id = v_item.variant_id;

      IF FOUND AND v_is_packing AND v_pack_size IS NOT NULL AND v_pack_size > 0 THEN
        UPDATE products
        SET current_stock = GREATEST(0, current_stock - ((v_item.quantity + COALESCE(v_item.bonus_quantity, 0)) * v_pack_size))
        WHERE id = v_item.product_id AND shop_id = v_po.shop_id;

        UPDATE product_variants
        SET stock_quantity = GREATEST(0, stock_quantity - (v_item.quantity + COALESCE(v_item.bonus_quantity, 0)))
        WHERE id = v_item.variant_id;
      ELSE
        UPDATE product_variants
        SET stock_quantity = GREATEST(0, stock_quantity - (v_item.quantity + COALESCE(v_item.bonus_quantity, 0)))
        WHERE id = v_item.variant_id;

        UPDATE products
        SET current_stock = (
          SELECT COALESCE(SUM(stock_quantity), 0) FROM product_variants WHERE product_id = v_item.product_id
        ) WHERE id = v_item.product_id AND shop_id = v_po.shop_id;
      END IF;
    ELSE
      UPDATE products
      SET current_stock = GREATEST(0, current_stock - (v_item.quantity + COALESCE(v_item.bonus_quantity, 0)))
      WHERE id = v_item.product_id AND shop_id = v_po.shop_id;
    END IF;

    -- Reverse batch stock if batch number exists
    IF v_item.batch_number IS NOT NULL THEN
      UPDATE product_batches
      SET stock_quantity = GREATEST(0, stock_quantity - (v_item.quantity + COALESCE(v_item.bonus_quantity, 0)))
      WHERE shop_id = v_po.shop_id AND product_id = v_item.product_id AND batch_number = v_item.batch_number;
    END IF;
  END LOOP;

  -- 4. Revert supplier balance
  v_credit_amt := GREATEST(0, v_po.total_amount - v_po.paid_amount);
  IF v_po.supplier_id IS NOT NULL AND v_credit_amt > 0 THEN
    SELECT type, COALESCE(current_balance, 0)
      INTO v_supplier_type, v_supplier_bal
      FROM parties
      WHERE id = v_po.supplier_id AND shop_id = v_po.shop_id
      FOR UPDATE;

    IF FOUND THEN
      -- Reversing the charge: subtracting the credit amount from supplier balance (adding back for dual)
      v_balance_delta := CASE WHEN v_supplier_type = 'dual' THEN v_credit_amt ELSE -v_credit_amt END;

      UPDATE parties
        SET current_balance = v_supplier_bal + v_balance_delta
        WHERE id = v_po.supplier_id AND shop_id = v_po.shop_id;

      INSERT INTO credit_transactions (
        shop_id, customer_id, amount, transaction_type, remarks
      ) VALUES (
        v_po.shop_id, v_po.supplier_id, v_credit_amt, 'payment',
        'Purchase Void Reversal #' || UPPER(LEFT(p_po_id::TEXT, 8))
      );
    END IF;
  END IF;

  -- 5. Revert cash account paid amount
  IF v_po.account_id IS NOT NULL AND COALESCE(v_po.paid_amount, 0) > 0 THEN
    SELECT current_balance INTO v_acc_balance
      FROM cash_accounts
      WHERE id = v_po.account_id AND shop_id = v_po.shop_id
      FOR UPDATE;

    IF FOUND THEN
      UPDATE cash_accounts
        SET current_balance = v_acc_balance + v_po.paid_amount
        WHERE id = v_po.account_id;

      INSERT INTO account_transactions (
        shop_id, account_id, type, amount, ref_type, ref_id, remarks
      ) VALUES (
        v_po.shop_id, v_po.account_id, 'deposit', v_po.paid_amount,
        'purchase', p_po_id,
        'Void Purchase Ref #' || UPPER(LEFT(p_po_id::TEXT, 8))
      );
    END IF;
  END IF;

  RETURN jsonb_build_object('status', 'voided', 'purchase_order_id', p_po_id);

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('status', 'failed', 'error', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION public.atomic_void_purchase_order(UUID, TEXT) TO authenticated;
