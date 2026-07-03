import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Archive, Copy, Loader2, Save, Sparkles } from "lucide-react";
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
  useUpdateDraft,
} from "@/hooks/useCaseDrafts";
import DraftSourcesBadges from "@/components/cases/drafts/DraftSourcesBadges";
import DraftWarningsList from "@/components/cases/drafts/DraftWarningsList";
import { CASE_DRAFT_TYPE_LABEL, type CaseDraftType } from "@/types/caseDraft";

export default function DraftDetailPage() {
  const { id: caseId, draftId } = useParams<{ id: string; draftId: string }>();
  const navigate = useNavigate();
  const { data: draft, isLoading } = useCaseDraft(draftId);
  const update = useUpdateDraft();
  const archive = useArchiveDraft();

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [dirty, setDirty] = useState(false);
  const [confirmRegen, setConfirmRegen] = useState(false);

  useEffect(() => {
    if (draft) {
      setTitle(draft.title ?? "");
      setContent(draft.content ?? "");
      setDirty(false);
    }
  }, [draft?.id]);

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
            <Sparkles className="mr-1 h-4 w-4" /> Regenerar
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

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_320px]">
        <Card className="p-4">
          <Textarea
            value={content}
            onChange={(e) => { setContent(e.target.value); setDirty(true); }}
            className="min-h-[70vh] resize-y whitespace-pre-wrap font-mono text-sm leading-relaxed"
            spellCheck
          />
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

          <DraftWarningsList
            warnings={draft.warnings}
            missing={draft.missing_information}
            qualityReport={draft.quality_report}
          />

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
