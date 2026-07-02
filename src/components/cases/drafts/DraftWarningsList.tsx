import { AlertTriangle } from "lucide-react";

interface Props {
  warnings?: string[] | null;
  missing?: string[] | null;
}

export default function DraftWarningsList({ warnings, missing }: Props) {
  const hasAny =
    (warnings && warnings.length > 0) || (missing && missing.length > 0);
  if (!hasAny) return null;

  return (
    <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 text-sm">
      <div className="mb-2 flex items-center gap-2 font-medium text-amber-800 dark:text-amber-300">
        <AlertTriangle className="h-4 w-4" />
        Pontos de atenção
      </div>
      {warnings && warnings.length > 0 && (
        <div className="mb-2">
          <div className="text-xs font-semibold uppercase text-muted-foreground">
            Alertas
          </div>
          <ul className="list-disc space-y-0.5 pl-5">
            {warnings.map((w, i) => <li key={i}>{w}</li>)}
          </ul>
        </div>
      )}
      {missing && missing.length > 0 && (
        <div>
          <div className="text-xs font-semibold uppercase text-muted-foreground">
            Informações pendentes
          </div>
          <ul className="list-disc space-y-0.5 pl-5">
            {missing.map((w, i) => <li key={i}>{w}</li>)}
          </ul>
        </div>
      )}
    </div>
  );
}
