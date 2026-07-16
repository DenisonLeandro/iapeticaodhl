-- =============================================================================
-- PR-SEC-1 — RPC de patch parcial para organizations.llm_config
-- =============================================================================
-- CONTEXTO
-- `updateLLMConfig` (src/services/aiSettings.ts) substituia o jsonb `llm_config`
-- por inteiro. Como consequencia estrutural, todo caller era obrigado a reenviar
-- TODOS os campos — inclusive `api_key`. Mudar um booleano (`economy_mode`)
-- obrigava o frontend a ler a credencial e regrava-la (round-trip).
--
-- Esta funcao permite alterar campos isolados sem tocar nos demais, eliminando
-- o mecanismo que forcava o round-trip.
--
-- ESCOPO: aditiva. Nao move, nao le e nao apaga credenciais existentes.
--
-- NAO FECHA O P0: `api_key` continua residindo em `organizations.llm_config`, e
-- a policy `organizations_select` (00003_create_rls_base.sql) segue permitindo
-- que qualquer membro autenticado leia a linha. O P0 so estara encerrado quando
-- `api_key` deixar de existir nesse jsonb (PR-SEC-2A).
--
-- Reusa os helpers SECURITY DEFINER ja existentes em
-- 20260327181323_c2c9367c-5a1f-4bf0-bdad-5affd7dbc874.sql:
--   - public.is_admin()
--   - public.get_my_organization_id()
-- =============================================================================

CREATE OR REPLACE FUNCTION public.update_llm_config_partial(
  p_org_id uuid,
  p_patch  jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
-- search_path vazio: nenhum objeto e resolvido por busca implicita. Tudo abaixo
-- e qualificado (public.*, auth.*). Impede shadowing por schema malicioso.
-- pg_catalog permanece implicito, entao now()/jsonb_*() continuam disponiveis.
SET search_path = ''
AS $$
DECLARE
  k        text;
  v_config jsonb;
  -- Allowlist: qualquer campo fora desta lista e rejeitado. Impede que a RPC
  -- vire um canal generico de escrita em jsonb.
  allowed  constant text[] := ARRAY[
    'provider', 'model', 'api_key', 'max_docs_per_month', 'economy_mode'
  ];
BEGIN
  -- 1. Usuario autenticado
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'forbidden: authentication required' USING ERRCODE = '42501';
  END IF;

  -- 2. Papel administrativo
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'forbidden: admin role required' USING ERRCODE = '42501';
  END IF;

  -- 3. Pertencimento a organizacao / impossibilidade de alterar organizacao diversa.
  --    get_my_organization_id() deriva de auth.uid(), nunca do argumento.
  IF p_org_id IS NULL OR p_org_id IS DISTINCT FROM public.get_my_organization_id() THEN
    RAISE EXCEPTION 'forbidden: organization mismatch' USING ERRCODE = '42501';
  END IF;

  -- 4. Formato do patch
  IF p_patch IS NULL OR jsonb_typeof(p_patch) <> 'object' THEN
    RAISE EXCEPTION 'invalid patch: json object expected' USING ERRCODE = '22023';
  END IF;

  -- 5. Allowlist de campos
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

  -- 6. Aplicacao: `null` REMOVE o campo (nao grava JSON null); demais valores
  --    fazem merge. Permite `{"api_key": null}` como apagamento intencional.
  FOR k IN SELECT jsonb_object_keys(p_patch) LOOP
    IF jsonb_typeof(p_patch -> k) = 'null' THEN
      v_config := v_config - k;
    ELSE
      v_config := v_config || jsonb_build_object(k, p_patch -> k);
    END IF;
  END LOOP;

  -- 7. Escrita. RETURNS void: nunca devolve llm_config ao chamador.
  UPDATE public.organizations
     SET llm_config = v_config,
         updated_at = now()
   WHERE id = p_org_id;
END;
$$;

COMMENT ON FUNCTION public.update_llm_config_partial(uuid, jsonb) IS
  'PR-SEC-1: patch parcial de organizations.llm_config. Admin-only, escopado a '
  'propria organizacao, campos por allowlist. `null` remove o campo. Nunca '
  'retorna o conteudo de llm_config.';

-- 8. Revogacao de permissoes publicas inadequadas
REVOKE ALL ON FUNCTION public.update_llm_config_partial(uuid, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.update_llm_config_partial(uuid, jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.update_llm_config_partial(uuid, jsonb) TO authenticated;
