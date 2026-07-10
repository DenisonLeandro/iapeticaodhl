import { useState } from "react";
import { Sparkles, Loader2, ShieldAlert, Copy } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { supabase } from "@/lib/backend/client";
import { withInflight } from "@/lib/ai/inflight-guard";
import ConfirmAICostDialog from "@/components/ai/ConfirmAICostDialog";
import type { CaseDraft } from "@/types/caseDraft";

interface Finding {
  severidade: "risco_alto" | "atencao" | "pendencia_documental" | "sugestao_estrategica" | string;
  topico: string;
  motivo: string;
  sugestao: string;
}

interface Props {
  draft: CaseDraft;
  onRefresh: () => void;
}

export default function SeniorReviewPanel({ draft, onRefresh }: Props) {
  const [running, setRunning] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [highPrecision, setHighPrecision] = useState(false);
  const review = (draft as unknown as { senior_review?: SeniorReview | null }).senior_review;
  const status = (draft as unknown as { senior_review_status?: string | null }).senior_review_status;
  const qualityFindings: Finding[] = Array.isArray(draft.quality_report?.findings)
    ? (draft.quality_report!.findings as Finding[])
    : [];

  const doRun = async () => {
    setRunning(true);
    try {
      const result = await withInflight(`senior-legal-review:${draft.id}`, async () => {
        return supabase.functions.invoke("senior-legal-review", {
          body: { draft_id: draft.id, high_precision: highPrecision },
        });
      });
      const { data, error } = result;
      if (error) throw new Error("Não foi possível concluir a revisão sênior. Tente novamente em instantes.");
      if (data?.status === "failed") {
        throw new Error("Não foi possível concluir a revisão sênior. Tente novamente em instantes.");
      }
      if (data?.structured_ok === false) {
        toast.warning(
          "A revisão foi concluída, mas as sugestões automáticas não puderam ser estruturadas. A análise em texto continua disponível.",
        );
      } else {
        toast.success("Revisão sênior concluída.");
      }
      onRefresh();
    } catch (e) {
      toast.error((e as Error).message || "Não foi possível concluir a revisão sênior.");
    } finally {
      setRunning(false);
    }
  };

  const handleRun = () => setConfirmOpen(true);

  return (
    <Card className="p-4">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <ShieldAlert className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">Revisor jurídico sênior</h3>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <input
              type="checkbox"
              className="h-3 w-3"
              checked={highPrecision}
              onChange={(e) => setHighPrecision(e.target.checked)}
              disabled={running}
            />
            Alta precisão (modelo forte)
          </label>
          <Button size="sm" variant="outline" onClick={handleRun} disabled={running}>
            {running || status === "running" ? (
              <><Loader2 className="mr-1 h-3 w-3 animate-spin" /> Revisando…</>
            ) : (
              <><Sparkles className="mr-1 h-3 w-3" /> Revisar como advogado sênior</>
            )}
          </Button>
        </div>
      </div>

      {qualityFindings.length > 0 && (
        <div className="mb-3 space-y-2">
          <div className="text-[11px] font-semibold uppercase text-muted-foreground">
            Achados da revisão automática
          </div>
          <FindingsList findings={qualityFindings} />
        </div>
      )}

      {!review && status !== "running" && qualityFindings.length === 0 && (
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
          {typeof (review as unknown as { senior_review?: unknown }).senior_review === "string" && (
            <div className="whitespace-pre-wrap rounded-md border border-border/60 bg-muted/30 p-2 text-xs leading-relaxed">
              {(review as unknown as { senior_review: string }).senior_review}
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
      <ConfirmAICostDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Executar Revisão Sênior?"
        description="A Revisão Sênior faz uma análise crítica da minuta com IA. Deseja continuar?"
        estimatedCalls={1}
        model="gemini-2.5-pro"
        costLevel="Alto"
        confirmLabel="Executar revisão"
        onConfirm={() => { setConfirmOpen(false); void doRun(); }}
      />
    </Card>
  );
}

const SEVERITY_STYLE: Record<string, string> = {
  risco_alto: "border-red-500/50 bg-red-500/10 text-red-800 dark:text-red-200",
  atencao: "border-amber-500/50 bg-amber-500/10 text-amber-800 dark:text-amber-200",
  pendencia_documental: "border-blue-500/50 bg-blue-500/10 text-blue-800 dark:text-blue-200",
  sugestao_estrategica: "border-primary/50 bg-primary/5 text-primary",
};
const SEVERITY_LABEL: Record<string, string> = {
  risco_alto: "Risco alto",
  atencao: "Atenção",
  pendencia_documental: "Pendência documental",
  sugestao_estrategica: "Sugestão estratégica",
};

function FindingsList({ findings }: { findings: Finding[] }) {
  const order = ["risco_alto", "atencao", "pendencia_documental", "sugestao_estrategica"];
  const sorted = [...findings].sort(
    (a, b) => (order.indexOf(a.severidade) + 1 || 99) - (order.indexOf(b.severidade) + 1 || 99),
  );
  return (
    <ul className="space-y-2">
      {sorted.map((f, i) => (
        <li key={i} className={`rounded-md border p-2 text-xs ${SEVERITY_STYLE[f.severidade] ?? "border-border"}`}>
          <div className="mb-1 flex items-center justify-between gap-2">
            <span className="rounded bg-background/60 px-1.5 py-0.5 text-[10px] font-semibold uppercase">
              {SEVERITY_LABEL[f.severidade] ?? f.severidade}
            </span>
            <span className="truncate text-[11px] font-medium">{f.topico}</span>
          </div>
          <div className="mb-1"><strong>Motivo: </strong>{f.motivo}</div>
          {f.sugestao && (
            <div>
              <div className="mb-1"><strong>Sugestão pronta: </strong></div>
              <div className="mb-1 whitespace-pre-wrap rounded bg-background/60 p-2 font-mono text-[11px]">{f.sugestao}</div>
              <Button
                size="sm"
                variant="ghost"
                className="h-6 px-2 text-[11px]"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(f.sugestao);
                    toast.success("Sugestão copiada.");
                  } catch { toast.error("Falha ao copiar."); }
                }}
              >
                <Copy className="mr-1 h-3 w-3" /> Copiar sugestão
              </Button>
            </div>
          )}
        </li>
      ))}
    </ul>
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
  senior_review?: string;
  recommendation?: string;
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
