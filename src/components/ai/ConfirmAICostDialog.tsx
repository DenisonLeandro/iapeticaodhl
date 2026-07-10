// =============================================================================
// ConfirmAICostDialog — modal de confirmação para tarefas de IA caras
// =============================================================================
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export type CostLevel = "Baixo" | "Médio" | "Alto" | "Muito Alto";

const LEVEL_COLORS: Record<CostLevel, string> = {
  "Baixo": "text-emerald-600",
  "Médio": "text-amber-600",
  "Alto": "text-orange-600",
  "Muito Alto": "text-red-600",
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  description?: string;
  estimatedCalls?: number | string;
  model?: string;
  costLevel: CostLevel;
  confirmLabel?: string;
  onConfirm: () => void;
}

export default function ConfirmAICostDialog({
  open,
  onOpenChange,
  title = "Confirmar consumo de IA",
  description,
  estimatedCalls,
  model,
  costLevel,
  confirmLabel = "Continuar",
  onConfirm,
}: Props) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-2 text-sm">
              <p>{description ?? "Esta ação pode consumir créditos de IA. Deseja continuar?"}</p>
              <ul className="space-y-1 text-xs text-muted-foreground">
                {estimatedCalls !== undefined && (
                  <li>
                    <span className="font-medium text-foreground">Chamadas estimadas:</span>{" "}
                    {estimatedCalls}
                  </li>
                )}
                {model && (
                  <li>
                    <span className="font-medium text-foreground">Modelo provável:</span> {model}
                  </li>
                )}
                <li>
                  <span className="font-medium text-foreground">Consumo estimado:</span>{" "}
                  <span className={`font-semibold ${LEVEL_COLORS[costLevel]}`}>{costLevel}</span>
                </li>
              </ul>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>{confirmLabel}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
