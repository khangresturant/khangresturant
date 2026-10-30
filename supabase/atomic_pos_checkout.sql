-- ============================================================
-- HisabX: Supabase SQL — Run in SQL Editor
-- File: atomic_pos_checkout.sql
-- ============================================================
-- Creates the atomic_pos_checkout() stored procedure.
-- Performs invoice + items + stock deduction + credit update
-- in a single PostgreSQL transaction (all-or-nothing).
-- ============================================================

CREATE OR REPLACE FUNCTION atomic_pos_checkout(
  p_invoice  JSONB,
  p_items    JSONB,
  p_payment  JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_invoice_id    UUID;
  v_shop_id       UUID;
  v_item          JSONB;
  v_product_id    UUID;
  v_variant_id    UUID;
  v_qty           NUMERIC;
  v_stock         NUMERIC;
  v_allow_neg     BOOLEAN;
  v_credit_amt    NUMERIC;
BEGIN
  -- Extract key fields
  v_invoice_id := (p_invoice->>'id')::UUID;
  v_shop_id    := (p_invoice->>'shop_id')::UUID;
  v_credit_amt := COALESCE((p_payment->>'credit_amount')::NUMERIC, 0);

  -- Fetch shop's allow_negative_stock setting
  SELECT allow_negative_stock INTO v_allow_neg
  FROM shops WHERE id = v_shop_id;
  v_allow_neg := COALESCE(v_allow_neg, false);

  -- ── 1. Insert invoice ───────────────────────────────────────────────────
  INSERT INTO invoices (
    id, shop_id, party_id,
    total_amount, discount_amount, tax_amount, credit_amount,
    payment_mode, status,
    created_at, updated_at
  ) VALUES (
    v_invoice_id,
    v_shop_id,
    NULLIF(p_invoice->>'party_id', '')::UUID,
    (p_invoice->>'total_amount')::NUMERIC,
    COALESCE((p_invoice->>'discount_amount')::NUMERIC, 0),
    COALESCE((p_invoice->>'tax_amount')::NUMERIC, 0),
    v_credit_amt,
    COALESCE(p_invoice->>'payment_mode', 'cash'),
    'completed',
    NOW(), NOW()
  );

  -- ── 2. Process each item ────────────────────────────────────────────────
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_product_id := (v_item->>'product_id')::UUID;
    v_variant_id := NULLIF(v_item->>'variant_id', '')::UUID;
    v_qty        := (v_item->>'quantity')::NUMERIC;

    -- Stock guard
    SELECT current_stock INTO v_stock
    FROM products WHERE id = v_product_id FOR UPDATE;

    IF v_stock IS NOT NULL AND v_stock < v_qty AND NOT v_allow_neg THEN
      RAISE EXCEPTION 'INSUFFICIENT_STOCK:product_id=% available=% requested=%',
        v_product_id, v_stock, v_qty;
    END IF;

    -- Insert invoice_item
    INSERT INTO invoice_items (
      id, invoice_id, shop_id,
      product_id, variant_id,
      quantity, unit_price, purchase_price,
      created_at
    ) VALUES (
      gen_random_uuid(), v_invoice_id, v_shop_id,
      v_product_id, v_variant_id,
      v_qty,
      (v_item->>'unit_price')::NUMERIC,
      COALESCE((v_item->>'purchase_price')::NUMERIC, 0),
      NOW()
    );

    -- Deduct from products.current_stock
    UPDATE products
    SET current_stock = current_stock - v_qty,
        updated_at = NOW()
    WHERE id = v_product_id;

    -- Deduct from variant stock if variant sale
    IF v_variant_id IS NOT NULL THEN
      UPDATE product_variants
      SET stock_quantity = stock_quantity - v_qty,
          updated_at = NOW()
      WHERE id = v_variant_id;
    END IF;

    -- Audit: insert stock_movement row
    INSERT INTO stock_movements (
      id, shop_id, product_id, variant_id,
      movement_type, quantity, reference_id, created_at
    ) VALUES (
      gen_random_uuid(), v_shop_id, v_product_id, v_variant_id,
      'sale', -v_qty, v_invoice_id, NOW()
    );
  END LOOP;

  -- ── 3. Credit balance update ────────────────────────────────────────────
  IF v_credit_amt > 0 AND p_invoice->>'party_id' IS NOT NULL THEN
    UPDATE parties
    SET current_balance = current_balance + v_credit_amt,
        updated_at = NOW()
    WHERE id = (p_invoice->>'party_id')::UUID;

    INSERT INTO credit_transactions (
      id, shop_id, party_id,
      amount, transaction_type, reference_id, created_at
    ) VALUES (
      gen_random_uuid(), v_shop_id,
      (p_invoice->>'party_id')::UUID,
      v_credit_amt, 'debit', v_invoice_id, NOW()
    );
  END IF;

  RETURN jsonb_build_object(
    'status',     'success',
    'invoice_id', v_invoice_id
  );

EXCEPTION WHEN OTHERS THEN
  -- Full rollback happens automatically
  RETURN jsonb_build_object(
    'status', 'failed',
    'error',  SQLERRM
  );
END;
$$;

-- Grant execute to authenticated role
GRANT EXECUTE ON FUNCTION atomic_pos_checkout(JSONB, JSONB, JSONB) TO authenticated;
