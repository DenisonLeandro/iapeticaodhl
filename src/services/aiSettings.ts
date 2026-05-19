// =============================================================================
// AI Settings Service — CRUD for LLM config & usage stats
// Story 3.3 — AI Provider Settings
// =============================================================================
// TECH DEBT: API key is stored in organizations.llm_config jsonb without
// encryption at the DB level. For production, use pgcrypto or Vault.

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
// updateLLMConfig — save provider + model + API key to organizations.llm_config
// ---------------------------------------------------------------------------

export async function updateLLMConfig(
  organizationId: string,
  config: LLMConfig,
): Promise<void> {
  const { error } = await supabase
    .from("organizations")
    .update({
      llm_config: config as unknown as import("@/integrations/supabase/types").Json,
    })
    .eq("id", organizationId);

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
