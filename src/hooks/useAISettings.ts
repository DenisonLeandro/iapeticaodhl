// =============================================================================
// useAISettings — React Query hooks for AI provider configuration
// Story 3.3 — AI Provider Settings
// =============================================================================

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import {
  fetchLLMConfig,
  updateLLMConfig,
  testConnection,
  fetchUsageStats,
  type LLMConfig,
  type TestConnectionResult,
} from "@/services/aiSettings";
import type { LLMProviderId } from "@/types/ai";

const LLM_CONFIG_KEY = "llm-config";
const USAGE_STATS_KEY = "ai-usage-stats";

export function useAISettings() {
  const { organization } = useAuth();
  const queryClient = useQueryClient();
  const organizationId = organization?.id;

  // -------------------------------------------------------------------------
  // Query: fetch current LLM config
  // -------------------------------------------------------------------------
  const configQuery = useQuery({
    queryKey: [LLM_CONFIG_KEY, organizationId],
    queryFn: () => fetchLLMConfig(organizationId!),
    enabled: !!organizationId,
  });

  // -------------------------------------------------------------------------
  // Mutation: save LLM config
  // -------------------------------------------------------------------------
  const saveConfigMutation = useMutation({
    mutationFn: (config: LLMConfig) => updateLLMConfig(organizationId!, config),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [LLM_CONFIG_KEY, organizationId],
      });
    },
  });

  // -------------------------------------------------------------------------
  // Mutation: test connection
  // -------------------------------------------------------------------------
  const testConnectionMutation = useMutation({
    mutationFn: ({
      provider,
      model,
    }: {
      provider: LLMProviderId;
      model: string;
    }) => testConnection(organizationId!, provider, model),
  });

  // -------------------------------------------------------------------------
  // Query: usage stats for current month
  // -------------------------------------------------------------------------
  const usageQuery = useQuery({
    queryKey: [USAGE_STATS_KEY, organizationId],
    queryFn: () => fetchUsageStats(organizationId!),
    enabled: !!organizationId,
  });

  return {
    // Config
    config: configQuery.data ?? null,
    isLoadingConfig: configQuery.isLoading,
    configError: configQuery.error,

    // Save
    saveConfig: saveConfigMutation.mutateAsync,
    isSaving: saveConfigMutation.isPending,
    saveError: saveConfigMutation.error,

    // Test connection
    testConnection: (provider: LLMProviderId, model: string) =>
      testConnectionMutation.mutateAsync({ provider, model }),
    isTesting: testConnectionMutation.isPending,
    testResult: testConnectionMutation.data as TestConnectionResult | undefined,

    // Usage
    usageStats: usageQuery.data ?? null,
    isLoadingUsage: usageQuery.isLoading,
    usageError: usageQuery.error,
  };
}
