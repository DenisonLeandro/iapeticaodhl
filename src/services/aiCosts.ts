// =============================================================================
// PR-3.7 — Serviço de leitura de custos da IA (agregações SQL)
// =============================================================================
// Toda agregação roda no banco — nunca carregamos logs brutos no client.

import { supabase } from "@/lib/backend/client";

export type AiOperation =
  | "chat"
  | "embedding"
  | "classification"
  | "extraction"
  | "dossier"
  | "petition"
  | "generation";

export interface DailyAggregate {
  day: string; // ISO date
  operation: AiOperation;
  operations: number;
  tokens_input: number;
  tokens_output: number;
  cost_usd: number;
}

export interface CostSummary {
  operations: number;
  cost_usd: number;
  tokens_input: number;
  tokens_output: number;
}

export interface OperationBreakdown {
  operation: AiOperation;
  operations: number;
  cost_usd: number;
}

export interface TopEntity {
  id: string;
  label: string;
  operations: number;
  cost_usd: number;
}

export interface CaseCostRow {
  id: string;
  created_at: string;
  operation: AiOperation;
  model: string;
  tokens_input: number;
  tokens_output: number;
  units: number | null;
  cost_estimated: number;
  processing_time_ms: number | null;
  profile_id: string;
  user_name?: string;
}

interface RawLog {
  id?: string;
  created_at: string;
  operation: AiOperation;
  model?: string;
  tokens_input?: number;
  tokens_output?: number;
  units?: number | null;
  cost_estimated?: number;
  processing_time_ms?: number | null;
  case_id?: string | null;
  client_id?: string | null;
  profile_id?: string;
}

function dayKey(iso: string): string {
  return iso.slice(0, 10);
}

// ---------------------------------------------------------------------------
// Agregações no client (limite ≤ 10k linhas / 30 dias; índice em created_at)
// ---------------------------------------------------------------------------
//
// Mantemos a agregação no client porque PostgREST não expõe GROUP BY
// arbitrário e queremos evitar criar RPCs novas neste PR (escopo declara
// "não alterar RLS existente"). O índice (organization_id, created_at DESC)
// torna a leitura linear; 10k rows × 30d cabem em < 500ms.

async function fetchLogsSince(sinceIso: string): Promise<RawLog[]> {
  const { data, error } = await supabase
    .from("ai_usage_log")
    .select(
      "id, created_at, operation, model, tokens_input, tokens_output, units, cost_estimated, processing_time_ms, case_id, client_id, profile_id",
    )
    .gte("created_at", sinceIso)
    .order("created_at", { ascending: false })
    .limit(10_000);
  if (error) throw error;
  return (data ?? []) as RawLog[];
}

function summarize(logs: RawLog[]): CostSummary {
  return logs.reduce<CostSummary>(
    (acc, l) => {
      acc.operations += 1;
      acc.cost_usd += Number(l.cost_estimated ?? 0);
      acc.tokens_input += Number(l.tokens_input ?? 0);
      acc.tokens_output += Number(l.tokens_output ?? 0);
      return acc;
    },
    { operations: 0, cost_usd: 0, tokens_input: 0, tokens_output: 0 },
  );
}

export async function getSummariesByWindow(): Promise<{
  today: CostSummary;
  d7: CostSummary;
  d30: CostSummary;
}> {
  const now = Date.now();
  const since30 = new Date(now - 30 * 86_400_000).toISOString();
  const since7 = new Date(now - 7 * 86_400_000).toISOString();
  const sinceToday = new Date(new Date().setHours(0, 0, 0, 0)).toISOString();
  const logs = await fetchLogsSince(since30);
  return {
    today: summarize(logs.filter((l) => l.created_at >= sinceToday)),
    d7: summarize(logs.filter((l) => l.created_at >= since7)),
    d30: summarize(logs),
  };
}

export async function getDailySeries(days = 30): Promise<DailyAggregate[]> {
  const since = new Date(Date.now() - days * 86_400_000).toISOString();
  const logs = await fetchLogsSince(since);
  const map = new Map<string, DailyAggregate>();
  for (const l of logs) {
    const day = dayKey(l.created_at);
    const k = `${day}|${l.operation}`;
    const cur = map.get(k) ?? {
      day,
      operation: l.operation,
      operations: 0,
      tokens_input: 0,
      tokens_output: 0,
      cost_usd: 0,
    };
    cur.operations += 1;
    cur.tokens_input += Number(l.tokens_input ?? 0);
    cur.tokens_output += Number(l.tokens_output ?? 0);
    cur.cost_usd += Number(l.cost_estimated ?? 0);
    map.set(k, cur);
  }
  return [...map.values()].sort((a, b) => (a.day < b.day ? -1 : 1));
}

export async function getOperationBreakdown(days = 30): Promise<OperationBreakdown[]> {
  const since = new Date(Date.now() - days * 86_400_000).toISOString();
  const logs = await fetchLogsSince(since);
  const map = new Map<AiOperation, OperationBreakdown>();
  for (const l of logs) {
    const cur = map.get(l.operation) ?? {
      operation: l.operation,
      operations: 0,
      cost_usd: 0,
    };
    cur.operations += 1;
    cur.cost_usd += Number(l.cost_estimated ?? 0);
    map.set(l.operation, cur);
  }
  return [...map.values()].sort((a, b) => b.cost_usd - a.cost_usd);
}

