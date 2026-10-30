-- Add has_gift_cards feature toggle column to shops table
ALTER TABLE public.shops ADD COLUMN IF NOT EXISTS has_gift_cards BOOLEAN DEFAULT true;
