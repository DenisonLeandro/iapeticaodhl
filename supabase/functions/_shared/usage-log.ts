// =============================================================================
// PR-3.7 — Helper de registro de uso da IA (ai_usage_log)
// =============================================================================
// Falha ao registrar NUNCA pode quebrar a operação principal — sempre try/catch
// interno. Apenas console.error em caso de problema.
//
// Privacidade: prompt_summary deve ser técnico (ex.: "chat:74158d88"). Nunca
// gravar prompt completo, resposta da IA, trechos de documento ou texto
// jurídico sensível. metadata só pode conter dados operacionais.

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

export type AiOperation =
  | "chat"
  | "embedding"
  | "classification"
  | "extraction"
  | "dossier"
  | "petition"
  | "generation"
  | "case_analysis"
  | "legal_template_analysis"
  | "legal_draft_generation";

export interface LogAiUsageParams {
  organization_id: string;
  profile_id: string;
  operation: AiOperation;
  provider: string;
  model: string;
  tokens_input?: number;
  tokens_output?: number;
  units?: number;
  cost_estimated: number;
  processing_time_ms?: number;
  case_id?: string | null;
  client_id?: string | null;
  file_id?: string | null;
  document_id?: string | null;
  /** Resumo técnico curto. Ex.: "chat:74158d88". Sem conteúdo jurídico. */
  prompt_summary?: string;
  /** Apenas dados operacionais (counts, flags, model). Sem texto sensível. */
  metadata?: Record<string, unknown>;
}

/**
 * Insere uma linha em public.ai_usage_log. Idempotência não é garantida —
 * cada chamada gera uma nova linha. Use service-role para bypass de RLS.
 */
export async function logAiUsage(
  admin: SupabaseClient,
  params: LogAiUsageParams,
): Promise<void> {
  try {
    const safeSummary = (params.prompt_summary ?? "").slice(0, 120);
    const { error } = await admin.from("ai_usage_log").insert({
      organization_id: params.organization_id,
      profile_id: params.profile_id,
      operation: params.operation,
      provider: params.provider,
      model: params.model,
      tokens_input: Math.max(0, Math.round(params.tokens_input ?? 0)),
      tokens_output: Math.max(0, Math.round(params.tokens_output ?? 0)),
      units: params.units ?? null,
      cost_estimated: Number((params.cost_estimated ?? 0).toFixed(6)),
      processing_time_ms: params.processing_time_ms ?? null,
      case_id: params.case_id ?? null,
      client_id: params.client_id ?? null,
      file_id: params.file_id ?? null,
      document_id: params.document_id ?? null,
      prompt_summary: safeSummary,
      metadata: params.metadata ?? {},
    });
    if (error) {
      console.error("usage-log:insert_error", error.message);
    }
  } catch (e) {
    console.error("usage-log:exception", (e as Error).message);
  }
}

/** Helper: resume um id em "<op>:<id8>" para o prompt_summary técnico. */
export function summaryTag(op: AiOperation, id: string | null | undefined): string {
  if (!id) return `${op}:-`;
  return `${op}:${id.slice(0, 8)}`;
}

/** Classifica o custo estimado (USD) em um dos níveis usados pela UI. */
export type CostLevel = "Baixo" | "Médio" | "Alto" | "Muito Alto";
export function costLevelFromUsd(costUsd: number): CostLevel {
  if (costUsd < 0.001) return "Baixo";
  if (costUsd < 0.01) return "Médio";
  if (costUsd < 0.05) return "Alto";
  return "Muito Alto";
}
