import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle2, AlertCircle, Clock, FileWarning } from "lucide-react";

type Stage =
  | "pending"
  | "queued"
  | "extracting"
  | "chunking"
  | "classifying"
  | "embedding"
  | "done"
  | "failed"
  | null;

const LABEL: Record<NonNullable<Stage>, string> = {
  pending: "Pendente",
  queued: "Na fila",
  extracting: "Extraindo texto",
  chunking: "Dividindo em blocos",
  classifying: "Classificando",
  embedding: "Indexando",
  done: "Processado",
  failed: "Falhou",
};

export function PipelineStageBadge({
  stage,
  error,
}: {
  stage: Stage;
  error?: string | null;
}) {
  const s = stage ?? "pending";
  const isRunning = ["queued", "extracting", "chunking", "classifying", "embedding"].includes(s);

  if (s === "done") {
    if (error === "sem_texto_reconhecido") {
      return (
        <Badge
          variant="outline"
          className="gap-1 border-amber-500/50 text-amber-600 dark:text-amber-400"
          title="O documento foi processado, mas nenhum texto legível foi reconhecido (provavelmente é uma imagem digitalizada de baixa qualidade)."
        >
          <FileWarning className="h-3 w-3" /> Sem texto reconhecido
        </Badge>
      );
    }
    return (
      <Badge variant="secondary" className="gap-1">
        <CheckCircle2 className="h-3 w-3" /> {LABEL.done}
      </Badge>
    );
  }
  if (s === "failed") {
    return (
      <Badge variant="destructive" className="gap-1" title={error ?? undefined}>
        <AlertCircle className="h-3 w-3" /> {LABEL.failed}
      </Badge>
    );
  }
  if (isRunning) {
    return (
      <Badge variant="outline" className="gap-1">
        <Loader2 className="h-3 w-3 animate-spin" /> {LABEL[s as NonNullable<Stage>]}
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="gap-1">
      <Clock className="h-3 w-3" /> {LABEL.pending}
    </Badge>
  );
}
