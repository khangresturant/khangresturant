-- ============================================================
-- atomic_update_purchase_order
-- Atomically updates an existing purchase order:
--   1. Reverses previous stock, batches, supplier balance, and cash account
--   2. Deletes previous PO items, credit tx, and account tx
--   3. Updates purchase_orders header
--   4. Inserts new purchase_order_items
--   5. Applies new stock, WAC, batches, and IMEIs
--   6. Updates new supplier balance and cash account
-- All inside ONE single ACID transaction with full rollback on error.
-- ============================================================

CREATE OR REPLACE FUNCTION public.atomic_update_purchase_order(p_payload JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_po_id           UUID;
  v_shop_id         UUID;
  v_supplier_id     UUID;
  v_total_amount    NUMERIC;
  v_paid_amount     NUMERIC;
  v_discount        NUMERIC;
  v_tax_amount      NUMERIC;
  v_status          TEXT;
  v_payment_mode    TEXT;
  v_notes           TEXT;
  v_invoice_number  TEXT;
  v_account_id      UUID;
  v_credit_amount   NUMERIC;

  -- old PO state
  v_po              RECORD;
  v_old_item        RECORD;
  v_old_is_packing  BOOLEAN;
  v_old_pack_size   NUMERIC;
  v_old_credit      NUMERIC;

  -- item loop variables
  item              JSONB;
  v_product_id      UUID;
  v_variant_id      UUID;
  v_quantity        NUMERIC;
  v_bonus_qty       NUMERIC;
  v_effective_qty   NUMERIC;
  v_purchase_price  NUMERIC;
  v_sale_price      NUMERIC;
  v_discount_amt    NUMERIC;
  v_effective_cost  NUMERIC;
  v_effective_unit  NUMERIC;
  v_batch_number    TEXT;
  v_expiry_date     DATE;
  v_is_packing      BOOLEAN;
  v_pack_size       NUMERIC;

  -- stock / WAC variables
  v_old_prod_stock  NUMERIC;
  v_old_prod_price  NUMERIC;
  v_new_prod_stock  NUMERIC;
  v_new_prod_price  NUMERIC;
  v_old_var_stock   NUMERIC;
  v_old_var_price   NUMERIC;
  v_new_var_stock   NUMERIC;
  v_new_var_price   NUMERIC;
  v_price_per_base  NUMERIC;

  -- supplier variables
  v_supplier_type   TEXT;
  v_supplier_bal    NUMERIC;
  v_balance_delta   NUMERIC;

  -- cash account
  v_acc_balance     NUMERIC;

  -- imei
  imei_row          JSONB;
BEGIN
  -- ── 1. Validate PO ID and extract payload ─────────────────────────────────
  v_po_id := NULLIF(p_payload->>'purchase_order_id', '')::UUID;
  IF v_po_id IS NULL THEN
    RAISE EXCEPTION 'MISSING_PURCHASE_ORDER_ID';
  END IF;

  SELECT * INTO v_po FROM purchase_orders WHERE id = v_po_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'PURCHASE_ORDER_NOT_FOUND:%', v_po_id;
  END IF;

  IF v_po.is_voided = TRUE THEN
    RAISE EXCEPTION 'CANNOT_EDIT_VOIDED_PURCHASE_ORDER:%', v_po_id;
  END IF;

  v_shop_id        := COALESCE(NULLIF(p_payload->>'shop_id', '')::UUID, v_po.shop_id);
  v_supplier_id    := NULLIF(p_payload->>'supplier_id', '')::UUID;
  v_total_amount   := COALESCE((p_payload->>'total_amount')::NUMERIC, 0);
  v_paid_amount    := COALESCE((p_payload->>'paid_amount')::NUMERIC, 0);
  v_discount       := COALESCE((p_payload->>'discount')::NUMERIC, 0);
  v_tax_amount     := COALESCE((p_payload->>'tax_amount')::NUMERIC, 0);
  v_status         := COALESCE(p_payload->>'status', 'PAID');
  v_payment_mode   := COALESCE(p_payload->>'payment_mode', 'cash');
  v_notes          := NULLIF(p_payload->>'notes', '');
  v_invoice_number := NULLIF(p_payload->>'invoice_number', '');
  v_account_id     := NULLIF(p_payload->>'account_id', '')::UUID;
  v_credit_amount  := GREATEST(0, v_total_amount - v_paid_amount);

  -- ── 2. REVERT OLD STOCK & OLD BATCHES ─────────────────────────────────────
  FOR v_old_item IN
    SELECT product_id, variant_id, quantity, bonus_quantity, batch_number
    FROM purchase_order_items WHERE purchase_order_id = v_po_id
  LOOP
    IF v_old_item.variant_id IS NOT NULL THEN
      SELECT is_packing, pack_size INTO v_old_is_packing, v_old_pack_size
      FROM product_variants WHERE id = v_old_item.variant_id;

      IF FOUND AND v_old_is_packing AND v_old_pack_size IS NOT NULL AND v_old_pack_size > 0 THEN
        UPDATE products
        SET current_stock = GREATEST(0, current_stock - ((v_old_item.quantity + COALESCE(v_old_item.bonus_quantity, 0)) * v_old_pack_size))
        WHERE id = v_old_item.product_id AND shop_id = v_po.shop_id;

        UPDATE product_variants
        SET stock_quantity = GREATEST(0, stock_quantity - (v_old_item.quantity + COALESCE(v_old_item.bonus_quantity, 0)))
        WHERE id = v_old_item.variant_id;
      ELSE
        UPDATE product_variants
        SET stock_quantity = GREATEST(0, stock_quantity - (v_old_item.quantity + COALESCE(v_old_item.bonus_quantity, 0)))
        WHERE id = v_old_item.variant_id;

        UPDATE products
        SET current_stock = (
          SELECT COALESCE(SUM(stock_quantity), 0) FROM product_variants WHERE product_id = v_old_item.product_id
        ) WHERE id = v_old_item.product_id AND shop_id = v_po.shop_id;
      END IF;
    ELSE
      UPDATE products
      SET current_stock = GREATEST(0, current_stock - ((v_old_item.quantity + COALESCE(v_old_item.bonus_quantity, 0))))
      WHERE id = v_old_item.product_id AND shop_id = v_po.shop_id;
    END IF;

    IF v_old_item.batch_number IS NOT NULL THEN
      UPDATE product_batches
      SET stock_quantity = GREATEST(0, stock_quantity - (v_old_item.quantity + COALESCE(v_old_item.bonus_quantity, 0)))
      WHERE shop_id = v_po.shop_id AND product_id = v_old_item.product_id AND batch_number = v_old_item.batch_number;
    END IF;
  END LOOP;

  -- ── 3. REVERT OLD SUPPLIER BALANCE ────────────────────────────────────────
  v_old_credit := GREATEST(0, v_po.total_amount - v_po.paid_amount);
  IF v_po.supplier_id IS NOT NULL AND v_old_credit > 0 THEN
    SELECT type, COALESCE(current_balance, 0)
      INTO v_supplier_type, v_supplier_bal
      FROM parties
      WHERE id = v_po.supplier_id AND shop_id = v_po.shop_id
      FOR UPDATE;

    IF FOUND THEN
      v_balance_delta := CASE WHEN v_supplier_type = 'dual' THEN v_old_credit ELSE -v_old_credit END;
      UPDATE parties
        SET current_balance = v_supplier_bal + v_balance_delta
        WHERE id = v_po.supplier_id AND shop_id = v_po.shop_id;
    END IF;
  END IF;

  -- ── 4. REVERT OLD CASH ACCOUNT ────────────────────────────────────────────
  IF v_po.account_id IS NOT NULL AND COALESCE(v_po.paid_amount, 0) > 0 THEN
    SELECT current_balance INTO v_acc_balance
      FROM cash_accounts
      WHERE id = v_po.account_id AND shop_id = v_po.shop_id
      FOR UPDATE;

    IF FOUND THEN
      UPDATE cash_accounts
        SET current_balance = v_acc_balance + v_po.paid_amount
        WHERE id = v_po.account_id;
    END IF;
  END IF;

  -- Delete previous items, credit_tx, account_tx for this PO
  DELETE FROM purchase_order_items WHERE purchase_order_id = v_po_id;
  DELETE FROM credit_transactions WHERE shop_id = v_po.shop_id AND (remarks LIKE 'Purchase Order Billing #' || UPPER(LEFT(v_po_id::TEXT, 8)) || '%' OR remarks LIKE 'Purchase Void Reversal #' || UPPER(LEFT(v_po_id::TEXT, 8)) || '%');
  DELETE FROM account_transactions WHERE shop_id = v_po.shop_id AND ref_type = 'purchase' AND ref_id = v_po_id;

  -- ── 5. UPDATE PURCHASE_ORDERS HEADER ──────────────────────────────────────
  UPDATE purchase_orders
  SET
    supplier_id    = v_supplier_id,
    total_amount   = v_total_amount,
    paid_amount    = v_paid_amount,
    discount       = v_discount,
    tax_amount     = v_tax_amount,
    status         = v_status,
    payment_mode   = v_payment_mode,
    notes          = v_notes,
    invoice_number = v_invoice_number,
    account_id     = v_account_id,
    updated_at     = NOW(),
    is_voided      = FALSE
  WHERE id = v_po_id;

  -- ── 6. INSERT NEW ITEMS & APPLY NEW STOCK / WAC ───────────────────────────
  FOR item IN SELECT * FROM jsonb_array_elements(p_payload->'items') LOOP
    v_product_id    := (item->>'product_id')::UUID;
    v_variant_id    := NULLIF(item->>'variant_id','')::UUID;
    v_quantity      := COALESCE((item->>'quantity')::NUMERIC, 0);
    v_bonus_qty     := COALESCE((item->>'bonus_quantity')::NUMERIC, 0);
    v_purchase_price:= COALESCE((item->>'purchase_price')::NUMERIC, 0);
    v_sale_price    := NULLIF(item->>'sale_price','')::NUMERIC;
    v_discount_amt  := COALESCE((item->>'discount_amount')::NUMERIC, 0);
    v_batch_number  := NULLIF(item->>'batch_number','');
    v_expiry_date   := NULLIF(item->>'expiry_date','')::DATE;
    v_is_packing    := COALESCE((item->>'is_packing')::BOOLEAN, FALSE);
    v_pack_size     := NULLIF(item->>'pack_size','')::NUMERIC;

    v_effective_qty  := v_quantity + v_bonus_qty;
    v_effective_cost := GREATEST(0, (v_quantity * v_purchase_price) - v_discount_amt);
    v_effective_unit := CASE WHEN v_effective_qty > 0 THEN ROUND(v_effective_cost / v_effective_qty, 4) ELSE v_purchase_price END;

    INSERT INTO purchase_order_items (
      purchase_order_id, product_id, variant_id, quantity,
      unit_price, subtotal, purchase_price, bonus_quantity,
      discount_amount, batch_number, expiry_date
    ) VALUES (
      v_po_id, v_product_id, v_variant_id, v_quantity,
      v_purchase_price, (v_quantity * v_purchase_price) - v_discount_amt,
      v_effective_unit, v_bonus_qty,
      v_discount_amt, v_batch_number, v_expiry_date
    );

    IF v_variant_id IS NOT NULL THEN
      SELECT stock_quantity, purchase_price
        INTO v_old_var_stock, v_old_var_price
        FROM product_variants
        WHERE id = v_variant_id
        FOR UPDATE;

      v_new_var_stock := COALESCE(v_old_var_stock, 0) + v_effective_qty;
      v_new_var_price := CASE WHEN v_new_var_stock > 0
        THEN ROUND((COALESCE(v_old_var_stock, 0) * COALESCE(v_old_var_price, 0) + v_effective_qty * v_effective_unit) / v_new_var_stock, 4)
        ELSE v_effective_unit END;

      UPDATE product_variants SET
        stock_quantity = v_new_var_stock,
        purchase_price = v_new_var_price,
        sale_price     = COALESCE(v_sale_price, sale_price)
      WHERE id = v_variant_id;

      IF v_is_packing AND v_pack_size IS NOT NULL AND v_pack_size > 0 THEN
        UPDATE products SET
          current_stock = current_stock + (v_effective_qty * v_pack_size)
        WHERE id = v_product_id AND shop_id = v_shop_id;
      ELSE
        UPDATE products SET
          current_stock = (SELECT COALESCE(SUM(stock_quantity), 0) FROM product_variants WHERE product_id = v_product_id)
        WHERE id = v_product_id AND shop_id = v_shop_id;
      END IF;
    ELSE
      SELECT current_stock, purchase_price_single
        INTO v_old_prod_stock, v_old_prod_price
        FROM products
        WHERE id = v_product_id AND shop_id = v_shop_id
        FOR UPDATE;

      v_new_prod_stock := COALESCE(v_old_prod_stock, 0) + v_effective_qty;
      v_new_prod_price := CASE WHEN v_new_prod_stock > 0
        THEN ROUND((COALESCE(v_old_prod_stock, 0) * COALESCE(v_old_prod_price, 0) + v_effective_qty * v_effective_unit) / v_new_prod_stock, 4)
        ELSE v_effective_unit END;

      UPDATE products SET
        current_stock         = v_new_prod_stock,
        purchase_price_single = v_new_prod_price,
        sale_price_single     = COALESCE(v_sale_price, sale_price_single)
      WHERE id = v_product_id AND shop_id = v_shop_id;
    END IF;

    -- Batches
    IF v_batch_number IS NOT NULL AND v_expiry_date IS NOT NULL THEN
      INSERT INTO product_batches (
        shop_id, product_id, variant_id, batch_number, expiry_date,
        stock_quantity, purchase_price
      ) VALUES (
        v_shop_id, v_product_id, v_variant_id, v_batch_number, v_expiry_date,
        v_effective_qty, v_effective_unit
      );
    END IF;

    -- IMEIs
    IF item->'imeis' IS NOT NULL AND jsonb_typeof(item->'imeis') = 'array' AND jsonb_array_length(item->'imeis') > 0 THEN
      FOR imei_row IN SELECT * FROM jsonb_array_elements(item->'imeis') LOOP
        INSERT INTO product_imeis (
          shop_id, product_id, imei1, imei2, status
        ) VALUES (
          v_shop_id, v_product_id,
          (imei_row->>'imei1'),
          NULLIF(imei_row->>'imei2', ''),
          'available'
        );
      END LOOP;
    END IF;
  END LOOP;

  -- ── 7. APPLY NEW SUPPLIER CREDIT ──────────────────────────────────────────
  IF v_supplier_id IS NOT NULL AND v_credit_amount > 0 THEN
    SELECT type, COALESCE(current_balance, 0)
      INTO v_supplier_type, v_supplier_bal
      FROM parties
      WHERE id = v_supplier_id AND shop_id = v_shop_id
      FOR UPDATE;

    IF FOUND THEN
      v_balance_delta := CASE WHEN v_supplier_type = 'dual' THEN -v_credit_amount ELSE v_credit_amount END;

      UPDATE parties
        SET current_balance = v_supplier_bal + v_balance_delta
        WHERE id = v_supplier_id AND shop_id = v_shop_id;

      INSERT INTO credit_transactions (
        shop_id, customer_id, amount, transaction_type, remarks
      ) VALUES (
        v_shop_id, v_supplier_id, v_credit_amount, 'charge',
        'Purchase Order Billing #' || UPPER(LEFT(v_po_id::TEXT, 8))
      );
    END IF;
  END IF;

  -- ── 8. APPLY NEW CASH ACCOUNT DEDUCTION ────────────────────────────────────
  IF v_account_id IS NOT NULL AND v_paid_amount > 0 THEN
    SELECT current_balance INTO v_acc_balance
      FROM cash_accounts
      WHERE id = v_account_id AND shop_id = v_shop_id
      FOR UPDATE;

    IF FOUND THEN
      UPDATE cash_accounts
        SET current_balance = v_acc_balance - v_paid_amount
        WHERE id = v_account_id;

      INSERT INTO account_transactions (
        shop_id, account_id, type, amount, ref_type, ref_id, remarks
      ) VALUES (
        v_shop_id, v_account_id, 'withdrawal', v_paid_amount,
        'purchase', v_po_id,
        'Purchase #' || UPPER(LEFT(v_po_id::TEXT, 8))
      );
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'status', 'success',
    'purchase_order_id', v_po_id,
    'total_amount', v_total_amount,
    'paid_amount', v_paid_amount,
    'updated', true
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('status', 'failed', 'error', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION public.atomic_update_purchase_order(JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.atomic_update_purchase_order(JSONB) TO service_role;
