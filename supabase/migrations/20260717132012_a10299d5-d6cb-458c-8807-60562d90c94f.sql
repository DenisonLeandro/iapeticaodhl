CREATE OR REPLACE FUNCTION public.update_llm_config_partial(
  p_org_id uuid,
  p_patch  jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  k        text;
  v_config jsonb;
  allowed  constant text[] := ARRAY[
    'provider', 'model', 'api_key', 'max_docs_per_month', 'economy_mode'
  ];
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'forbidden: authentication required' USING ERRCODE = '42501';
  END IF;

  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'forbidden: admin role required' USING ERRCODE = '42501';
  END IF;

  IF p_org_id IS NULL OR p_org_id IS DISTINCT FROM public.get_my_organization_id() THEN
    RAISE EXCEPTION 'forbidden: organization mismatch' USING ERRCODE = '42501';
  END IF;

  IF p_patch IS NULL OR jsonb_typeof(p_patch) <> 'object' THEN
    RAISE EXCEPTION 'invalid patch: json object expected' USING ERRCODE = '22023';
  END IF;

  FOR k IN SELECT jsonb_object_keys(p_patch) LOOP
    IF NOT (k = ANY(allowed)) THEN
      RAISE EXCEPTION 'invalid patch: field "%" is not allowed', k USING ERRCODE = '22023';
    END IF;
  END LOOP;

  SELECT o.llm_config INTO v_config
    FROM public.organizations o
   WHERE o.id = p_org_id
     FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'organization not found' USING ERRCODE = 'P0002';
  END IF;

  IF v_config IS NULL OR jsonb_typeof(v_config) <> 'object' THEN
    v_config := '{}'::jsonb;
  END IF;

  FOR k IN SELECT jsonb_object_keys(p_patch) LOOP
    IF jsonb_typeof(p_patch -> k) = 'null' THEN
      v_config := v_config - k;
    ELSE
      v_config := v_config || jsonb_build_object(k, p_patch -> k);
    END IF;
  END LOOP;

  UPDATE public.organizations
     SET llm_config = v_config,
         updated_at = now()
   WHERE id = p_org_id;
END;
$$;

COMMENT ON FUNCTION public.update_llm_config_partial(uuid, jsonb) IS
  'PR-SEC-1: patch parcial de organizations.llm_config. Admin-only, escopado a propria organizacao, campos por allowlist. `null` remove o campo. Nunca retorna o conteudo de llm_config.';

REVOKE ALL ON FUNCTION public.update_llm_config_partial(uuid, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.update_llm_config_partial(uuid, jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.update_llm_config_partial(uuid, jsonb) TO authenticated;