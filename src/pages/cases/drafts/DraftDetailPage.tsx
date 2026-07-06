import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Archive, Copy, Eye, Loader2, MoreHorizontal, Pencil, RefreshCw, Save, ShieldAlert, ShieldCheck, Sparkles } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
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
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import {
  useArchiveDraft,
  useCaseDraft,
  useReviewDraft,
  useUpdateDraft,
} from "@/hooks/useCaseDrafts";
import DraftSourcesBadges from "@/components/cases/drafts/DraftSourcesBadges";
import DraftWarningsList from "@/components/cases/drafts/DraftWarningsList";
import CalculationsPanel from "@/components/cases/drafts/CalculationsPanel";
import SeniorReviewPanel from "@/components/cases/drafts/SeniorReviewPanel";
import PendingCountBadge from "@/components/cases/drafts/PendingCountBadge";
import DraftContentPreview from "@/components/cases/drafts/DraftContentPreview";
import { useQueryClient } from "@tanstack/react-query";
import PlaybookCompliancePanel from "@/components/cases/drafts/PlaybookCompliancePanel";
import SeniorReviewSuggestionsPanel from "@/components/cases/drafts/SeniorReviewSuggestionsPanel";
import DraftVersionsPanel from "@/components/cases/drafts/DraftVersionsPanel";
import { CASE_DRAFT_TYPE_LABEL, type CaseDraftType } from "@/types/caseDraft";



