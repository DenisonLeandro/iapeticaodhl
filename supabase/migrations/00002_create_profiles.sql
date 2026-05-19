-- Migration: 00002_create_profiles
-- Description: Creates the profiles table, user role enum, and the
-- automatic profile creation trigger for new auth users.

-- =============================================================================
-- 1. Enum: user_role
-- Defines the roles a user can have within an organization.
-- =============================================================================
DO $$ BEGIN
  CREATE TYPE public.user_role AS ENUM (
    'admin',
    'lawyer',
    'secretary',
    'intern'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- =============================================================================
-- 2. Table: profiles
-- Extends auth.users with organization-specific data. Each user belongs
-- to exactly one organization and has a role within it.
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id              UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  role            public.user_role NOT NULL DEFAULT 'admin',
  full_name       TEXT NOT NULL,
  oab_number      TEXT,           -- OAB registration number (nullable: not all users are lawyers)
  phone           TEXT,
  avatar_url      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Comment on table for documentation
COMMENT ON TABLE public.profiles IS 'User profiles linked to auth.users, scoped to an organization';
COMMENT ON COLUMN public.profiles.oab_number IS 'OAB registration number (only for lawyers)';
COMMENT ON COLUMN public.profiles.role IS 'User role within the organization: admin, lawyer, secretary, intern';

-- =============================================================================
-- 3. Index on organization_id for listing users within an org
-- =============================================================================
CREATE INDEX IF NOT EXISTS idx_profiles_organization_id ON public.profiles (organization_id);

-- =============================================================================
-- 4. Trigger: auto-update updated_at on row modification
-- Reuses the set_updated_at() function created in migration 00001.
-- =============================================================================
DROP TRIGGER IF EXISTS trigger_profiles_updated_at ON public.profiles;
CREATE TRIGGER trigger_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- =============================================================================
-- 5. Function: handle_new_user()
-- Automatically creates a profile and (optionally) a new organization
-- when a user signs up via Supabase Auth.
--
-- Expected raw_user_meta_data fields:
--   - full_name (TEXT): user's display name
--   - organization_name (TEXT, optional): if provided, creates a new org
--   - organization_id (UUID, optional): if provided, joins existing org
--
-- If neither organization_name nor organization_id is provided,
-- a default organization is created using the user's name.
--
-- SECURITY DEFINER: runs with the function owner's privileges to
-- bypass RLS when inserting into profiles and organizations.
-- =============================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _full_name      TEXT;
  _org_name       TEXT;
  _org_id         UUID;
  _slug           TEXT;
BEGIN
  -- Extract full_name from user metadata, fallback to email prefix
  _full_name := COALESCE(
    NEW.raw_user_meta_data ->> 'full_name',
    split_part(NEW.email, '@', 1)
  );

  -- Determine organization: use existing org_id, create new, or create default
  _org_id := (NEW.raw_user_meta_data ->> 'organization_id')::UUID;

  IF _org_id IS NULL THEN
    -- Get organization name from metadata or generate from user's name
    _org_name := COALESCE(
      NEW.raw_user_meta_data ->> 'organization_name',
      _full_name || '''s Organization'
    );

    -- Generate a URL-safe slug from the org name
    _slug := lower(regexp_replace(_org_name, '[^a-z0-9]+', '-', 'gi'));
    _slug := trim(both '-' from _slug);

    -- Ensure slug uniqueness by appending a random suffix
    _slug := _slug || '-' || substr(gen_random_uuid()::text, 1, 8);

    -- Create the new organization
    INSERT INTO public.organizations (name, slug)
    VALUES (_org_name, _slug)
    RETURNING id INTO _org_id;
  END IF;

  -- Create the user's profile
  INSERT INTO public.profiles (id, organization_id, role, full_name)
  VALUES (NEW.id, _org_id, 'admin', _full_name);

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.handle_new_user IS 'Creates profile and optional organization on user signup';

-- =============================================================================
-- 6. Trigger: on_auth_user_created
-- Fires after a new user is inserted into auth.users.
-- =============================================================================
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
