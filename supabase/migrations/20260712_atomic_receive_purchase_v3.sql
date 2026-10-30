-- ============================================================
-- atomic_receive_purchase
-- All 9 operations in ONE Postgres transaction:
--   1.  Insert purchase_order
--   2.  Insert purchase_order_items
--   3.  Stock increment (products / product_variants, packing-aware)
--   4.  Weighted-average cost update on products / product_variants
--   5.  Supplier credit balance update (parties.current_balance)
--   6.  credit_transactions row for the supplier
--   7.  Cash account deduction (cash_accounts + account_transactions)
--   8.  product_batches rows (pharmacy / fertilizer)
--   9.  product_imeis rows (if serialized / serialized items)
-- Full rollback on any error.
-- ============================================================
CREATE OR REPLACE FUNCTION public.atomic_receive_purchase(p_payload JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  -- purchase order fields
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

  -- per-item
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

  -- stock / WAC
  v_old_prod_stock  NUMERIC;
  v_old_prod_price  NUMERIC;
  v_new_prod_stock  NUMERIC;
  v_new_prod_price  NUMERIC;
  v_old_var_stock   NUMERIC;
  v_old_var_price   NUMERIC;
  v_new_var_stock   NUMERIC;
  v_new_var_price   NUMERIC;
  v_price_per_base  NUMERIC;

  -- supplier
  v_supplier_type   TEXT;
  v_supplier_bal    NUMERIC;
  v_balance_delta   NUMERIC;

  -- cash account
  v_acc_balance     NUMERIC;

  -- imei
  imei_row          JSONB;
BEGIN
  -- ── Extract top-level fields ────────────────────────────────────────────────
  v_po_id          := COALESCE(NULLIF(p_payload->>'purchase_order_id','')::UUID, gen_random_uuid());
  v_shop_id        := (p_payload->>'shop_id')::UUID;
  v_supplier_id    := NULLIF(p_payload->>'supplier_id','')::UUID;
  v_total_amount   := COALESCE((p_payload->>'total_amount')::NUMERIC, 0);
  v_paid_amount    := COALESCE((p_payload->>'paid_amount')::NUMERIC, 0);
  v_discount       := COALESCE((p_payload->>'discount')::NUMERIC, 0);
  v_tax_amount     := COALESCE((p_payload->>'tax_amount')::NUMERIC, 0);
  v_status         := COALESCE(p_payload->>'status', 'PAID');
  v_payment_mode   := COALESCE(p_payload->>'payment_mode', 'cash');
  v_notes          := NULLIF(p_payload->>'notes','');
  v_invoice_number := NULLIF(p_payload->>'invoice_number','');
  v_account_id     := NULLIF(p_payload->>'account_id','')::UUID;
  v_credit_amount  := GREATEST(0, v_total_amount - v_paid_amount);

  -- ── 1. Insert purchase_order ─────────────────────────────────────────────
  INSERT INTO purchase_orders (
    id, shop_id, supplier_id, total_amount, paid_amount,
    discount, tax_amount, status, payment_mode, notes,
    invoice_number, is_voided, account_id
  ) VALUES (
    v_po_id, v_shop_id, v_supplier_id, v_total_amount, v_paid_amount,
    v_discount, v_tax_amount, v_status, v_payment_mode, v_notes,
    v_invoice_number, FALSE, v_account_id
  )
  ON CONFLICT (id) DO NOTHING;

  -- ── 2-4. Items: insert rows + stock + WAC ───────────────────────────────
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

    -- Effective received qty & unit cost (after bonus/discount)
    v_effective_qty  := v_quantity + v_bonus_qty;
    v_effective_cost := GREATEST(0, v_purchase_price * v_quantity - v_discount_amt);
    v_effective_unit := CASE WHEN v_effective_qty > 0 THEN v_effective_cost / v_effective_qty ELSE v_purchase_price END;

    -- 2. Insert purchase_order_items
    INSERT INTO purchase_order_items (
      purchase_order_id, product_id, variant_id, quantity, unit_price,
      purchase_price, subtotal, bonus_quantity, discount_amount,
      batch_number, expiry_date
    ) VALUES (
      v_po_id, v_product_id, v_variant_id, v_quantity, v_purchase_price,
      v_purchase_price, v_purchase_price * v_quantity, v_bonus_qty, v_discount_amt,
      v_batch_number, v_expiry_date
    ) ON CONFLICT DO NOTHING;

    -- 3 & 4. Stock + WAC
    IF v_variant_id IS NOT NULL THEN
      IF v_is_packing AND v_pack_size IS NOT NULL AND v_pack_size > 0 THEN
        -- ── Box/packing variant — update product base stock ──
        SELECT current_stock, COALESCE(purchase_price_single, v_purchase_price / v_pack_size)
          INTO v_old_prod_stock, v_old_prod_price
          FROM products WHERE id = v_product_id AND shop_id = v_shop_id FOR UPDATE;

        v_price_per_base := v_effective_unit / v_pack_size;
        v_new_prod_stock := COALESCE(v_old_prod_stock, 0) + (v_effective_qty * v_pack_size);
        v_new_prod_price := CASE WHEN v_new_prod_stock > 0
          THEN ROUND((COALESCE(v_old_prod_stock,0) * COALESCE(v_old_prod_price,0)
                    + v_effective_qty * v_pack_size * v_price_per_base)
                    / v_new_prod_stock, 4)
          ELSE v_price_per_base END;

        UPDATE products SET
          current_stock       = v_new_prod_stock,
          purchase_price_single = v_new_prod_price
        WHERE id = v_product_id AND shop_id = v_shop_id;

        -- Also update variant stock + WAC
        SELECT COALESCE(stock_quantity,0), COALESCE(purchase_price, v_effective_unit)
          INTO v_old_var_stock, v_old_var_price
          FROM product_variants WHERE id = v_variant_id FOR UPDATE;

        v_new_var_stock := v_old_var_stock + v_effective_qty;
        v_new_var_price := CASE WHEN v_new_var_stock > 0
          THEN ROUND((v_old_var_stock * v_old_var_price + v_effective_qty * v_effective_unit) / v_new_var_stock, 4)
          ELSE v_effective_unit END;

        UPDATE product_variants SET
          stock_quantity = v_new_var_stock,
          purchase_price = v_new_var_price,
          sale_price     = COALESCE(v_sale_price, sale_price)
        WHERE id = v_variant_id;

      ELSE
        -- ── Regular variant ──
        SELECT COALESCE(stock_quantity,0), COALESCE(purchase_price, v_effective_unit)
          INTO v_old_var_stock, v_old_var_price
          FROM product_variants WHERE id = v_variant_id FOR UPDATE;

        v_new_var_stock := v_old_var_stock + v_effective_qty;
        v_new_var_price := CASE WHEN v_new_var_stock > 0
          THEN ROUND((v_old_var_stock * v_old_var_price + v_effective_qty * v_effective_unit) / v_new_var_stock, 4)
          ELSE v_effective_unit END;

        UPDATE product_variants SET
          stock_quantity = v_new_var_stock,
          purchase_price = v_new_var_price,
          sale_price     = COALESCE(v_sale_price, sale_price)
        WHERE id = v_variant_id;

        -- Re-aggregate parent product stock from all variants
        UPDATE products SET
          current_stock = (SELECT COALESCE(SUM(stock_quantity),0) FROM product_variants WHERE product_id = v_product_id)
        WHERE id = v_product_id AND shop_id = v_shop_id;
      END IF;

    ELSE
      -- ── No variant — update product directly ──
      SELECT COALESCE(current_stock,0), COALESCE(purchase_price_single, v_effective_unit)
        INTO v_old_prod_stock, v_old_prod_price
        FROM products WHERE id = v_product_id AND shop_id = v_shop_id FOR UPDATE;

      v_new_prod_stock := v_old_prod_stock + v_effective_qty;
      v_new_prod_price := CASE WHEN v_new_prod_stock > 0
        THEN ROUND((v_old_prod_stock * v_old_prod_price + v_effective_qty * v_effective_unit) / v_new_prod_stock, 4)
        ELSE v_effective_unit END;

      UPDATE products SET
        current_stock         = v_new_prod_stock,
        purchase_price_single = v_new_prod_price,
        sale_price_single     = COALESCE(v_sale_price, sale_price_single)
      WHERE id = v_product_id AND shop_id = v_shop_id;
    END IF;

    -- 8. product_batches (pharmacy / fertilizer industries)
    IF v_batch_number IS NOT NULL AND v_expiry_date IS NOT NULL THEN
      INSERT INTO product_batches (
        shop_id, product_id, variant_id, batch_number, expiry_date,
        stock_quantity, purchase_price
      ) VALUES (
        v_shop_id, v_product_id, v_variant_id, v_batch_number, v_expiry_date,
        v_effective_qty, v_effective_unit
      );
    END IF;

    -- 9. product_imeis (if serialized / serialized items)
    IF item->'imeis' IS NOT NULL AND jsonb_array_length(item->'imeis') > 0 THEN
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

  END LOOP; -- items

  -- ── 5 & 6. Supplier credit balance + credit_transactions ────────────────
  IF v_supplier_id IS NOT NULL AND v_credit_amount > 0 THEN
    SELECT type, COALESCE(current_balance, 0)
      INTO v_supplier_type, v_supplier_bal
      FROM parties
      WHERE id = v_supplier_id AND shop_id = v_shop_id
      FOR UPDATE;

    IF FOUND THEN
      -- "dual" party: credit to them reduces their AR balance (negative delta)
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

  -- ── 7. Cash account deduction + account_transactions ────────────────────
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
        || COALESCE(' | Inv: ' || v_invoice_number, '')
      );
    END IF;
  END IF;

  RETURN jsonb_build_object('status', 'ok', 'purchase_order_id', v_po_id);

EXCEPTION WHEN OTHERS THEN
  RAISE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.atomic_receive_purchase(JSONB) TO authenticated;