export default function DraftDetailPage() {
  const { id: caseId, draftId } = useParams<{ id: string; draftId: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: draft, isLoading } = useCaseDraft(draftId);

  const update = useUpdateDraft();
  const archive = useArchiveDraft();
  const review = useReviewDraft();

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [dirty, setDirty] = useState(false);
  const [confirmRegen, setConfirmRegen] = useState(false);
  const [reviewStartedAt, setReviewStartedAt] = useState<number | null>(null);
  const [reviewTimedOut, setReviewTimedOut] = useState(false);
  const [showPreview, setShowPreview] = useState(true);

  useEffect(() => {
    if (draft) {
      setTitle(draft.title ?? "");
      setContent(draft.content ?? "");
      setDirty(false);
    }
  }, [draft?.id]);

  // Timeout de polling: 3 minutos
  useEffect(() => {
    const st = draft?.quality_status;
    if (st === "pending" || st === "running") {
      if (reviewStartedAt === null) setReviewStartedAt(Date.now());
      const timer = setTimeout(() => {
        if (reviewStartedAt && Date.now() - reviewStartedAt >= 180_000) {
          setReviewTimedOut(true);
        }
      }, 5000);
      return () => clearTimeout(timer);
    } else {
      setReviewStartedAt(null);
      setReviewTimedOut(false);
    }
  }, [draft?.quality_status, reviewStartedAt]);


  if (isLoading || !draft) {
    return <Skeleton className="h-96 w-full" />;
  }

  const handleSave = async () => {
    try {
      await update.mutateAsync({
        id: draft.id,
        patch: { title, content, status: "draft" },
      });
      setDirty(false);
      toast.success("Minuta salva como peça do caso.");
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      toast.success("Minuta copiada com sucesso.");
    } catch {
      toast.error("Não foi possível copiar a minuta.");
    }
  };

  const handleArchive = async () => {
    try {
      await archive.mutateAsync(draft.id);
      toast.success("Minuta arquivada.");
      navigate(`/cases/${caseId}`);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const handleRegen = () => {
    if (dirty) {
      setConfirmRegen(true);
    } else {
      navigate(`/cases/${caseId}/drafts/new`);
    }
  };

  const typeLabel =
    CASE_DRAFT_TYPE_LABEL[draft.draft_type as CaseDraftType] ?? draft.draft_type;

  return (
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
            <BreadcrumbPage>Minuta</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <Input
            value={title}
            onChange={(e) => { setTitle(e.target.value); setDirty(true); }}
            className="h-auto border-none bg-transparent p-0 font-display text-2xl font-bold shadow-none focus-visible:ring-0"
          />
          <p className="mt-1 text-sm text-muted-foreground">
            {typeLabel}
            {draft.status === "archived" ? " · Arquivada" : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => navigate(`/cases/${caseId}`)}>
            <ArrowLeft className="mr-1 h-4 w-4" /> Voltar
          </Button>
          <Button variant="outline" size="sm" onClick={handleCopy}>
            <Copy className="mr-1 h-4 w-4" /> Copiar minuta
          </Button>
          <Button variant="outline" size="sm" onClick={handleRegen}>
            <Sparkles className="mr-1 h-4 w-4" />
            {draft.senior_review_status === "done" ? "Regenerar minuta (fluxo inicial)" : "Regenerar minuta"}
          </Button>
          {draft.status !== "archived" && (
            <Button variant="outline" size="sm" onClick={handleArchive}>
              <Archive className="mr-1 h-4 w-4" /> Arquivar
            </Button>
          )}
          <Button size="sm" onClick={handleSave} disabled={update.isPending || !dirty}>
            {update.isPending ? (
              <><Loader2 className="mr-1 h-4 w-4 animate-spin" /> Salvando…</>
            ) : (
              <><Save className="mr-1 h-4 w-4" /> Salvar minuta</>
            )}
          </Button>
        </div>
      </div>

      <ReviewStatusBanner
        status={draft.quality_status ?? null}
        timedOut={reviewTimedOut}
        onRetry={() => review.mutate(draft.id)}
        retrying={review.isPending}
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_320px]">

        <Card className="p-4">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <PendingCountBadge content={content} />
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setShowPreview((v) => !v)}
              title="Alterna entre editor e visualização com destaques (não altera o texto salvo)"
            >
              {showPreview ? (
                <><Pencil className="mr-1 h-3 w-3" /> Editar texto</>
              ) : (
                <><Eye className="mr-1 h-3 w-3" /> Ver com destaques</>
              )}
            </Button>
          </div>
          {!showPreview && (
            <div className="mb-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-2 text-[11px] text-amber-800 dark:text-amber-200">
              Editando texto bruto — clique em "Ver com destaques" para revisar os marcadores pendentes em vermelho.
            </div>
          )}
          {showPreview ? (
            <DraftContentPreview content={content} className="min-h-[70vh]" />
          ) : (
            <Textarea
              value={content}
              onChange={(e) => { setContent(e.target.value); setDirty(true); }}
              className="min-h-[70vh] resize-y whitespace-pre-wrap font-mono text-sm leading-relaxed"
              spellCheck
            />
          )}
        </Card>

        <div className="space-y-4">
          <Card className="p-4">
            <h3 className="mb-2 text-sm font-semibold">Fontes usadas</h3>
            <DraftSourcesBadges
              sources={draft.sources_used}
              available={{
                intake: !!draft.sources_used?.intake,
                analysis: !!draft.sources_used?.analysis,
                documents: !!draft.sources_used?.documents,
                template: !!draft.sources_used?.template,
                chat_history: !!draft.sources_used?.chat_history,
              }}
            />
            {draft.model_used && (
              <p className="mt-3 text-xs text-muted-foreground">
                Modelo IA: {draft.model_used}
              </p>
            )}
          </Card>

          <PendingCountBadge content={content} />

          <DraftWarningsList
            warnings={draft.warnings}
            missing={draft.missing_information}
            qualityReport={draft.quality_report}
          />

          <CalculationsPanel draftId={draft.id} />

          <PlaybookCompliancePanel draft={draft as never} />


          <SeniorReviewPanel
            draft={draft}
            onRefresh={() => qc.invalidateQueries({ queryKey: ["case_drafts", "one", draft.id] })}
          />

          <SeniorReviewSuggestionsPanel draft={draft} />

          <DraftVersionsPanel draftId={draft.id} />

        </div>
      </div>


      <AlertDialog open={confirmRegen} onOpenChange={setConfirmRegen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Regenerar minuta?</AlertDialogTitle>
            <AlertDialogDescription>
              Você tem alterações não salvas. A regeneração criará uma nova minuta —
              esta ficará preservada, mas as edições atuais serão descartadas se
              você sair sem salvar.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction onClick={() => navigate(`/cases/${caseId}/drafts/new`)}>
              Gerar nova minuta
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function ReviewStatusBanner({
  status,
  timedOut,
  onRetry,
  retrying,
}: {
  status: string | null;
  timedOut: boolean;
  onRetry: () => void;
  retrying: boolean;
}) {
  if (!status || status === "not_requested") return null;

  if (status === "pending" || status === "running") {
    const label =
      status === "pending"
        ? "Revisão automática na fila…"
        : "Revisando qualidade da peça…";
    return (
      <div className="rounded-lg border border-primary/40 bg-primary/5 p-3 text-sm">
        <div className="flex items-center gap-2 font-medium text-primary">
          <Loader2 className="h-4 w-4 animate-spin" /> {label}
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Evite editar a minuta até a revisão concluir — edições feitas agora
          impedem que a reescrita automática seja aplicada.
          {timedOut && " A revisão está demorando mais que o usual; você pode tentar novamente."}
        </p>
        {timedOut && (
          <div className="mt-2">
            <Button size="sm" variant="outline" onClick={onRetry} disabled={retrying}>
              <RefreshCw className="mr-1 h-3 w-3" /> Tentar revisar novamente
            </Button>
          </div>
        )}
      </div>
    );
  }

  if (status === "done") {
    return (
      <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-3 text-sm">
        <div className="flex items-center gap-2 font-medium text-emerald-700 dark:text-emerald-300">
          <ShieldCheck className="h-4 w-4" /> Revisão automática concluída
        </div>
      </div>
    );
  }

  if (status === "failed") {
    return (
      <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm">
        <div className="flex items-center gap-2 font-medium text-red-700 dark:text-red-300">
          <ShieldAlert className="h-4 w-4" /> Não foi possível concluir a revisão automática. A minuta original foi preservada.
        </div>
        <div className="mt-2">
          <Button size="sm" variant="outline" onClick={onRetry} disabled={retrying}>
            <RefreshCw className="mr-1 h-3 w-3" /> Tentar revisar novamente
          </Button>
        </div>
      </div>
    );
  }

  return null;
}

