-- Migration: 00009_create_tasks
-- Description: Creates the tasks table for task management with kanban board,
-- including RLS policies, indexes, and realtime support.

-- =============================================================================
-- 1. Table: tasks
-- Stores tasks for organization members with kanban workflow support.
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.tasks (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  case_id         UUID REFERENCES public.cases(id) ON DELETE SET NULL,
  title           TEXT NOT NULL,
  description     TEXT,
  priority        TEXT NOT NULL DEFAULT 'media'
                  CONSTRAINT tasks_priority_check CHECK (priority IN ('baixa', 'media', 'alta', 'urgente')),
  status          TEXT NOT NULL DEFAULT 'pendente'
                  CONSTRAINT tasks_status_check CHECK (status IN ('pendente', 'em_andamento', 'concluida', 'cancelada')),
  due_date        DATE,
  assigned_to     UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  assigned_by     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  position        INTEGER NOT NULL DEFAULT 0,
  completed_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.tasks IS 'Task management for organizations with kanban workflow';
COMMENT ON COLUMN public.tasks.priority IS 'Task priority: baixa, media, alta, urgente';
COMMENT ON COLUMN public.tasks.status IS 'Task status: pendente, em_andamento, concluida, cancelada';
COMMENT ON COLUMN public.tasks.position IS 'Position within kanban column for ordering';

-- =============================================================================
-- 2. Indexes for common query patterns
-- =============================================================================
CREATE INDEX IF NOT EXISTS idx_tasks_organization_id ON public.tasks (organization_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON public.tasks (organization_id, status);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to ON public.tasks (assigned_to);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON public.tasks (due_date);
CREATE INDEX IF NOT EXISTS idx_tasks_priority ON public.tasks (organization_id, priority);

-- =============================================================================
-- 3. Trigger: auto-update updated_at on row modification
-- Reuses the set_updated_at() function created in migration 00001.
-- =============================================================================
DROP TRIGGER IF EXISTS trigger_tasks_updated_at ON public.tasks;
CREATE TRIGGER trigger_tasks_updated_at
  BEFORE UPDATE ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- =============================================================================
-- 4. Row Level Security
-- =============================================================================
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

-- Policy: SELECT - users can view tasks from their organization
CREATE POLICY "tasks_select_org"
  ON public.tasks
  FOR SELECT
  USING (
    organization_id IN (
      SELECT p.organization_id FROM public.profiles p WHERE p.id = auth.uid()
    )
  );

-- Policy: INSERT - users can create tasks in their organization
CREATE POLICY "tasks_insert_org"
  ON public.tasks
  FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT p.organization_id FROM public.profiles p WHERE p.id = auth.uid()
    )
  );

-- Policy: UPDATE - users can update tasks in their organization
CREATE POLICY "tasks_update_org"
  ON public.tasks
  FOR UPDATE
  USING (
    organization_id IN (
      SELECT p.organization_id FROM public.profiles p WHERE p.id = auth.uid()
    )
  );

-- Policy: DELETE - only admin or task creator can delete
CREATE POLICY "tasks_delete_admin_or_creator"
  ON public.tasks
  FOR DELETE
  USING (
    assigned_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.organization_id = tasks.organization_id
        AND p.role = 'admin'
    )
  );

-- =============================================================================
-- 5. Enable Realtime
-- =============================================================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.tasks;
