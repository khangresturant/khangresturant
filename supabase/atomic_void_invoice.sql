-- ============================================================
-- HisabX: Supabase SQL — Run in SQL Editor
-- File: atomic_void_invoice.sql
-- ============================================================
-- Creates the atomic_void_invoice() stored procedure.
-- Marks invoice voided, reverses stock for every line item,
-- and reverses credit balance if it was a credit sale.
-- ============================================================

-- First: add required columns to invoices table if missing
ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS void_reason  TEXT,
  ADD COLUMN IF NOT EXISTS voided_at    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS credit_amount NUMERIC DEFAULT 0;

-- ── Stored Procedure ─────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION atomic_void_invoice(
  p_invoice_id UUID,
  p_reason     TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_inv   RECORD;
  v_item  RECORD;
BEGIN
  -- Fetch invoice (lock row for update)
  SELECT * INTO v_inv
  FROM invoices WHERE id = p_invoice_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'INVOICE_NOT_FOUND:%', p_invoice_id;
  END IF;

  IF v_inv.status = 'voided' THEN
    RAISE EXCEPTION 'ALREADY_VOIDED:%', p_invoice_id;
  END IF;

  -- ── 1. Mark invoice voided ────────────────────────────────────────────────
  UPDATE invoices
  SET status      = 'voided',
      void_reason = p_reason,
      voided_at   = NOW(),
      updated_at  = NOW()
  WHERE id = p_invoice_id;

  -- ── 2. Reverse stock for each item ────────────────────────────────────────
  FOR v_item IN
    SELECT product_id, variant_id, quantity
    FROM invoice_items
    WHERE invoice_id = p_invoice_id
  LOOP
    -- Restore product stock
    UPDATE products
    SET current_stock = current_stock + v_item.quantity,
        updated_at = NOW()
    WHERE id = v_item.product_id;

    -- Restore variant stock if applicable
    IF v_item.variant_id IS NOT NULL THEN
      UPDATE product_variants
      SET stock_quantity = stock_quantity + v_item.quantity,
          updated_at = NOW()
      WHERE id = v_item.variant_id;
    END IF;

    -- Audit: insert void_return stock_movement
    INSERT INTO stock_movements (
      id, shop_id, product_id, variant_id,
      movement_type, quantity, reference_id, created_at
    ) VALUES (
      gen_random_uuid(),
      v_inv.shop_id,
      v_item.product_id,
      v_item.variant_id,
      'void_return',
      +v_item.quantity,
      p_invoice_id,
      NOW()
    );
  END LOOP;

  -- ── 3. Reverse credit balance if credit sale ──────────────────────────────
  IF COALESCE(v_inv.credit_amount, 0) > 0 AND v_inv.party_id IS NOT NULL THEN
    UPDATE parties
    SET current_balance = current_balance - v_inv.credit_amount,
        updated_at = NOW()
    WHERE id = v_inv.party_id;

    INSERT INTO credit_transactions (
      id, shop_id, party_id,
      amount, transaction_type, reference_id, created_at
    ) VALUES (
      gen_random_uuid(),
      v_inv.shop_id,
      v_inv.party_id,
      v_inv.credit_amount,
      'credit',          -- reversal: credit back to customer
      p_invoice_id,
      NOW()
    );
  END IF;

  RETURN jsonb_build_object(
    'status',     'voided',
    'invoice_id', p_invoice_id
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'status', 'failed',
    'error',  SQLERRM
  );
END;
$$;

-- Grant execute to authenticated role
GRANT EXECUTE ON FUNCTION atomic_void_invoice(UUID, TEXT) TO authenticated;
