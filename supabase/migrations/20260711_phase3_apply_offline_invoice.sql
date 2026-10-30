-- Phase 3: apply_offline_invoice — thin wrapper around pos_checkout with sync metadata
-- Requires Phase 2 pos_checkout.

CREATE OR REPLACE FUNCTION public.apply_offline_invoice(p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_payload jsonb;
  v_result jsonb;
BEGIN
  v_payload := p_payload || jsonb_build_object(
    'client_meta',
    COALESCE(p_payload->'client_meta', '{}'::jsonb) || jsonb_build_object(
      'is_offline_creation', true,
      'applied_via', 'apply_offline_invoice',
      'applied_at', timezone('utc', now())
    )
  );

  v_result := public.pos_checkout(v_payload);
  RETURN v_result || jsonb_build_object('offline_applied', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.apply_offline_invoice(jsonb) TO authenticated;

NOTIFY pgrst, 'reload schema';