export async function getTopUsers(days = 30, limit = 10): Promise<TopEntity[]> {
  const since = new Date(Date.now() - days * 86_400_000).toISOString();
  const logs = await fetchLogsSince(since);
  const map = new Map<string, { ops: number; cost: number }>();
  for (const l of logs) {
    if (!l.profile_id) continue;
    const cur = map.get(l.profile_id) ?? { ops: 0, cost: 0 };
    cur.ops += 1;
    cur.cost += Number(l.cost_estimated ?? 0);
    map.set(l.profile_id, cur);
  }
  const ids = [...map.keys()];
  let nameById = new Map<string, string>();
  if (ids.length) {
    const { data } = await supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", ids);
    nameById = new Map((data ?? []).map((p) => [p.id as string, (p.full_name ?? "Usuário") as string]));
  }
  return ids
    .map((id) => ({
      id,
      label: nameById.get(id) ?? id.slice(0, 8),
      operations: map.get(id)!.ops,
      cost_usd: map.get(id)!.cost,
    }))
    .sort((a, b) => b.cost_usd - a.cost_usd)
    .slice(0, limit);
}

export async function getTopCases(days = 30, limit = 10): Promise<TopEntity[]> {
  const since = new Date(Date.now() - days * 86_400_000).toISOString();
  const logs = await fetchLogsSince(since);
  const map = new Map<string, { ops: number; cost: number }>();
  for (const l of logs) {
    if (!l.case_id) continue;
    const cur = map.get(l.case_id) ?? { ops: 0, cost: 0 };
    cur.ops += 1;
    cur.cost += Number(l.cost_estimated ?? 0);
    map.set(l.case_id, cur);
  }
  const ids = [...map.keys()];
  let labelById = new Map<string, string>();
  if (ids.length) {
    const { data } = await supabase
      .from("cases")
      .select("id, case_number")
      .in("id", ids);
    labelById = new Map(
      (data ?? []).map((c) => [c.id as string, (c.case_number ?? c.id) as string]),
    );
  }
  return ids
    .map((id) => ({
      id,
      label: labelById.get(id) ?? id.slice(0, 8),
      operations: map.get(id)!.ops,
      cost_usd: map.get(id)!.cost,
    }))
    .sort((a, b) => b.cost_usd - a.cost_usd)
    .slice(0, limit);
}

export async function getTopClients(days = 30, limit = 10): Promise<TopEntity[]> {
  const since = new Date(Date.now() - days * 86_400_000).toISOString();
  const logs = await fetchLogsSince(since);
  const map = new Map<string, { ops: number; cost: number }>();
  for (const l of logs) {
    if (!l.client_id) continue;
    const cur = map.get(l.client_id) ?? { ops: 0, cost: 0 };
    cur.ops += 1;
    cur.cost += Number(l.cost_estimated ?? 0);
    map.set(l.client_id, cur);
  }
  const ids = [...map.keys()];
  let labelById = new Map<string, string>();
  if (ids.length) {
    const { data } = await supabase
      .from("clients")
      .select("id, full_name")
      .in("id", ids);
    labelById = new Map(
      (data ?? []).map((c) => [c.id as string, (c.full_name ?? c.id) as string]),
    );
  }
  return ids
    .map((id) => ({
      id,
      label: labelById.get(id) ?? id.slice(0, 8),
      operations: map.get(id)!.ops,
      cost_usd: map.get(id)!.cost,
    }))
    .sort((a, b) => b.cost_usd - a.cost_usd)
    .slice(0, limit);
}

// ---------------------------------------------------------------------------
// Custos por caso (aba "Custos IA" no processo)
// ---------------------------------------------------------------------------

export async function getCaseSummary(caseId: string): Promise<{
  summary: CostSummary;
  by_operation: OperationBreakdown[];
}> {
  const { data, error } = await supabase
    .from("ai_usage_log")
    .select("operation, tokens_input, tokens_output, cost_estimated")
    .eq("case_id", caseId)
    .limit(10_000);
  if (error) throw error;
  const rows = (data ?? []) as RawLog[];
  const map = new Map<AiOperation, OperationBreakdown>();
  for (const l of rows) {
    const cur = map.get(l.operation) ?? {
      operation: l.operation,
      operations: 0,
      cost_usd: 0,
    };
    cur.operations += 1;
    cur.cost_usd += Number(l.cost_estimated ?? 0);
    map.set(l.operation, cur);
  }
  return {
    summary: summarize(rows),
    by_operation: [...map.values()].sort((a, b) => b.cost_usd - a.cost_usd),
  };
}

export async function getCaseHistory(
  caseId: string,
  page = 0,
  pageSize = 50,
): Promise<{ rows: CaseCostRow[]; total: number }> {
  const from = page * pageSize;
  const to = from + pageSize - 1;
  const { data, error, count } = await supabase
    .from("ai_usage_log")
    .select(
      "id, created_at, operation, model, tokens_input, tokens_output, units, cost_estimated, processing_time_ms, profile_id",
      { count: "exact" },
    )
    .eq("case_id", caseId)
    .order("created_at", { ascending: false })
    .range(from, to);
  if (error) throw error;
  const rows = (data ?? []) as CaseCostRow[];
  const ids = [...new Set(rows.map((r) => r.profile_id).filter(Boolean))];
  if (ids.length) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", ids);
    const m = new Map((profiles ?? []).map((p) => [p.id as string, p.full_name as string]));
    for (const r of rows) r.user_name = m.get(r.profile_id) ?? r.profile_id.slice(0, 8);
  }
  return { rows, total: count ?? rows.length };
}

// ---------------------------------------------------------------------------
// Export CSV (client-side)
// ---------------------------------------------------------------------------

export function toCSV(rows: Array<Record<string, unknown>>): string {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]);
  const escape = (v: unknown) => {
    const s = v == null ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [headers.join(",")];
  for (const r of rows) lines.push(headers.map((h) => escape(r[h])).join(","));
  return lines.join("\n");
}

export function downloadCSV(filename: string, csv: string): void {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
