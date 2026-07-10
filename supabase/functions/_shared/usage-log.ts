// =============================================================================
// PR-3.7 — Helper de registro de uso da IA (ai_usage_log)
// Fase 2 · Bloco 1 — adiciona wrapAiCall + cost_level padronizado
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
    // Enriquece metadata com cost_level padronizado caso não venha do caller.
    const meta: Record<string, unknown> = { ...(params.metadata ?? {}) };
    if (meta.cost_level === undefined) {
      meta.cost_level = costLevelFromUsd(params.cost_estimated ?? 0);
    }
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
      metadata: meta,
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
  if (!Number.isFinite(costUsd) || costUsd < 0.001) return "Baixo";
  if (costUsd < 0.01) return "Médio";
  if (costUsd < 0.05) return "Alto";
  return "Muito Alto";
}

// -----------------------------------------------------------------------------
// Fase 2 · Bloco 1 — wrapAiCall(admin, meta, fn)
// -----------------------------------------------------------------------------
// Executa `fn`, mede o tempo total e registra em ai_usage_log — mesmo em erro.
// Best-effort: qualquer falha de log só vai para console.error, jamais quebra
// a função principal. Tokens/custo podem ser retornados pelo `fn` (WrapResult)
// para logging preciso ou passados via `meta.cost_estimated`.
// -----------------------------------------------------------------------------

export interface WrapAiMeta
  extends Omit<
    LogAiUsageParams,
    "processing_time_ms" | "cost_estimated" | "tokens_input" | "tokens_output"
  > {
  cost_estimated?: number;
  tokens_input?: number;
  tokens_output?: number;
}

export interface WrapAiResult<T> {
  result: T;
  tokens_input?: number;
  tokens_output?: number;
  cost_estimated?: number;
  extra_metadata?: Record<string, unknown>;
}

export async function wrapAiCall<T>(
  admin: SupabaseClient,
  meta: WrapAiMeta,
  fn: () => Promise<T | WrapAiResult<T>>,
): Promise<T> {
  const startedAt = Date.now();
  try {
    const raw = await fn();
    const wrapped = isWrapResult<T>(raw)
      ? raw
      : ({ result: raw as T } as WrapAiResult<T>);
    const processingMs = Date.now() - startedAt;
    const tIn = wrapped.tokens_input ?? meta.tokens_input ?? 0;
    const tOut = wrapped.tokens_output ?? meta.tokens_output ?? 0;
    const cost = wrapped.cost_estimated ?? meta.cost_estimated ?? 0;
    const extra = wrapped.extra_metadata ?? {};
    void logAiUsage(admin, {
      ...meta,
      tokens_input: tIn,
      tokens_output: tOut,
      cost_estimated: cost,
      processing_time_ms: processingMs,
      metadata: {
        ...(meta.metadata ?? {}),
        ...extra,
        status: "success",
        cost_level: costLevelFromUsd(cost),
      },
    });
    return wrapped.result;
  } catch (e) {
    const processingMs = Date.now() - startedAt;
    void logAiUsage(admin, {
      ...meta,
      tokens_input: meta.tokens_input ?? 0,
      tokens_output: meta.tokens_output ?? 0,
      cost_estimated: meta.cost_estimated ?? 0,
      processing_time_ms: processingMs,
      metadata: {
        ...(meta.metadata ?? {}),
        status: "error",
        cost_level: costLevelFromUsd(meta.cost_estimated ?? 0),
        error_message: ((e as Error)?.message ?? "unknown").slice(0, 240),
      },
    });
    throw e;
  }
}

function isWrapResult<T>(v: unknown): v is WrapAiResult<T> {
  return !!v && typeof v === "object" && "result" in (v as Record<string, unknown>);
}
