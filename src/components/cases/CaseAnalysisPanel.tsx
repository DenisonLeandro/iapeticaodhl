// =============================================================================
// CaseAnalysisPanel — PR-4.1A.1
// Refinamento visual: Conclusão estratégica no topo, ordem orientada à decisão,
// checklist de documentos faltantes, fontes recolhidas e botão Copiar enriquecido.
// =============================================================================

import { useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ClipboardCopy,
  Compass,
  FileSearch,
  FileText,
  Loader2,
  MessageSquare,
  RefreshCw,
  Sparkles,
  Square,
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

const FALLBACK = "Não identificado na análise.";

function normalizeLevel(level: string): "alta" | "media" | "baixa" | "indef" {
  const l = (level || "").toLowerCase();
  if (l.startsWith("alt")) return "alta";
  if (l.startsWith("méd") || l.startsWith("med")) return "media";
  if (l.startsWith("baix") || l.startsWith("low")) return "baixa";
  return "indef";
}

function confidenceBadge(level: string) {
  const n = normalizeLevel(level);
  if (n === "alta") return { label: "Confiança alta", cls: "bg-emerald-600 text-white" };
  if (n === "media") return { label: "Confiança média", cls: "bg-amber-500 text-black" };
  if (n === "baixa") return { label: "Confiança baixa", cls: "bg-muted text-muted-foreground" };
  return { label: "Confiança não definida", cls: "bg-muted text-muted-foreground" };
}

function viabilityFromConfidence(level: string): { label: string; tone: "pos" | "warn" | "neg" | "neutral" } {
  const n = normalizeLevel(level);
  if (n === "alta") return { label: "Alta", tone: "pos" };
  if (n === "media") return { label: "Média", tone: "warn" };
  if (n === "baixa") return { label: "Baixa", tone: "neg" };
  return { label: FALLBACK, tone: "neutral" };
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
      ? "text-emerald-600"
      : tone === "warning"
        ? "text-amber-600"
        : "text-primary";
  const dotCls =
    tone === "positive" ? "bg-emerald-600" : tone === "warning" ? "bg-amber-600" : "bg-primary";
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="mb-3 flex items-center gap-2">
        <Icon className={`h-4 w-4 ${toneCls}`} />
        <h3 className="font-display text-sm font-semibold">{title}</h3>
      </div>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">{emptyText}</p>
      ) : (
        <ul className="space-y-2.5">
          {items.map((it, i) => (
            <li key={i} className="flex gap-2 text-sm leading-relaxed">
              <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${dotCls}`} />
              <span className="text-foreground/90">{it}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function MissingDocsCard({ items }: { items: string[] }) {
  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="mb-3 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <h3 className="font-display text-sm font-semibold">Documentos faltantes</h3>
        </div>
        <p className="text-sm text-muted-foreground">
          Nenhum documento faltante essencial foi identificado nesta análise preliminar.
        </p>
      </div>
    );
  }
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="mb-3 flex items-center gap-2">
        <AlertTriangle className="h-4 w-4 text-amber-600" />
        <h3 className="font-display text-sm font-semibold">Documentos faltantes</h3>
      </div>
      <ul className="space-y-2.5">
        {items.map((it, i) => (
          <li key={i} className="flex items-start gap-2 text-sm leading-relaxed">
            <Square className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
            <span className="text-foreground/90">{it}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

interface SourceItem {
  file_name?: string;
  file_id?: string;
  page_number?: number | string;
  document_type?: string;
  classification?: string;
}

function SourcesBlock({ sources }: { sources: SourceItem[] }) {
  const [open, setOpen] = useState(false);
  if (!sources || sources.length === 0) return null;
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <Button
        variant="ghost"
        size="sm"
        className="h-auto px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
        onClick={() => setOpen((v) => !v)}
      >
        <FileText className="mr-2 h-3.5 w-3.5" />
        {open ? `Ocultar fontes (${sources.length})` : `Ver fontes consideradas (${sources.length})`}
        {open ? <ChevronUp className="ml-1 h-3.5 w-3.5" /> : <ChevronDown className="ml-1 h-3.5 w-3.5" />}
      </Button>
      {open && (
        <ul className="mt-3 space-y-1.5 text-xs">
          {sources.map((s, i) => {
            const name = s.file_name || s.file_id || `Fonte ${i + 1}`;
            const tag = s.document_type || s.classification;
            return (
              <li key={i} className="flex flex-wrap items-center gap-2 rounded border border-border/60 bg-muted/30 px-2 py-1.5">
                <FileText className="h-3 w-3 text-muted-foreground" />
                <span className="font-medium text-foreground/90">{name}</span>
                {s.page_number !== undefined && s.page_number !== null && (
                  <Badge variant="outline" className="border-border text-[10px]">
                    pág. {String(s.page_number)}
                  </Badge>
                )}
                {tag && (
                  <Badge variant="outline" className="border-border text-[10px]">
                    {tag}
                  </Badge>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function buildClipboard(a: CaseAnalysis): string {
  const c = a.content_json;
  const v = viabilityFromConfidence(c.confidence_level);
  const sec = (title: string, body: string | string[]) => {
    if (Array.isArray(body)) {
      if (body.length === 0) return "";
      return `## ${title}\n${body.map((x) => `- ${x}`).join("\n")}\n`;
    }
    if (!body) return "";
    return `## ${title}\n${body}\n`;
  };
  const conclusao =
    `## Conclusão estratégica\n` +
    `- Viabilidade: ${v.label}\n` +
    `- Próxima providência: ${c.next_action || FALLBACK}\n` +
    `- Peça recomendada: ${c.recommended_piece || FALLBACK}\n` +
    `- Nível de confiança: ${c.confidence_level || FALLBACK}\n`;
  return [
    "# Análise inicial do caso",
    conclusao,
    sec("Resumo", c.summary),
    sec("Próxima ação sugerida", c.next_action),
    sec("Peça recomendada", c.recommended_piece),
    sec("Pontos fortes", c.strengths),
    sec("Riscos", c.risks),
    sec("Fatos relevantes", c.facts),
    sec("Teses jurídicas", c.legal_theories),
    sec("Documentos relevantes", c.relevant_documents),
    sec("Documentos faltantes", c.missing_documents),
    sec("Observações para revisão humana", c.human_review_notes),
  ]
    .filter(Boolean)
    .join("\n");
}

function StrategyRow({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string;
  tone?: "pos" | "warn" | "neg" | "neutral";
}) {
  const toneCls =
    tone === "pos"
      ? "text-emerald-700 dark:text-emerald-400"
      : tone === "warn"
        ? "text-amber-700 dark:text-amber-400"
        : tone === "neg"
          ? "text-red-700 dark:text-red-400"
          : "text-foreground/90";
  return (
    <div className="min-w-0">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className={`mt-1 text-sm leading-snug ${toneCls}`}>{value}</p>
    </div>
  );
}

export default function CaseAnalysisPanel({
  analysis,
  isLoading,
  isRunning,
  onGenerate: _onGenerate,
  onRegenerate,
}: Props) {
  const [copying, setCopying] = useState(false);

  const sources = useMemo<SourceItem[]>(() => {
    const meta = (analysis?.metadata ?? {}) as { sources?: unknown };
    return Array.isArray(meta.sources) ? (meta.sources as SourceItem[]) : [];
  }, [analysis]);

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
  const viab = viabilityFromConfidence(c.confidence_level);
  const meta = analysis.metadata as { limitation?: boolean } | undefined;

  const copy = async () => {
    setCopying(true);
    try {
      await navigator.clipboard.writeText(buildClipboard(analysis));
      toast.success("Análise copiada para a área de transferência.");
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
            <h2 className="font-display text-lg font-semibold text-foreground">
              Análise inicial do caso
            </h2>
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
          <Button size="sm" variant="ghost" disabled title="Disponível em próxima etapa.">
            <MessageSquare className="mr-2 h-3.5 w-3.5" />
            Conversar sobre esta análise — em breve
          </Button>
        </div>
      </div>

      {meta?.limitation && (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-800 dark:text-amber-300">
          <AlertTriangle className="mr-2 inline h-4 w-4" />
          Análise preliminar: ainda não há documentos/texto suficiente para conclusão completa.
        </div>
      )}

      {/* Conclusão estratégica */}
      <div className="rounded-xl border border-primary/40 bg-primary/5 p-5">
        <div className="mb-3 flex items-center gap-2">
          <Compass className="h-4 w-4 text-primary" />
          <h3 className="font-display text-sm font-semibold">Conclusão estratégica</h3>
        </div>
        <div className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
          <StrategyRow label="Viabilidade" value={viab.label} tone={viab.tone} />
          <StrategyRow
            label="Próxima providência"
            value={c.next_action || FALLBACK}
            tone={c.next_action ? "neutral" : "neutral"}
          />
          <StrategyRow
            label="Peça recomendada"
            value={c.recommended_piece || FALLBACK}
          />
          <StrategyRow
            label="Nível de confiança"
            value={c.confidence_level || FALLBACK}
          />
        </div>
      </div>

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

      {/* Listas — ordem orientada à decisão */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
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
          title="Documentos relevantes"
          icon={FileText}
          items={c.relevant_documents}
          emptyText="Sem documentos destacados."
        />
        <MissingDocsCard items={c.missing_documents} />
      </div>

      {c.human_review_notes.length > 0 && (
        <div className="rounded-xl border border-dashed border-border bg-muted/20 p-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Observações para revisão humana
          </p>
          <ul className="space-y-1.5 text-sm text-foreground/80">
            {c.human_review_notes.map((n, i) => (
              <li key={i} className="flex gap-2">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-muted-foreground" />
                <span>{n}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <SourcesBlock sources={sources} />
    </div>
  );
}
