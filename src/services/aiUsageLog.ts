// =============================================================================
// Fase 2 · Bloco 1 — Serviço de listagem simples de ai_usage_log
// =============================================================================
// Usa a mesma tabela ai_usage_log, com filtros básicos + paginação. Este
// serviço NÃO substitui aiCosts.ts (dashboard antigo); ele alimenta a tela
// "Consumo de IA" pedida no Bloco 1.
// =============================================================================

import { supabase } from "@/lib/backend/client";
export type CostLevel = "Baixo" | "Médio" | "Alto" | "Muito Alto";

export type UsageStatus = "success" | "error";

export interface AIUsageLogRow {
  id: string;
  created_at: string;
  profile_id: string | null;
  organization_id: string;
  case_id: string | null;
  client_id: string | null;
  file_id: string | null;
  document_id: string | null;
  operation: string;
  provider: string;
  model: string;
  tokens_input: number | null;
  tokens_output: number | null;
  cost_estimated: number | null;
  processing_time_ms: number | null;
  prompt_summary: string | null;
  metadata: Record<string, unknown> | null;

  // enriquecidos no client
  user_name?: string | null;
  case_number?: string | null;
  cost_level?: CostLevel | null;
  status?: UsageStatus | null;
  edge_function?: string | null;
}

export interface AIUsageFilters {
  from?: string; // ISO
  to?: string;   // ISO
  profile_id?: string | null;
  operation?: string | null;
  model?: string | null;
  cost_level?: CostLevel | null;
  status?: UsageStatus | null;
  edge_function?: string | null;
}

const DEFAULT_LIMIT = 100;

/**
 * Busca linhas do ai_usage_log aplicando os filtros no servidor sempre que
 * possível. cost_level/status vivem em metadata (jsonb) — filtramos client-side
 * quando não há índice específico.
 */
export async function listAIUsageLog(
  filters: AIUsageFilters,
  page = 0,
  pageSize = DEFAULT_LIMIT,
): Promise<{ rows: AIUsageLogRow[]; hasMore: boolean }> {
  const from = page * pageSize;
  const to = from + pageSize - 1;

  let q = supabase
    .from("ai_usage_log")
    .select(
      "id, created_at, profile_id, organization_id, case_id, client_id, file_id, document_id, operation, provider, model, tokens_input, tokens_output, cost_estimated, processing_time_ms, prompt_summary, metadata",
    )
    .order("created_at", { ascending: false })
    .range(from, to);

  if (filters.from) q = q.gte("created_at", filters.from);
  if (filters.to) q = q.lte("created_at", filters.to);
  if (filters.profile_id) q = q.eq("profile_id", filters.profile_id);
  if (filters.operation) q = q.eq("operation", filters.operation);
  if (filters.model) q = q.eq("model", filters.model);

  const { data, error } = await q;
  if (error) throw new Error(error.message);
  let rows = (data ?? []) as AIUsageLogRow[];

  // Enriquecimento com metadata (status, cost_level, edge_function)
  for (const r of rows) {
    const md = (r.metadata ?? {}) as Record<string, unknown>;
    r.cost_level = ((md.cost_level as CostLevel | undefined) ?? null) as CostLevel | null;
    r.status = ((md.status as UsageStatus | undefined) ?? null) as UsageStatus | null;
    r.edge_function =
      (md.edge_function as string | undefined)
      ?? (md.source as string | undefined)
      ?? null;
  }

  // Filtros client-side (metadata jsonb)
  if (filters.cost_level) rows = rows.filter((r) => r.cost_level === filters.cost_level);
  if (filters.status) rows = rows.filter((r) => r.status === filters.status);
  if (filters.edge_function) rows = rows.filter((r) => (r.edge_function ?? "") === filters.edge_function);

  // Nomes / número do processo
  const profileIds = [...new Set(rows.map((r) => r.profile_id).filter(Boolean))] as string[];
  const caseIds = [...new Set(rows.map((r) => r.case_id).filter(Boolean))] as string[];

  if (profileIds.length) {
    const { data: profiles } = await supabase
      .from("profiles").select("id, full_name").in("id", profileIds);
    const m = new Map((profiles ?? []).map((p) => [p.id as string, p.full_name as string]));
    for (const r of rows) if (r.profile_id) r.user_name = m.get(r.profile_id) ?? null;
  }
  if (caseIds.length) {
    const { data: cases } = await supabase
      .from("cases").select("id, case_number").in("id", caseIds);
    const m = new Map((cases ?? []).map((c) => [c.id as string, (c.case_number ?? null) as string | null]));
    for (const r of rows) if (r.case_id) r.case_number = m.get(r.case_id) ?? null;
  }

  return { rows, hasMore: rows.length >= pageSize };
}

export interface UsageSummary {
  total: number;
  success: number;
  error: number;
  very_high: number;
  top_operation: { key: string; count: number } | null;
  top_model: { key: string; count: number } | null;
}

export function summarizeUsage(rows: AIUsageLogRow[]): UsageSummary {
  const opCount = new Map<string, number>();
  const modelCount = new Map<string, number>();
  let success = 0, err = 0, vh = 0;
  for (const r of rows) {
    opCount.set(r.operation, (opCount.get(r.operation) ?? 0) + 1);
    modelCount.set(r.model, (modelCount.get(r.model) ?? 0) + 1);
    if (r.status === "success") success++;
    else if (r.status === "error") err++;
    if (r.cost_level === "Muito Alto") vh++;
  }
  const topOf = (m: Map<string, number>): { key: string; count: number } | null => {
    let best: { key: string; count: number } | null = null;
    for (const [k, c] of m) if (!best || c > best.count) best = { key: k, count: c };
    return best;
  };
  return {
    total: rows.length,
    success,
    error: err,
    very_high: vh,
    top_operation: topOf(opCount),
    top_model: topOf(modelCount),
  };
}

/** Opções distintas para filtros (leve). */
export async function loadFilterOptions(): Promise<{
  users: Array<{ id: string; label: string }>;
  operations: string[];
  models: string[];
}> {
  const since = new Date(Date.now() - 90 * 86_400_000).toISOString();
  const { data } = await supabase
    .from("ai_usage_log")
    .select("profile_id, operation, model")
    .gte("created_at", since)
    .limit(5000);
  const rows = (data ?? []) as Array<{ profile_id: string | null; operation: string; model: string }>;
  const uSet = new Set<string>();
  const opSet = new Set<string>();
  const mSet = new Set<string>();
  for (const r of rows) {
    if (r.profile_id) uSet.add(r.profile_id);
    if (r.operation) opSet.add(r.operation);
    if (r.model) mSet.add(r.model);
  }
  const ids = [...uSet];
  let users: Array<{ id: string; label: string }> = ids.map((id) => ({ id, label: id.slice(0, 8) }));
  if (ids.length) {
    const { data: profiles } = await supabase
      .from("profiles").select("id, full_name").in("id", ids);
    const nm = new Map((profiles ?? []).map((p) => [p.id as string, (p.full_name ?? p.id) as string]));
    users = ids.map((id) => ({ id, label: nm.get(id) ?? id.slice(0, 8) }));
  }
  return { users, operations: [...opSet].sort(), models: [...mSet].sort() };
}
