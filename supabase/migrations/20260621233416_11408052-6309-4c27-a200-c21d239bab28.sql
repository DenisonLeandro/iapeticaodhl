
CREATE OR REPLACE FUNCTION public.bootstrap_service_key_vault(p_key text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault
AS $$
DECLARE
  _id uuid;
BEGIN
  SELECT id INTO _id FROM vault.secrets WHERE name = 'service_role_key';
  IF _id IS NULL THEN
    PERFORM vault.create_secret(p_key, 'service_role_key', 'Service role key for internal cron');
  ELSE
    PERFORM vault.update_secret(_id, p_key);
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.bootstrap_service_key_vault(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bootstrap_service_key_vault(text) TO service_role;
