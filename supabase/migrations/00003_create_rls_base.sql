-- Migration: 00003_create_rls_base
-- Description: Enables Row Level Security (RLS) on organizations and profiles,
-- and creates policies for organization-scoped data isolation.

-- =============================================================================
-- 1. Enable RLS on organizations
-- =============================================================================
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- 2. Organizations Policies
-- =============================================================================

-- 2.1 SELECT: Authenticated users can only see their own organization
-- Uses a subquery on profiles to determine the user's organization.
CREATE POLICY organizations_select ON public.organizations
  FOR SELECT
  TO authenticated
  USING (
    id IN (
      SELECT p.organization_id
      FROM public.profiles p
      WHERE p.id = auth.uid()
    )
  );

-- 2.2 UPDATE: Only admins can update their organization's settings
CREATE POLICY organizations_update ON public.organizations
  FOR UPDATE
  TO authenticated
  USING (
    id IN (
      SELECT p.organization_id
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role = 'admin'
    )
  )
  WITH CHECK (
    id IN (
      SELECT p.organization_id
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role = 'admin'
    )
  );

-- =============================================================================
-- 3. Enable RLS on profiles
-- =============================================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- 4. Profiles Policies
-- =============================================================================

-- 4.1 SELECT: Users can see all profiles within their own organization
CREATE POLICY profiles_select ON public.profiles
  FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT p.organization_id
      FROM public.profiles p
      WHERE p.id = auth.uid()
    )
  );

-- 4.2 UPDATE (self): Users can update their own profile
CREATE POLICY profiles_update_self ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- 4.3 UPDATE (admin): Admins can update any profile in their organization
CREATE POLICY profiles_admin_update ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (
    organization_id IN (
      SELECT p.organization_id
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role = 'admin'
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT p.organization_id
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role = 'admin'
    )
  );

-- 4.4 INSERT: Only service_role can insert profiles directly
-- (The handle_new_user trigger uses SECURITY DEFINER to bypass RLS,
-- so this policy ensures no client-side inserts are possible.)
CREATE POLICY profiles_insert ON public.profiles
  FOR INSERT
  TO service_role
  WITH CHECK (true);
