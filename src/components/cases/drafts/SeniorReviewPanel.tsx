import { useState } from "react";
import { Sparkles, Loader2, ShieldAlert } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { supabase } from "@/lib/backend/client";
import type { CaseDraft } from "@/types/caseDraft";

interface Props {
  draft: CaseDraft;
  onRefresh: () => void;
}

export default function SeniorReviewPanel({ draft, onRefresh }: Props) {
  const [running, setRunning] = useState(false);
  const review = (draft as unknown as { senior_review?: SeniorReview | null }).senior_review;
  const status = (draft as unknown as { senior_review_status?: string | null }).senior_review_status;

  const handleRun = async () => {
    setRunning(true);
    try {
      const { data, error } = await supabase.functions.invoke("senior-legal-review", {
        body: { draft_id: draft.id },
      });
      if (error) throw new Error(error.message);
      if (data?.status === "failed") throw new Error(data?.error || "Falha na revisão sênior");
      toast.success("Revisão sênior concluída.");
      onRefresh();
    } catch (e) {
      toast.error((e as Error).message || "Não foi possível concluir a revisão sênior.");
    } finally {
      setRunning(false);
    }
  };

  return (
    <Card className="p-4">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <ShieldAlert className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">Revisor jurídico sênior</h3>
        </div>
        <Button size="sm" variant="outline" onClick={handleRun} disabled={running}>
          {running || status === "running" ? (
            <><Loader2 className="mr-1 h-3 w-3 animate-spin" /> Revisando…</>
          ) : (
            <><Sparkles className="mr-1 h-3 w-3" /> Revisar como advogado sênior</>
          )}
        </Button>
      </div>

      {!review && status !== "running" && (
        <p className="text-xs text-muted-foreground">
          Ainda não executado. O relatório será exibido aqui e NÃO altera a peça — o advogado decide se aplica as melhorias.
        </p>
      )}

      {review && (
        <div className="space-y-2 text-xs">
          {typeof review.overall_score === "number" && (
            <div className="text-sm">
              Nota geral: <strong>{review.overall_score}/10</strong>
              {review.should_rewrite && <span className="ml-2 rounded bg-red-500/10 px-1.5 py-0.5 text-red-700">recomenda reescrita</span>}
            </div>
          )}
          <Section title="Pedidos faltantes" items={review.missing_requests} />
          <Section title="Sem base documental" items={review.requests_without_documental_basis} />
          <Section title="Fundamentos desatualizados" items={review.outdated_grounds} />
          <Section title="Jurisprudência sem link" items={review.jurisprudence_without_link} />
          <Section title="Risco alto" items={review.high_risk_items} tone="danger" />
          <Section title="Valores ausentes" items={review.missing_values} />
          <Section title="Cálculos pendentes" items={review.pending_calculations} />
          <Section title="Contradições internas" items={review.internal_contradictions} tone="danger" />
          <Section title="Lacunas vs. modelo" items={review.gaps_vs_template} />
          <Section title="Sugestões de melhoria" items={review.improvement_suggestions} tone="info" />
          <p className="mt-2 text-[11px] italic text-muted-foreground">
            Relatório do revisor sênior. Não altera a minuta. Para incorporar as sugestões, edite a peça manualmente ou clique em "Regenerar minuta".
          </p>
        </div>
      )}
    </Card>
  );
}

function Section({ title, items, tone = "warn" }: { title: string; items?: string[] | null; tone?: "warn" | "danger" | "info" }) {
  if (!items || items.length === 0) return null;
  const color =
    tone === "danger" ? "text-red-700 dark:text-red-300"
    : tone === "info" ? "text-primary"
    : "text-amber-800 dark:text-amber-300";
  return (
    <div>
      <div className={`text-[11px] font-semibold uppercase ${color}`}>{title}</div>
      <ul className="list-disc space-y-0.5 pl-4">
        {items.map((t, i) => <li key={i}>{t}</li>)}
      </ul>
    </div>
  );
}

interface SeniorReview {
  missing_requests?: string[];
  requests_without_documental_basis?: string[];
  outdated_grounds?: string[];
  jurisprudence_without_link?: string[];
  high_risk_items?: string[];
  missing_values?: string[];
  pending_calculations?: string[];
  internal_contradictions?: string[];
  gaps_vs_template?: string[];
  improvement_suggestions?: string[];
  overall_score?: number;
  should_rewrite?: boolean;
}
