// =============================================================================
// CaseAnalysisPanel — PR-4.1A
// Exibe a análise inicial estruturada. Sem termos técnicos para o advogado.
// =============================================================================

import { useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardCopy,
  FileSearch,
  FileText,
  Loader2,
  MessageSquare,
  RefreshCw,
  Sparkles,
  Target,
  TriangleAlert,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import type { CaseAnalysis } from "@/services/caseAnalysis";

interface Props {
  analysis: CaseAnalysis | null;
  isLoading: boolean;
  isRunning: boolean;
  onGenerate: () => void;
  onRegenerate: () => void;
}

function confidenceBadge(level: string) {
  const l = (level || "").toLowerCase();
  if (l.startsWith("alt")) return { label: "Confiança alta", cls: "bg-green-600 text-white" };
  if (l.startsWith("méd") || l.startsWith("med"))
    return { label: "Confiança média", cls: "bg-yellow-500 text-black" };
  return { label: "Confiança baixa", cls: "bg-gray-500 text-white" };
}

function ListCard({
  title,
  icon: Icon,
  items,
  emptyText,
  tone = "default",
}: {
  title: string;
  icon: typeof FileText;
  items: string[];
  emptyText: string;
  tone?: "default" | "positive" | "warning";
}) {
  const toneCls =
    tone === "positive"
      ? "text-green-600"
      : tone === "warning"
        ? "text-amber-600"
        : "text-primary";
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="mb-3 flex items-center gap-2">
        <Icon className={`h-4 w-4 ${toneCls}`} />
        <h3 className="font-display text-sm font-semibold">{title}</h3>
      </div>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">{emptyText}</p>
      ) : (
        <ul className="space-y-2">
          {items.map((it, i) => (
            <li key={i} className="flex gap-2 text-sm leading-relaxed">
              <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${toneCls === "text-green-600" ? "bg-green-600" : toneCls === "text-amber-600" ? "bg-amber-600" : "bg-primary"}`} />
              <span className="text-foreground/90">{it}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function buildClipboard(a: CaseAnalysis): string {
  const c = a.content_json;
  const sec = (title: string, body: string | string[]) => {
    const text = Array.isArray(body) ? body.map((x) => `- ${x}`).join("\n") : body;
    if (!text || (Array.isArray(body) && body.length === 0)) return "";
    return `## ${title}\n${text}\n`;
  };
  return [
    "# Análise inicial do caso",
    sec("Resumo", c.summary),
    sec("Tipo de demanda", c.case_type),
    sec("Parte representada", c.represented_party),
    sec("Fatos", c.facts),
    sec("Pontos fortes", c.strengths),
    sec("Riscos", c.risks),
    sec("Documentos relevantes", c.relevant_documents),
    sec("Documentos faltantes", c.missing_documents),
    sec("Teses jurídicas", c.legal_theories),
    sec("Próxima ação", c.next_action),
    sec("Peça recomendada", c.recommended_piece),
    sec("Nível de confiança", c.confidence_level),
    sec("Observações para revisão", c.human_review_notes),
  ]
    .filter(Boolean)
    .join("\n");
}

export default function CaseAnalysisPanel({
  analysis,
  isLoading,
  isRunning,
  onGenerate,
  onRegenerate,
}: Props) {
  const [copying, setCopying] = useState(false);

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-32 w-full" />
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <Skeleton className="h-40" />
          <Skeleton className="h-40" />
        </div>
      </div>
    );
  }

  if (isRunning && !analysis) {
    return (
      <div className="rounded-xl border border-dashed border-primary/40 bg-primary/5 p-8 text-center">
        <Loader2 className="mx-auto mb-2 h-6 w-6 animate-spin text-primary" />
        <p className="text-sm font-medium text-foreground">Gerando análise inicial…</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Isso pode levar alguns segundos. Você pode continuar usando o sistema.
        </p>
      </div>
    );
  }

  if (!analysis) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-muted/20 p-8 text-center">
        <Sparkles className="mx-auto mb-2 h-6 w-6 text-primary" />
        <p className="text-sm font-medium text-foreground">Nenhuma análise gerada ainda.</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Clique em &quot;Analisar Caso&quot; acima para gerar a primeira análise.
        </p>
      </div>
    );
  }

  if (analysis.status === "failed") {
    return (
      <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-6">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 text-destructive" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-destructive">A análise não pôde ser concluída.</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Tente novamente. Se o erro persistir, contate o suporte.
            </p>
            <Button size="sm" className="mt-3" onClick={onRegenerate} disabled={isRunning}>
              <RefreshCw className="mr-2 h-3.5 w-3.5" /> Tentar novamente
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (analysis.status === "running") {
    return (
      <div className="rounded-xl border border-dashed border-primary/40 bg-primary/5 p-8 text-center">
        <Loader2 className="mx-auto mb-2 h-6 w-6 animate-spin text-primary" />
        <p className="text-sm font-medium text-foreground">Análise em andamento…</p>
      </div>
    );
  }

  const c = analysis.content_json;
  const conf = confidenceBadge(c.confidence_level);
  const meta = analysis.metadata as { limitation?: boolean; strategy?: string } | undefined;

  const copy = async () => {
    setCopying(true);
    try {
      await navigator.clipboard.writeText(buildClipboard(analysis));
      toast.success("Análise copiada.");
    } catch {
      toast.error("Não foi possível copiar.");
    } finally {
      setCopying(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-display text-lg font-semibold text-foreground">Análise inicial do caso</h2>
            <Badge className={`${conf.cls} border-transparent`}>{conf.label}</Badge>
            {c.case_type && (
              <Badge variant="outline" className="border-border">
                {c.case_type}
              </Badge>
            )}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Atualizada em {new Date(analysis.updated_at).toLocaleString("pt-BR")}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={onRegenerate} disabled={isRunning}>
            {isRunning ? (
              <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-3.5 w-3.5" />
            )}
            Reanalisar
          </Button>
          <Button size="sm" variant="outline" onClick={copy} disabled={copying}>
            <ClipboardCopy className="mr-2 h-3.5 w-3.5" />
            Copiar
          </Button>
          <Button size="sm" variant="ghost" disabled title="Em breve">
            <MessageSquare className="mr-2 h-3.5 w-3.5" />
            Conversar sobre esta análise
          </Button>
        </div>
      </div>

      {meta?.limitation && (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-800 dark:text-amber-300">
          <AlertTriangle className="mr-2 inline h-4 w-4" />
          Os documentos foram identificados, mas ainda não há texto extraído suficiente para uma
          análise completa. Esta é uma análise preliminar.
        </div>
      )}

      {/* Resumo */}
      {c.summary && (
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="mb-2 flex items-center gap-2">
            <FileSearch className="h-4 w-4 text-primary" />
            <h3 className="font-display text-sm font-semibold">Resumo</h3>
          </div>
          <p className="whitespace-pre-line text-sm leading-relaxed text-foreground/90">
            {c.summary}
          </p>
        </div>
      )}

      {/* Próxima ação + Peça recomendada */}
      {(c.next_action || c.recommended_piece) && (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {c.next_action && (
            <div className="rounded-xl border border-primary/40 bg-primary/5 p-5">
              <div className="mb-2 flex items-center gap-2">
                <Target className="h-4 w-4 text-primary" />
                <h3 className="font-display text-sm font-semibold">Próxima ação sugerida</h3>
              </div>
              <p className="text-sm leading-relaxed text-foreground/90">{c.next_action}</p>
            </div>
          )}
          {c.recommended_piece && (
            <div className="rounded-xl border border-border bg-card p-5">
              <div className="mb-2 flex items-center gap-2">
                <FileText className="h-4 w-4 text-primary" />
                <h3 className="font-display text-sm font-semibold">Peça recomendada</h3>
              </div>
              <p className="text-sm leading-relaxed text-foreground/90">{c.recommended_piece}</p>
            </div>
          )}
        </div>
      )}

      {/* Listas */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <ListCard
          title="Fatos relevantes"
          icon={FileText}
          items={c.facts}
          emptyText="Sem fatos consolidados."
        />
        <ListCard
          title="Teses jurídicas"
          icon={Sparkles}
          items={c.legal_theories}
          emptyText="Sem teses sugeridas ainda."
        />
        <ListCard
          title="Pontos fortes"
          icon={CheckCircle2}
          items={c.strengths}
          emptyText="Sem pontos fortes identificados."
          tone="positive"
        />
        <ListCard
          title="Riscos"
          icon={TriangleAlert}
          items={c.risks}
          emptyText="Sem riscos relevantes apontados."
          tone="warning"
        />
        <ListCard
          title="Documentos relevantes"
          icon={FileText}
          items={c.relevant_documents}
          emptyText="Sem documentos destacados."
        />
        <ListCard
          title="Documentos faltantes"
          icon={AlertTriangle}
          items={c.missing_documents}
          emptyText="Sem lacunas identificadas."
          tone="warning"
        />
      </div>

      {c.human_review_notes.length > 0 && (
        <div className="rounded-xl border border-dashed border-border bg-muted/20 p-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Observações para revisão humana
          </p>
          <ul className="space-y-1 text-sm text-foreground/80">
            {c.human_review_notes.map((n, i) => (
              <li key={i}>• {n}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
