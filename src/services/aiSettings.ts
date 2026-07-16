// =============================================================================
// AI Settings Service — CRUD for LLM config & usage stats
// Story 3.3 — AI Provider Settings
// =============================================================================
// P0 ABERTO: a credencial é armazenada em organizations.llm_config (jsonb), e a
// policy `organizations_select` permite que QUALQUER membro autenticado da
// organização leia a linha — incluindo estagiário/secretária. RLS no Postgres é
// row-level, não column-level: não há policy capaz de esconder apenas `api_key`
// dentro do jsonb. O P0 só estará encerrado quando `api_key` deixar de existir
// aqui (PR-SEC-2A: migração para provider `lovable` + limpeza do campo).
// PR-SEC-1 apenas conteve a superfície: gate de admin na UI e fim dos
// round-trips da chave (ver patchLLMConfig abaixo).

import { supabase } from "@/lib/backend/client";
import { USE_EDGE_FUNCTIONS } from "@/lib/config";
import { directAIGenerate } from "@/lib/ai/direct-client";
import type { LLMProviderId } from "@/types/ai";
import { estimateCost } from "@/lib/ai/pricing";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface LLMConfig {
  provider: LLMProviderId;
  model: string;
  api_key: string;
  max_docs_per_month?: number;
  /**
   * Fase 2 · Bloco 1 — Modo econômico de IA.
   * Default true. Prioriza modelos rápidos/baratos para tarefas simples.
   * Ações críticas continuam usando modelo forte, salvo se `high_precision`.
   */
  economy_mode?: boolean;
}

/**
 * Patch parcial de `llm_config` (PR-SEC-1).
 * - campo omitido   => permanece inalterado no banco
 * - campo com valor => sobrescrito
 * - campo `null`    => REMOVIDO do jsonb (apagamento intencional)
 *
 * Existe para que alterar uma preferência (ex.: `economy_mode`) não obrigue o
 * frontend a reenviar `api_key`. Nunca inclua `api_key` aqui sem ação explícita
 * do administrador.
 */
export interface LLMConfigPatch {
  provider?: LLMProviderId;
  model?: string;
  api_key?: string | null;
  max_docs_per_month?: number | null;
  economy_mode?: boolean;
}

export interface UsageStatsRow {
  provider: LLMProviderId;
  total_input_tokens: number;
  total_output_tokens: number;
  total_calls: number;
  cost_estimated: number;
}

export interface MonthlyUsageStats {
  byProvider: UsageStatsRow[];
  totals: {
    input_tokens: number;
    output_tokens: number;
    calls: number;
    cost: number;
  };
}

// ---------------------------------------------------------------------------
// fetchLLMConfig — read the current llm_config from organizations
// ---------------------------------------------------------------------------

export async function fetchLLMConfig(
  organizationId: string,
): Promise<LLMConfig | null> {
  const { data, error } = await supabase
    .from("organizations")
    .select("llm_config")
    .eq("id", organizationId)
    .single();

  if (error) {
    throw new Error(`Erro ao buscar configuração de IA: ${error.message}`);
  }

  if (!data) return null;
  const row = data as Record<string, unknown>;
  if (!row.llm_config) return null;

  // llm_config is a jsonb column; Supabase returns it as an object
  const config = row.llm_config as unknown as LLMConfig;
  return config;
}

// ---------------------------------------------------------------------------
// patchLLMConfig — altera campos isolados de organizations.llm_config
// ---------------------------------------------------------------------------
// PR-SEC-1: substitui o antigo `updateLLMConfig`, que fazia
// `.update({ llm_config: config })` e portanto SUBSTITUÍA o jsonb inteiro —
// obrigando todo caller a reenviar `api_key` para não perdê-la (round-trip).
//
// A RPC `update_llm_config_partial` faz merge no servidor, valida papel de
// admin, escopa à organização do próprio usuário e aplica allowlist de campos.
// Ver: supabase/migrations/20260716120000_add_update_llm_config_partial.sql

