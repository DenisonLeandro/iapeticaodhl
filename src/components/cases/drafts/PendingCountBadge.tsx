import { AlertCircle, CheckCircle2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { countPendingMarkers, CATEGORY_LABEL, type PendingCategory } from "@/lib/drafts/pending-markers";

interface Props { content: string; }

export default function PendingCountBadge({ content }: Props) {
  const c = countPendingMarkers(content);
  if (c.total === 0) {
    return (
      <Card className="p-3">
        <div className="flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-300">
          <CheckCircle2 className="h-4 w-4" />
          <span className="font-medium">Nenhuma pendência marcada</span>
        </div>
      </Card>
    );
  }
  const rows: PendingCategory[] = ["informar", "calcular", "anexar", "confirmar", "revisar", "jurisprudencia"];
  return (
    <Card className="p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <AlertCircle className="h-4 w-4 text-red-500" />
          Pendências na peça
        </div>
        <Badge variant="destructive">{c.total}</Badge>
      </div>
      <ul className="space-y-1 text-xs">
        {rows.map((k) => {
          const n = c[k];
          if (!n) return null;
          return (
            <li key={k} className="flex items-center justify-between">
              <span className="text-muted-foreground">{CATEGORY_LABEL[k]}</span>
              <span className="font-mono font-semibold">{n}</span>
            </li>
          );
        })}
      </ul>
      <p className="mt-2 text-[11px] italic text-muted-foreground">
        Ative "Ver com destaques" para localizar os marcadores no corpo da peça.
      </p>
    </Card>
  );
}
