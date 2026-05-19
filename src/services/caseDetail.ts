import { supabase } from "@/lib/backend/client";
import type {
  CaseWithRelations,
  CaseMovement,
  CaseDocument,
  MovementFormValues,
} from "@/types/case";

// =============================================================================
// Fetch Case by ID (with client & lawyer joins)
// =============================================================================

export async function fetchCaseById(caseId: string): Promise<CaseWithRelations> {
  const { data, error } = await supabase
    .from("cases")
    .select(
      `
      *,
      client:profiles!cases_client_id_fkey(full_name),
      lawyer:profiles!cases_assigned_to_fkey(full_name)
      `,
    )
    .eq("id", caseId)
    .single();

  if (error) {
    throw new Error(`Erro ao buscar processo: ${error.message}`);
  }

  if (!data) {
    throw new Error("Processo não encontrado");
  }

  const row = data as Record<string, unknown>;

  return {
    id: row.id as string,
    organization_id: row.organization_id as string,
    client_id: row.client_id as string | null,
    case_number: row.case_number as string,
    court: row.court as string,
    branch: row.branch as string | null,
    subject: row.subject as string | null,
    status: row.status as CaseWithRelations["status"],
    opposing_party: row.opposing_party as string | null,
    assigned_to: row.assigned_to as string | null,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
    client_name: (row.client as { full_name: string } | null)?.full_name ?? null,
    lawyer_name: (row.lawyer as { full_name: string } | null)?.full_name ?? null,
  };
}

// =============================================================================
// Case Movements
// =============================================================================

export async function fetchCaseMovements(caseId: string): Promise<CaseMovement[]> {
  const { data, error } = await supabase
    .from("case_movements")
    .select(
      `
      *,
      creator:profiles!case_movements_created_by_fkey(full_name)
      `,
    )
    .eq("case_id", caseId)
    .order("movement_date", { ascending: false });

  if (error) {
    throw new Error(`Erro ao buscar movimentações: ${error.message}`);
  }

  return (data ?? []).map((row: Record<string, unknown>) => ({
    id: row.id as string,
    organization_id: row.organization_id as string,
    case_id: row.case_id as string,
    movement_date: row.movement_date as string,
    type: row.type as CaseMovement["type"],
    description: row.description as string,
    created_by: row.created_by as string | null,
    created_at: row.created_at as string,
    creator_name: (row.creator as { full_name: string } | null)?.full_name ?? null,
  }));
}

export async function createMovement(
  organizationId: string,
  caseId: string,
  values: MovementFormValues,
  createdBy: string,
): Promise<void> {
  const { error } = await supabase.from("case_movements").insert({
    organization_id: organizationId,
    case_id: caseId,
    type: values.type,
    movement_date: values.movement_date,
    description: values.description,
    created_by: createdBy,
  });

  if (error) {
    throw new Error(`Erro ao criar movimentação: ${error.message}`);
  }
}

// =============================================================================
// Case Documents
// =============================================================================

export async function fetchCaseDocuments(caseId: string): Promise<CaseDocument[]> {
  const { data, error } = await supabase
    .from("documents")
    .select(
      `
      id,
      title,
      type,
      status,
      created_at,
      created_by,
      creator:profiles!documents_created_by_fkey(full_name)
      `,
    )
    .eq("case_id", caseId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Erro ao buscar documentos: ${error.message}`);
  }

  return (data ?? []).map((row: Record<string, unknown>) => ({
    id: row.id as string,
    title: row.title as string,
    type: row.type as string,
    status: row.status as string,
    created_at: row.created_at as string,
    created_by: row.created_by as string,
    creator_name: (row.creator as { full_name: string } | null)?.full_name ?? null,
  }));
}
