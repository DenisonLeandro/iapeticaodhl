CREATE OR REPLACE FUNCTION public.bootstrap_current_user_profile()
RETURNS public.profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id UUID := auth.uid();
  _claims JSONB := auth.jwt();
  _profile public.profiles%ROWTYPE;
  _org_id UUID;
  _full_name TEXT;
  _org_name TEXT;
  _slug TEXT;
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;

  SELECT *
  INTO _profile
  FROM public.profiles
  WHERE id = _user_id;

  IF FOUND THEN
    RETURN _profile;
  END IF;

  _full_name := COALESCE(
    NULLIF(_claims -> 'user_metadata' ->> 'full_name', ''),
    split_part(COALESCE(_claims ->> 'email', 'usuario'), '@', 1)
  );

  _org_id := NULLIF(_claims -> 'user_metadata' ->> 'organization_id', '')::UUID;

  IF _org_id IS NULL THEN
    _org_name := COALESCE(
      NULLIF(_claims -> 'user_metadata' ->> 'organization_name', ''),
      _full_name || '''s Organization'
    );

    _slug := lower(regexp_replace(_org_name, '[^a-z0-9]+', '-', 'gi'));
    _slug := trim(both '-' from _slug);

    IF _slug = '' THEN
      _slug := 'org';
    END IF;

    _slug := _slug || '-' || substr(gen_random_uuid()::text, 1, 8);

    INSERT INTO public.organizations (name, slug)
    VALUES (_org_name, _slug)
    RETURNING id INTO _org_id;
  END IF;

  INSERT INTO public.profiles (id, organization_id, role, full_name)
  VALUES (_user_id, _org_id, 'admin', _full_name)
  RETURNING * INTO _profile;

  RETURN _profile;
END;
$$;

GRANT EXECUTE ON FUNCTION public.bootstrap_current_user_profile() TO authenticated;