// =============================================================================
// Fase 2 · Bloco 1 — Hook do "Modo econômico de IA" (organization scoped)
// =============================================================================
// Wrapper fino sobre useAISettings. Default true quando não configurado.
//
// PR-SEC-1: envia APENAS `economy_mode`. Antes, este hook reenviava o objeto
// inteiro — incluindo a credencial — só para alterar um booleano. O merge
// parcial agora acontece no servidor, via RPC `update_llm_config_partial`.
// Este arquivo não deve voltar a referenciar a credencial; há guarda estática
// em src/test/security/llm-key-exposure.test.tsx.
// =============================================================================

import { useCallback } from "react";
import { useAISettings } from "@/hooks/useAISettings";

export function useEconomyMode() {
  const { config, isLoadingConfig, patchConfig, isSaving } = useAISettings();

  const economyMode = config?.economy_mode ?? true;

  const setEconomyMode = useCallback(
    async (value: boolean) => {
      await patchConfig({ economy_mode: value });
    },
    [patchConfig],
  );

  return {
    economyMode,
    setEconomyMode,
    isLoading: isLoadingConfig,
    isSaving,
  };
}
