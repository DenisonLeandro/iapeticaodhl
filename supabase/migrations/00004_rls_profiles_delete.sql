-- Migration: 00004_rls_profiles_delete
-- Description: Adds DELETE policy on profiles so admins can remove members
-- from their organization. Extends base RLS from 00003_create_rls_base.sql.

-- =============================================================================
-- 1. DELETE policy: Only admins can remove members from their organization
-- =============================================================================
CREATE POLICY profiles_admin_delete ON public.profiles
  FOR DELETE
  TO authenticated
  USING (
    organization_id IN (
      SELECT p.organization_id
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role = 'admin'
    )
  );
