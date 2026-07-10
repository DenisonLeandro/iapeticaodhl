// =============================================================================
// Fase 2 · Bloco 1 — Hook do "Modo econômico de IA" (organization scoped)
// =============================================================================
// Wrapper fino sobre useAISettings. Default true quando não configurado.
// Salva atualizando o JSONB organizations.llm_config preservando os demais
// campos existentes (provider, model, api_key, max_docs_per_month).
// =============================================================================

import { useCallback } from "react";
import { useAISettings } from "@/hooks/useAISettings";

export function useEconomyMode() {
  const { config, isLoadingConfig, saveConfig, isSaving } = useAISettings();

  const economyMode = config?.economy_mode ?? true;

  const setEconomyMode = useCallback(
    async (value: boolean) => {
      await saveConfig({
        provider: config?.provider ?? "lovable",
        model: config?.model ?? "google/gemini-3-flash-preview",
        api_key: config?.api_key ?? "",
        max_docs_per_month: config?.max_docs_per_month,
        economy_mode: value,
      });
    },
    [config, saveConfig],
  );

  return {
    economyMode,
    setEconomyMode,
    isLoading: isLoadingConfig,
    isSaving,
  };
}
