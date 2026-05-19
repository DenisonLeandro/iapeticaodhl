import { supabase } from "@/lib/backend/client";
import type { CaseFilters, CaseFormValues, CaseWithRelations } from "@/types/case";

const PAGE_SIZE = 10;

export interface FetchCasesResult {
  data: CaseWithRelations[];
  count: number;
}

export async function fetchCases(
  organizationId: string,
  filters: CaseFilters = {},
): Promise<FetchCasesResult> {
  const {
    search,
    status,
    court,
    assigned_to,
    page = 1,
    pageSize = PAGE_SIZE,
  } = filters;

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from("cases")
    .select("*", { count: "exact" })
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .range(from, to);

  if (status) {
    query = query.eq("status", status);
  }

  if (court) {
    query = query.eq("court", court);
  }

  if (assigned_to) {
    query = query.eq("assigned_to", assigned_to);
  }

  if (search) {
    query = query.or(`case_number.ilike.%${search}%`);
  }

  const { data, error, count } = await query;

  if (error) {
    throw new Error(`Erro ao buscar processos: ${error.message}`);
  }

  const rows = data ?? [];

  // Split-queries for related names
  const clientIds = [...new Set(rows.map((r) => r.client_id).filter(Boolean))] as string[];
  const lawyerIds = [...new Set(rows.map((r) => r.assigned_to).filter(Boolean))] as string[];

  const [clientsRes, lawyersRes] = await Promise.all([
    clientIds.length > 0
      ? supabase.from("clients").select("id, full_name").in("id", clientIds)
      : { data: [] as { id: string; full_name: string }[] },
    lawyerIds.length > 0
      ? supabase.from("profiles").select("id, full_name").in("id", lawyerIds)
      : { data: [] as { id: string; full_name: string }[] },
  ]);

  const clientMap = new Map((clientsRes.data ?? []).map((c) => [c.id, c.full_name]));
  const lawyerMap = new Map((lawyersRes.data ?? []).map((l) => [l.id, l.full_name]));

  const cases: CaseWithRelations[] = rows.map((row) => ({
    id: row.id,
    organization_id: row.organization_id,
    client_id: row.client_id,
    case_number: row.case_number,
    court: row.court,
    branch: row.branch,
    subject: row.subject,
    status: row.status,
    opposing_party: row.opposing_party,
    assigned_to: row.assigned_to,
    created_at: row.created_at,
    updated_at: row.updated_at,
    client_name: row.client_id ? clientMap.get(row.client_id) ?? null : null,
    lawyer_name: row.assigned_to ? lawyerMap.get(row.assigned_to) ?? null : null,
  }));

  return { data: cases, count: count ?? 0 };
}

export async function createCase(
  organizationId: string,
  values: CaseFormValues,
): Promise<void> {
  const { error } = await supabase.from("cases").insert({
    organization_id: organizationId,
    case_number: values.case_number,
    court: values.court,
    branch: values.branch || null,
    subject: values.subject || null,
    opposing_party: values.opposing_party || null,
    client_id: values.client_id || null,
    assigned_to: values.assigned_to || null,
    status: values.status,
  });

  if (error) {
    throw new Error(`Erro ao criar processo: ${error.message}`);
  }
}

export async function updateCase(
  caseId: string,
  values: Partial<CaseFormValues>,
): Promise<void> {
  const updateData: Record<string, unknown> = {} as any;

  if (values.case_number !== undefined) updateData.case_number = values.case_number;
  if (values.court !== undefined) updateData.court = values.court;
  if (values.branch !== undefined) updateData.branch = values.branch || null;
  if (values.subject !== undefined) updateData.subject = values.subject || null;
  if (values.opposing_party !== undefined) updateData.opposing_party = values.opposing_party || null;
  if (values.client_id !== undefined) updateData.client_id = values.client_id || null;
  if (values.assigned_to !== undefined) updateData.assigned_to = values.assigned_to || null;
  if (values.status !== undefined) updateData.status = values.status;

  const { error } = await supabase
    .from("cases")
    .update(updateData as any)
    .eq("id", caseId);

  if (error) {
    throw new Error(`Erro ao atualizar processo: ${error.message}`);
  }
}

export async function fetchLawyers(organizationId: string) {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name")
    .eq("organization_id", organizationId)
    .eq("role", "lawyer")
    .order("full_name", { ascending: true });

  if (error) {
    throw new Error(`Erro ao buscar advogados: ${error.message}`);
  }

  return data ?? [];
}