export async function patchLLMConfig(
  organizationId: string,
  patch: LLMConfigPatch,
): Promise<void> {
  const { error } = await supabase.rpc("update_llm_config_partial", {
    p_org_id: organizationId,
    p_patch: patch as unknown as import("@/integrations/supabase/types").Json,
  });

  if (error) {
    throw new Error(`Erro ao salvar configuração de IA: ${error.message}`);
  }
}

// ---------------------------------------------------------------------------
// testConnection — calls ai-generate Edge Function with a simple test prompt
// ---------------------------------------------------------------------------

export interface TestConnectionResult {
  success: boolean;
  latency_ms: number;
  error?: string;
}

export async function testConnection(
  organizationId: string,
  provider: LLMProviderId,
  model: string,
): Promise<TestConnectionResult> {
  const start = performance.now();

  try {
    let content: string | undefined;

    if (USE_EDGE_FUNCTIONS) {
      const { data, error } = await supabase.functions.invoke("ai-generate", {
        body: {
          prompt: "Responda apenas: OK",
          provider,
          model,
          organizationId,
        },
      });

      const latency_ms = Math.round(performance.now() - start);

      if (error) {
        return { success: false, latency_ms, error: error.message };
      }

      content = data?.content;
    } else {
      // Lovable-compatible: test via direct client call
      const result = await directAIGenerate({
        prompt: "Responda apenas: OK",
        provider,
        model,
        organizationId,
      });

      content = result?.content;
    }

    const latency_ms = Math.round(performance.now() - start);

    if (!content) {
      return {
        success: false,
        latency_ms,
        error: "Resposta vazia do provedor",
      };
    }

    return { success: true, latency_ms };
  } catch (err) {
    const latency_ms = Math.round(performance.now() - start);
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, latency_ms, error: message };
  }
}

// ---------------------------------------------------------------------------
// fetchUsageStats — aggregate ai_usage_log for the current month
// ---------------------------------------------------------------------------

export async function fetchUsageStats(
  organizationId: string,
): Promise<MonthlyUsageStats> {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString();

  const { data, error } = await supabase
    .from("ai_usage_log")
    .select("provider, model, tokens_input, tokens_output, cost_estimated")
    .eq("organization_id", organizationId)
    .gte("created_at", startOfMonth)
    .lte("created_at", endOfMonth);

  if (error) {
    throw new Error(`Erro ao buscar estatísticas de uso: ${error.message}`);
  }

  const rows = data ?? [];

  // Aggregate by provider
  const byProviderMap = new Map<
    string,
    { input: number; output: number; calls: number; cost: number }
  >();

  for (const row of rows) {
    const key = row.provider as string;
    const existing = byProviderMap.get(key) ?? {
      input: 0,
      output: 0,
      calls: 0,
      cost: 0,
    };

    const input = Number(row.tokens_input) || 0;
    const output = Number(row.tokens_output) || 0;
    const cost =
      Number(row.cost_estimated) ||
      estimateCost(row.model as string, input, output);

    existing.input += input;
    existing.output += output;
    existing.calls += 1;
    existing.cost += cost;

    byProviderMap.set(key, existing);
  }

  const byProvider: UsageStatsRow[] = [];
  let totalInput = 0;
  let totalOutput = 0;
  let totalCalls = 0;
  let totalCost = 0;

  for (const [provider, stats] of byProviderMap) {
    byProvider.push({
      provider: provider as LLMProviderId,
      total_input_tokens: stats.input,
      total_output_tokens: stats.output,
      total_calls: stats.calls,
      cost_estimated: stats.cost,
    });
    totalInput += stats.input;
    totalOutput += stats.output;
    totalCalls += stats.calls;
    totalCost += stats.cost;
  }

  return {
    byProvider,
    totals: {
      input_tokens: totalInput,
      output_tokens: totalOutput,
      calls: totalCalls,
      cost: totalCost,
    },
  };
}

// ---------------------------------------------------------------------------
// maskApiKey — show only last 4 chars
// ---------------------------------------------------------------------------

export function maskApiKey(key: string): string {
  if (!key || key.length <= 8) return "****";
  return `${key.slice(0, 3)}...${key.slice(-4)}`;
}
