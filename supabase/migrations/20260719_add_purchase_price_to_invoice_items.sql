-- Add purchase_price column to invoice_items table
-- This column was expected by the atomic_pos_checkout v3 RPC but was missing from the table
ALTER TABLE invoice_items 
  ADD COLUMN IF NOT EXISTS purchase_price NUMERIC DEFAULT 0;

-- Add a comment for clarity
COMMENT ON COLUMN invoice_items.purchase_price IS 'Cost price at time of sale — used for margin/profit calculations in reports';
