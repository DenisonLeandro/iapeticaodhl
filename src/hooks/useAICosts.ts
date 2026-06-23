// =============================================================================
// PR-3.7 — Hooks de custos da IA
// =============================================================================

import { useQuery } from "@tanstack/react-query";
import {
  getCaseHistory,
  getCaseSummary,
  getDailySeries,
  getOperationBreakdown,
  getSummariesByWindow,
  getTopCases,
  getTopClients,
  getTopUsers,
} from "@/services/aiCosts";

const STALE = 60_000;

export function useAICostSummaries() {
  return useQuery({
    queryKey: ["ai-costs", "summaries"],
    queryFn: getSummariesByWindow,
    staleTime: STALE,
  });
}

export function useAICostDaily(days = 30) {
  return useQuery({
    queryKey: ["ai-costs", "daily", days],
    queryFn: () => getDailySeries(days),
    staleTime: STALE,
  });
}

export function useAICostBreakdown(days = 30) {
  return useQuery({
    queryKey: ["ai-costs", "breakdown", days],
    queryFn: () => getOperationBreakdown(days),
    staleTime: STALE,
  });
}

export function useAICostTopUsers(days = 30) {
  return useQuery({
    queryKey: ["ai-costs", "top-users", days],
    queryFn: () => getTopUsers(days, 10),
    staleTime: STALE,
  });
}

export function useAICostTopCases(days = 30) {
  return useQuery({
    queryKey: ["ai-costs", "top-cases", days],
    queryFn: () => getTopCases(days, 10),
    staleTime: STALE,
  });
}

export function useAICostTopClients(days = 30) {
  return useQuery({
    queryKey: ["ai-costs", "top-clients", days],
    queryFn: () => getTopClients(days, 10),
    staleTime: STALE,
  });
}

export function useCaseAICostSummary(caseId: string | undefined) {
  return useQuery({
    queryKey: ["ai-costs", "case-summary", caseId],
    queryFn: () => getCaseSummary(caseId!),
    enabled: !!caseId,
    staleTime: STALE,
  });
}

export function useCaseAICostHistory(
  caseId: string | undefined,
  page = 0,
  pageSize = 50,
) {
  return useQuery({
    queryKey: ["ai-costs", "case-history", caseId, page, pageSize],
    queryFn: () => getCaseHistory(caseId!, page, pageSize),
    enabled: !!caseId,
    staleTime: STALE,
  });
}
