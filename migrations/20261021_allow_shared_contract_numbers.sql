-- 2026-10-21: one signed contract may cover several camps.
-- Preserve existing authentication, assignment, normalization and length limits.
CREATE OR REPLACE FUNCTION public.csm_set_contract_number(p_camp_id uuid, p_number text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v text := nullif(btrim(p_number), '');
BEGIN
  IF auth.uid() IS NULL OR NOT public.csm_is_active_user() THEN
    RAISE EXCEPTION 'CSM access required' USING errcode='42501';
  END IF;
  IF v IS NOT NULL AND length(v) > 120 THEN
    RAISE EXCEPTION 'Invalid contract number' USING errcode='22023';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.csm_camps
    WHERE id=p_camp_id AND (responsible_id=auth.uid() OR public.csm_is_manager())
  ) THEN
    RAISE EXCEPTION 'Camp not assigned' USING errcode='42501';
  END IF;
  UPDATE public.csm_camps
  SET contract_number=v, updated_at=now()
  WHERE id=p_camp_id;
END
$function$;
