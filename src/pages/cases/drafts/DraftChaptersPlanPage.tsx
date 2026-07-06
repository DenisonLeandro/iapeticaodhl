// =============================================================================
// PR-2 + PR-3 — Tela de planejamento por capítulos
// PR-3: gerar conteúdo por seção (individual e em lote), com visualização.
// Sem edição manual e sem montagem final (próximo PR).
// =============================================================================
import { useMemo, useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import {
  AlertCircle,
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  Copy,
  FileText,
  Info,
  Loader2,
  RefreshCw,
  Sparkles,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
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
import { toast } from "sonner";

import { useCaseDraft } from "@/hooks/useCaseDrafts";
import { useCaseDraftSections } from "@/hooks/useCaseDraftSections";
import { useGenerateDraftSection } from "@/hooks/useCaseDrafts";
import type { CaseDraftSection } from "@/types/caseDraft";

function statusBadge(status: string) {
  const map: Record<string, { label: string; variant: "secondary" | "outline" | "default" | "destructive" }> = {
    pending: { label: "Pendente", variant: "secondary" },
    generating: { label: "Gerando…", variant: "outline" },
    generated: { label: "Gerado", variant: "default" },
    edited: { label: "Editado", variant: "default" },
    approved: { label: "Aprovado", variant: "default" },
    skipped: { label: "Ignorado", variant: "outline" },
    failed: { label: "Falha", variant: "destructive" },
  };
  const item = map[status] ?? { label: status, variant: "outline" as const };
  return <Badge variant={item.variant}>{item.label}</Badge>;
}

const OBRIGATORIAS = new Set(["generated", "approved", "skipped", "edited"]);

export default function DraftChaptersPlanPage() {
  const { id: caseId, draftId } = useParams<{ id: string; draftId: string }>();
  const navigate = useNavigate();
  const { data: draft, isLoading: draftLoading } = useCaseDraft(draftId);
  const { data: sections = [], isLoading: sectionsLoading } = useCaseDraftSections(draftId);
  const generateSection = useGenerateDraftSection();

  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [runningKeys, setRunningKeys] = useState<Set<string>>(new Set());
  const [batchProgress, setBatchProgress] = useState<{ done: number; total: number } | null>(null);
  const [confirmRegen, setConfirmRegen] = useState<CaseDraftSection | null>(null);

  const allDone = useMemo(
    () => sections.length > 0 && sections.every((s) => OBRIGATORIAS.has(String(s.status))),
    [sections],
  );

  if (draftLoading || !draft) {
    return <Skeleton className="h-96 w-full" />;
  }
  if (draft.generation_mode !== "chapters") {
    return <Navigate to={`/cases/${caseId}/drafts/${draftId}`} replace />;
  }

  const generatedCount = sections.filter((s) => OBRIGATORIAS.has(String(s.status))).length;
  const totalCount = sections.length;

  async function runSection(section: CaseDraftSection, force = false) {
    setRunningKeys((prev) => new Set(prev).add(section.id));
    try {
      await generateSection.mutateAsync({
        draft_id: section.draft_id,
        section_id: section.id,
        force_regenerate: force,
      });
    } catch (e) {
      toast.error(`Falha ao gerar "${section.section_label}": ${(e as Error).message}`);
    } finally {
      setRunningKeys((prev) => {
        const next = new Set(prev);
        next.delete(section.id);
        return next;
      });
    }
  }

  async function runAllPending() {
    const pending = sections.filter((s) => s.status === "pending" || s.status === "failed");
    if (pending.length === 0) {
      toast.info("Não há capítulos pendentes.");
      return;
    }
    setBatchProgress({ done: 0, total: pending.length });
    let done = 0;
    for (const s of pending) {
      // Sequencial para evitar timeout/custo. Falha de uma não interrompe as demais.
      // eslint-disable-next-line no-await-in-loop
      await runSection(s, false).catch(() => { /* já tostado */ });
      done += 1;
      setBatchProgress({ done, total: pending.length });
    }
    setBatchProgress(null);
    toast.success("Geração de capítulos concluída.");
  }

  function copyContent(s: CaseDraftSection) {
    const text = s.content ?? "";
    navigator.clipboard.writeText(text).then(
      () => toast.success("Conteúdo copiado."),
      () => toast.error("Não foi possível copiar."),
    );
  }

  return (
    <TooltipProvider>
      <div className="space-y-6">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink asChild><Link to="/cases">Processos</Link></BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink asChild><Link to={`/cases/${caseId}`}>Caso</Link></BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>Estrutura por capítulos</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h1 className="font-display text-2xl font-bold">Estrutura da petição por capítulos</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {draft.title ?? "Petição inicial (por capítulos)"}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => navigate(`/cases/${caseId}`)}>
              <ArrowLeft className="mr-1 h-4 w-4" /> Voltar para o caso
            </Button>
            <Button variant="outline" size="sm" onClick={() => navigate(`/cases/${caseId}?tab=drafts`)}>
              <FileText className="mr-1 h-4 w-4" /> Ver minutas
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate(`/cases/${caseId}/drafts/new`)}
            >
              <Sparkles className="mr-1 h-4 w-4" /> Gerar petição completa (modo rápido)
            </Button>
          </div>
        </div>

        <Card className="flex items-start gap-3 p-4">
          <Info className="mt-0.5 h-4 w-4 text-primary" />
          <div className="text-sm">
            <p className="font-medium">
              Cada capítulo é redigido individualmente pela IA. A montagem final da petição fica para o próximo PR.
            </p>
            <p className="mt-1 text-muted-foreground">
              O conteúdo salvo aqui não altera a minuta principal até a etapa de montagem.
            </p>
          </div>
        </Card>

        <Card className="p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm font-medium">
              {generatedCount} de {totalCount} capítulos gerados
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                onClick={runAllPending}
                disabled={!!batchProgress || sections.length === 0}
              >
                {batchProgress ? (
                  <><Loader2 className="mr-1 h-4 w-4 animate-spin" /> Gerando {batchProgress.done + 1} de {batchProgress.total}…</>
                ) : (
                  <><Sparkles className="mr-1 h-4 w-4" /> Gerar capítulos</>
                )}
              </Button>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span>
                    <Button size="sm" variant="outline" disabled>
                      Montar petição final — próximo PR
                    </Button>
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  {allDone
                    ? "Todos os capítulos estão prontos. A montagem chega no próximo PR."
                    : "Gere todos os capítulos primeiro. A montagem chega no próximo PR."}
                </TooltipContent>
              </Tooltip>
            </div>
          </div>

          {batchProgress && (
            <div className="mb-4">
              <Progress value={(batchProgress.done / batchProgress.total) * 100} />
            </div>
          )}

          {sectionsLoading ? (
            <Skeleton className="h-40 w-full" />
          ) : sections.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhum capítulo planejado ainda para esta minuta.
            </p>
          ) : (
            <ul className="divide-y">
              {sections.map((s, idx) => {
                const hint = (s.quality_notes as { hint?: string } | null)?.hint;
                const isOpen = !!expanded[s.id];
                const isRunning = runningKeys.has(s.id) || s.status === "generating";
                const canView = !!s.content && s.content.length > 0;
                const status = String(s.status);

                return (
                  <li key={s.id} className="py-3">
                    <div className="flex items-start justify-between gap-3">
                      <button
                        type="button"
                        onClick={() => setExpanded((p) => ({ ...p, [s.id]: !p[s.id] }))}
                        className="flex min-w-0 flex-1 items-start gap-2 text-left"
                      >
                        {isOpen ? <ChevronDown className="mt-1 h-4 w-4 shrink-0" /> : <ChevronRight className="mt-1 h-4 w-4 shrink-0" />}
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-xs text-muted-foreground">{String(idx + 1).padStart(2, "0")}</span>
                            <span className="font-medium">{s.section_label}</span>
                            <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                              {s.section_key}
                            </span>
                          </div>
                          {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
                          {s.last_error && status === "failed" && (
                            <p className="mt-1 flex items-start gap-1 text-xs text-destructive">
                              <AlertCircle className="mt-0.5 h-3 w-3 shrink-0" />
                              <span className="break-all">{s.last_error}</span>
                            </p>
                          )}
                        </div>
                      </button>
                      <div className="flex flex-col items-end gap-2">
                        {statusBadge(status)}
                        <div className="flex flex-wrap justify-end gap-1">
                          {status === "pending" && (
                            <Button size="sm" variant="secondary" disabled={isRunning || !!batchProgress} onClick={() => runSection(s)}>
                              {isRunning ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Sparkles className="mr-1 h-3 w-3" />}
                              Gerar capítulo
                            </Button>
                          )}
                          {status === "failed" && (
                            <Button size="sm" variant="secondary" disabled={isRunning || !!batchProgress} onClick={() => runSection(s, true)}>
                              {isRunning ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <RefreshCw className="mr-1 h-3 w-3" />}
                              Tentar novamente
                            </Button>
                          )}
                          {(status === "generated" || status === "edited" || status === "approved" || status === "skipped") && (
                            <Button size="sm" variant="outline" disabled={isRunning || !!batchProgress} onClick={() => setConfirmRegen(s)}>
                              <RefreshCw className="mr-1 h-3 w-3" /> Regenerar
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>

                    {isOpen && (
                      <div className="mt-3 ml-6 rounded-md border bg-muted/30 p-3">
                        {canView ? (
                          <>
                            <div className="mb-2 flex justify-end">
                              <Button size="sm" variant="ghost" onClick={() => copyContent(s)}>
                                <Copy className="mr-1 h-3 w-3" /> Copiar
                              </Button>
                            </div>
                            <pre className="whitespace-pre-wrap break-words font-sans text-sm leading-relaxed text-foreground">
                              {s.content}
                            </pre>
                          </>
                        ) : status === "skipped" ? (
                          <p className="text-xs text-muted-foreground">
                            A IA identificou que esta seção não é aplicável a este caso.
                          </p>
                        ) : (
                          <p className="text-xs text-muted-foreground">
                            Nenhum conteúdo gerado ainda para este capítulo.
                          </p>
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>

      <AlertDialog open={!!confirmRegen} onOpenChange={(open) => !open && setConfirmRegen(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Regenerar capítulo?</AlertDialogTitle>
            <AlertDialogDescription>
              Este capítulo será gerado novamente e o texto atual será substituído. Deseja continuar?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                const target = confirmRegen;
                setConfirmRegen(null);
                if (target) void runSection(target, true);
              }}
            >
              Regenerar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </TooltipProvider>
  );
}
