// =============================================================================
// PR-4.3A — Badge de status da Ficha
// =============================================================================
import { Badge } from "@/components/ui/badge";
import {
  computeIntakeStatus,
  INTAKE_STATUS_LABEL,
  type CaseIntakeFormValues,
} from "@/types/caseIntake";

interface Props {
  values: Partial<CaseIntakeFormValues> | null | undefined;
  className?: string;
}

const STYLES: Record<string, string> = {
  empty: "bg-muted text-muted-foreground border-transparent",
  partial: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-transparent",
  complete: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-transparent",
};

export default function CaseIntakeStatus({ values, className }: Props) {
  const status = computeIntakeStatus(values);
  return (
    <Badge className={`${STYLES[status]} ${className ?? ""}`}>
      {INTAKE_STATUS_LABEL[status]}
    </Badge>
  );
}
