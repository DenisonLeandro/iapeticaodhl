import { Badge } from "@/components/ui/badge";
import type {
  ClaimApplicability,
  ClaimConfidence,
  ClaimRecommendedAction,
  ClaimRiskLevel,
} from "@/types/caseClaimMap";
import {
  APPLICABILITY_LABEL,
  CONFIDENCE_LABEL,
  RECOMMENDED_ACTION_LABEL,
  RISK_LEVEL_LABEL,
} from "@/types/caseClaimMap";

export function ApplicabilityBadge({ value }: { value: ClaimApplicability }) {
  const cls =
    value === "applicable"
      ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-transparent"
      : value === "not_applicable"
      ? "bg-muted text-muted-foreground border-transparent"
      : "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-transparent";
  return <Badge className={cls}>{APPLICABILITY_LABEL[value] ?? value}</Badge>;
}

export function ConfidenceBadge({ value }: { value: ClaimConfidence }) {
  const cls =
    value === "high"
      ? "bg-primary/15 text-primary border-transparent"
      : value === "medium"
      ? "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-transparent"
      : "bg-muted text-muted-foreground border-transparent";
  return <Badge className={cls}>Confiança: {CONFIDENCE_LABEL[value] ?? value}</Badge>;
}

export function RiskBadge({ value }: { value: ClaimRiskLevel }) {
  const cls =
    value === "critical"
      ? "bg-destructive text-destructive-foreground border-transparent"
      : value === "high"
      ? "bg-destructive/15 text-destructive border-transparent"
      : value === "medium"
      ? "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-transparent"
      : "bg-muted text-muted-foreground border-transparent";
  return <Badge className={cls}>Risco: {RISK_LEVEL_LABEL[value] ?? value}</Badge>;
}

export function RecommendedActionBadge({ value }: { value: ClaimRecommendedAction }) {
  const cls =
    value === "include"
      ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-transparent"
      : value === "exclude"
      ? "bg-muted text-muted-foreground border-transparent"
      : value === "confirm"
      ? "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-transparent"
      : "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-transparent";
  return <Badge className={cls}>{RECOMMENDED_ACTION_LABEL[value] ?? value}</Badge>;
}
