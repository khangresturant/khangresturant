const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

const connStr = process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL;
const isRemoteSSL = connStr.includes('sslmode=require') || connStr.includes('supabase.co') || connStr.includes('pooler');

const client = new Client({
  connectionString: connStr,
  ssl: isRemoteSSL ? { rejectUnauthorized: false } : false
});

async function run() {
  await client.connect();
  const res = await client.query(`
    SELECT p.oid, p.proname, pg_get_function_identity_arguments(p.oid) as args
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public' AND p.proname = 'atomic_pos_checkout';
  `);
  console.log('Overloads found:', res.rows);

  // Drop all old overloads and recreate single clean function
  for (const row of res.rows) {
    console.log(`Dropping: DROP FUNCTION public.atomic_pos_checkout(${row.args});`);
    await client.query(`DROP FUNCTION public.atomic_pos_checkout(${row.args});`);
  }

  // Create single canonical function
  await client.query(`
CREATE OR REPLACE FUNCTION public.atomic_pos_checkout(
  p_invoice jsonb,
  p_items jsonb,
  p_payment jsonb,
  p_side_effects jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_shop_id              UUID;
  v_invoice_id           UUID;
  v_edit_invoice_id      UUID;
  v_party_id             UUID;
  v_total_amount         NUMERIC;
  v_discount_amount      NUMERIC;
  v_tax_amount           NUMERIC;
  v_payment_mode         TEXT;
  v_session_id           UUID;
  v_account_id           UUID;
  v_remarks              TEXT;
  v_status               TEXT;
  v_credit_amount        NUMERIC;
  v_cash_amount          NUMERIC;
  v_gift_card_id         UUID;
  v_gift_card_amount     NUMERIC;
  v_loyalty_delta        INTEGER;

  -- loop / item variables
  item                   jsonb;
  v_item_id              UUID;
  v_product_id           UUID;
  v_custom_name          TEXT;
  v_variant_id           UUID;
  v_quantity             NUMERIC;
  v_unit_price           NUMERIC;
  v_subtotal             NUMERIC;
  v_stock_qty            NUMERIC;
  v_is_packing           BOOLEAN;
  v_pack_size            NUMERIC;
  v_purchase_price       NUMERIC;

  -- old invoice row for edit
  v_old_inv              RECORD;
  v_old_item             RECORD;
  v_history_entry        jsonb;
  v_current_acc_balance  NUMERIC;
  v_current_gc_balance   NUMERIC;
  v_current_party_points INTEGER;
  emi_row                jsonb;
BEGIN
  -- Extract top-level fields
  v_shop_id         := (p_invoice->>'shop_id')::UUID;
  v_invoice_id      := COALESCE(NULLIF(p_invoice->>'id', '')::UUID, gen_random_uuid());
  v_edit_invoice_id := NULLIF(p_invoice->>'edit_invoice_id', '')::UUID;
  v_party_id        := NULLIF(p_invoice->>'party_id', '')::UUID;
  v_total_amount    := COALESCE((p_invoice->>'total_amount')::NUMERIC, 0);
  v_discount_amount := COALESCE((p_invoice->>'discount_amount')::NUMERIC, 0);
  v_tax_amount      := COALESCE((p_invoice->>'tax_amount')::NUMERIC, 0);
  v_payment_mode    := COALESCE(p_invoice->>'payment_mode', 'cash');
  v_session_id      := NULLIF(p_invoice->>'register_session_id', '')::UUID;
  v_account_id      := NULLIF(p_invoice->>'account_id', '')::UUID;
  v_remarks         := p_invoice->>'remarks';
  v_status          := COALESCE(p_invoice->>'status', 'paid');

  v_credit_amount   := COALESCE((p_payment->>'credit_amount')::NUMERIC, 0);
  v_cash_amount     := COALESCE((p_payment->>'cash_amount')::NUMERIC, 0);
  v_gift_card_id    := NULLIF(p_payment->>'gift_card_id', '')::UUID;
  v_gift_card_amount:= COALESCE((p_payment->>'gift_card_amount')::NUMERIC, 0);
  v_loyalty_delta   := COALESCE((p_payment->>'loyalty_points_delta')::INTEGER, 0);

  IF v_shop_id IS NULL THEN
    RAISE EXCEPTION 'MISSING_SHOP_ID: shop_id is required';
  END IF;

  -- ============================================================
  -- EDIT MODE REVERSALS
  -- ============================================================
  IF v_edit_invoice_id IS NOT NULL THEN
    SELECT * INTO v_old_inv FROM invoices WHERE id = v_edit_invoice_id AND shop_id = v_shop_id FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'INVOICE_NOT_FOUND: Invoice % not found for edit', v_edit_invoice_id;
    END IF;

    v_history_entry := jsonb_build_object(
      'edited_at',      NOW(),
      'edited_by',      COALESCE(p_payment->>'operator_name', 'pos_user'),
      'old_total',      v_old_inv.total_amount,
      'old_paid',       v_old_inv.paid_amount,
      'old_payment_mode', v_old_inv.payment_mode
    );

    IF v_old_inv.payment_mode <> 'quotation' THEN
      -- A. Restore stock
      FOR v_old_item IN
        SELECT ii.*, p.has_imei
        FROM invoice_items ii
        LEFT JOIN products p ON p.id = ii.product_id
        WHERE ii.invoice_id = v_edit_invoice_id
      LOOP
        IF v_old_item.product_id IS NOT NULL THEN
          IF v_old_item.variant_id IS NOT NULL THEN
            UPDATE product_variants SET stock_quantity = stock_quantity + v_old_item.quantity
            WHERE id = v_old_item.variant_id;
            UPDATE products SET current_stock = (
              SELECT COALESCE(SUM(stock_quantity), 0) FROM product_variants WHERE product_id = v_old_item.product_id
            ) WHERE id = v_old_item.product_id AND shop_id = v_shop_id;
          ELSE
            UPDATE products SET current_stock = current_stock + v_old_item.quantity
            WHERE id = v_old_item.product_id AND shop_id = v_shop_id;
          END IF;
        END IF;

        -- B. Release IMEIs
        UPDATE product_imeis
        SET status = 'available', sold_invoice_item_id = NULL
        WHERE sold_invoice_item_id = v_old_item.id;
      END LOOP;

      -- C. Delete old invoice_items
      DELETE FROM invoice_items WHERE invoice_id = v_edit_invoice_id;

      -- D. Reverse cash account
      IF v_old_inv.account_id IS NOT NULL AND v_old_inv.paid_amount > 0 THEN
        UPDATE cash_accounts SET current_balance = current_balance - v_old_inv.paid_amount
        WHERE id = v_old_inv.account_id;

        INSERT INTO account_transactions (shop_id, account_id, type, amount, ref_type, ref_id, remarks)
        VALUES (v_shop_id, v_old_inv.account_id, 'withdrawal', v_old_inv.paid_amount, 'invoice', v_edit_invoice_id,
                'Edit Reversal POS Sale #' || UPPER(LEFT(v_edit_invoice_id::TEXT, 8)));
      END IF;

      -- E. Reverse party credit
      IF COALESCE(v_old_inv.credit_amount, 0) > 0 AND v_old_inv.party_id IS NOT NULL THEN
        UPDATE parties SET current_balance = current_balance - v_old_inv.credit_amount
        WHERE id = v_old_inv.party_id AND shop_id = v_shop_id;

        INSERT INTO credit_transactions (shop_id, customer_id, amount, transaction_type, remarks)
        VALUES (v_shop_id, v_old_inv.party_id, v_old_inv.credit_amount, 'payment',
                'Edit Reversal POS Sale #' || UPPER(LEFT(v_edit_invoice_id::TEXT, 8)));
      END IF;

      -- F. Delete old EMI schedules
      DELETE FROM emi_schedules WHERE invoice_id = v_edit_invoice_id;
    END IF;
  END IF;

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
      is_edited            = TRUE,
      edit_history         = COALESCE(v_old_inv.edit_history, '[]'::jsonb) || jsonb_build_array(v_history_entry),
      credit_amount        = v_credit_amount
    WHERE id = v_edit_invoice_id AND shop_id = v_shop_id;
    v_invoice_id := v_edit_invoice_id;
  ELSE
    INSERT INTO invoices (
      id, shop_id, party_id, total_amount, tax_amount, discount,
      status, paid_amount, payment_mode, register_session_id, account_id, remarks, credit_amount
    ) VALUES (
      v_invoice_id, v_shop_id, v_party_id, v_total_amount, v_tax_amount, v_discount_amount,
      v_status,
      CASE
        WHEN v_payment_mode IN ('credit','emi') THEN v_cash_amount
        WHEN v_payment_mode = 'quotation'       THEN 0
        ELSE v_total_amount
      END,
      v_payment_mode, v_session_id, v_account_id, v_remarks, v_credit_amount
    )
    ON CONFLICT (id) DO NOTHING;
  END IF;

  -- 2. Invoice items + stock
  FOR item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    -- Safe UUID check
    IF item->>'product_id' IS NOT NULL AND item->>'product_id' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
      v_product_id := (item->>'product_id')::UUID;
    ELSE
      v_product_id := NULL;
    END IF;

    v_custom_name := NULLIF(item->>'custom_name', '');
    v_variant_id := NULLIF(item->>'variant_id', '')::UUID;
    v_quantity   := COALESCE((item->>'quantity')::NUMERIC, 1);
    v_unit_price := COALESCE((item->>'unit_price')::NUMERIC, 0);
    v_subtotal   := COALESCE((item->>'subtotal')::NUMERIC, v_unit_price * v_quantity);
    v_stock_qty  := COALESCE((item->>'stock_qty')::NUMERIC, v_quantity);
    v_is_packing := COALESCE((item->>'is_packing')::BOOLEAN, FALSE);
    v_pack_size  := NULLIF(item->>'pack_size', '')::NUMERIC;
    v_purchase_price := COALESCE((item->>'purchase_price')::NUMERIC, 0);

    INSERT INTO invoice_items (
      invoice_id, product_id, custom_name, variant_id, quantity, unit_price, subtotal,
      packing_name, warranty, sold_imeis, batch_number, purchase_price
    ) VALUES (
      v_invoice_id, v_product_id, v_custom_name, v_variant_id, v_quantity, v_unit_price, v_subtotal,
      NULLIF(item->>'packing_name', ''),
      NULLIF(item->>'warranty', ''),
      NULLIF(item->>'sold_imeis', ''),
      NULLIF(item->>'batch_number', ''),
      v_purchase_price
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

    -- Stock decrement (Only for catalog items that have a real product_id)
    IF v_payment_mode <> 'quotation' AND v_product_id IS NOT NULL THEN
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
  RAISE;
END;
$function$;
  `);

  console.log('Unification complete!');
  await client.end();
}

run().catch(e => {
  console.error(e);
  process.exit(1);
});
