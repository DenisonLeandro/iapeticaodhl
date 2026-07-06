// =============================================================================
// PR-2 — Tela de planejamento por capítulos (esqueleto)
// Mostra as sections criadas por plan-draft-chapters. Sem geração/edição.
// =============================================================================
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, FileText, Info, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useCaseDraft } from "@/hooks/useCaseDrafts";
import { useCaseDraftSections } from "@/hooks/useCaseDraftSections";
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

export default function DraftChaptersPlanPage() {
  const { id: caseId, draftId } = useParams<{ id: string; draftId: string }>();
  const navigate = useNavigate();
  const { data: draft, isLoading: draftLoading } = useCaseDraft(draftId);
  const { data: sections = [], isLoading: sectionsLoading } = useCaseDraftSections(draftId);

  if (draftLoading || !draft) {
    return <Skeleton className="h-96 w-full" />;
  }

  // Se abriu /chapters de um draft que não é do modo capítulos, envia para o detalhe padrão.
  if (draft.generation_mode !== "chapters") {
    return <Navigate to={`/cases/${caseId}/drafts/${draftId}`} replace />;
  }

  const generatedCount = sections.filter((s: CaseDraftSection) =>
    ["generated", "edited", "approved"].includes(s.status)
  ).length;
  const totalCount = sections.length;

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
            <p className="font-medium">Estrutura criada pela IA. Revise os capítulos antes de gerar o conteúdo.</p>
            <p className="mt-1 text-muted-foreground">
              Cada capítulo será redigido individualmente e depois combinado em uma peça final.
              A geração e a montagem ficam disponíveis no próximo PR.
            </p>
          </div>
        </Card>

        <Card className="p-4">
          <div className="mb-3 flex items-center justify-between">
            <div className="text-sm font-medium">
              {generatedCount} de {totalCount} capítulos gerados
            </div>
            <Tooltip>
              <TooltipTrigger asChild>
                <span>
                  <Button size="sm" disabled>
                    Gerar capítulos (em breve)
                  </Button>
                </span>
              </TooltipTrigger>
              <TooltipContent>Disponível no próximo PR.</TooltipContent>
            </Tooltip>
          </div>

          {sectionsLoading ? (
            <Skeleton className="h-40 w-full" />
          ) : sections.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhum capítulo planejado ainda para esta minuta.
            </p>
          ) : (
            <ul className="divide-y">
              {sections.map((s: CaseDraftSection, idx: number) => {
                const hint = (s.quality_notes as { hint?: string } | null)?.hint;
                return (
                  <li key={s.id} className="flex items-start justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">{String(idx + 1).padStart(2, "0")}</span>
                        <span className="font-medium">{s.section_label}</span>
                        <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                          {s.section_key}
                        </span>
                      </div>
                      {hint && (
                        <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
                      )}
                    </div>
                    <div>{statusBadge(String(s.status))}</div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>
    </TooltipProvider>
  );
}
