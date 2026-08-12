// =============================================================================
// PR-4.3A — Badge de status da Ficha (com detalhe do que falta)
// =============================================================================
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  computeIntakeStatus,
  intakeFieldLabel,
  missingIntakeFields,
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
  const missing = missingIntakeFields(values);

  const badge = (
    <Badge className={`${STYLES[status]} ${className ?? ""} cursor-default`}>
      {INTAKE_STATUS_LABEL[status]}
      {status !== "complete" && missing.length > 0 && (
        <span className="ml-1 opacity-80">({missing.length} pendente{missing.length > 1 ? "s" : ""})</span>
      )}
    </Badge>
  );

  if (status === "complete" || missing.length === 0) return badge;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>{badge}</TooltipTrigger>
        <TooltipContent className="max-w-xs">
          <p className="text-xs">
            Falta preencher: {missing.map(intakeFieldLabel).join(", ")}.
          </p>
          <p className="mt-1 text-xs opacity-80">
            Isto não impede salvar — apenas a análise da IA sai menos completa.
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
