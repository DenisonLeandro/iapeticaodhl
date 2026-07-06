// =============================================================================
// CaseWorkbench — PR-4.0A
// Painel principal do caso: status + 4 ações + resumos.
// Sem chamadas de IA novas. Usa apenas dados já disponíveis nos hooks atuais.
// =============================================================================

import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  ArrowRight,
  FileSearch,
  FileSignature,
  FileText,
  ListChecks,
  MessageSquare,
  PenLine,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useCurrentClaimMap } from "@/hooks/useCaseClaimMap";
import { CLAIM_MAP_STATUS_LABEL } from "@/types/caseClaimMap";
import { useCaseFiles, type CaseFileRow } from "@/hooks/useCaseFiles";
import type { CaseDocument, CaseWithRelations } from "@/types/case";
import CaseActionCard from "./CaseActionCard";
import CaseStatusPanel from "./CaseStatusPanel";
import ComingSoonDialog from "./ComingSoonDialog";

import CaseAnalysisPanel from "./CaseAnalysisPanel";
import { useCaseAnalysis } from "@/hooks/useCaseAnalysis";
import { useCaseIntake } from "@/hooks/useCaseIntake";
import CaseIntakeStatus from "./CaseIntakeStatus";


interface Props {
  caseData: CaseWithRelations;
  documents: CaseDocument[];
  onOpenChat: () => void;
}

type Placeholder = null | "review";

const STAGE_LABEL: Record<string, string> = {
  done: "Pronto",
  failed: "Erro",
  queued: "Processando",
  extracting: "Processando",
  chunking: "Processando",
  classifying: "Processando",
  embedding: "Processando",
  pending: "Aguardando",
};

function fileStatus(stage: string | null): string {
  if (!stage) return "Aguardando";
  return STAGE_LABEL[stage] ?? "Aguardando";
}

function computeSuggestion(
  hasClient: boolean,
  files: CaseFileRow[],
  documents: CaseDocument[],
): string {
  if (!hasClient) return "Vincule um cliente ao caso";
  if (files.length === 0) return "Envie os documentos do caso";
  if (files.some((f) => f.pipeline_stage === "failed")) {
    return "Verifique documentos com erro de processamento";
  }
  const allReady = files.every((f) => f.pipeline_stage === "done");
  if (!allReady) return "Aguarde o processamento dos documentos";
  if (documents.length === 0) return "Analise o caso para começar";
  return "Revise as peças geradas ou converse com a IA";
}

export default function CaseWorkbench({ caseData, documents, onOpenChat }: Props) {
  const navigate = useNavigate();
  const { data: files = [] } = useCaseFiles(caseData.id);
  const [placeholder, setPlaceholder] = useState<Placeholder>(null);
  const { analysis, isLoading: analysisLoading, isRunning, generate } = useCaseAnalysis(caseData.id);
  const { intake } = useCaseIntake(caseData.id, caseData.client_id);


  const hasClient = !!caseData.client_id;
  const documentsReady = files.filter((f) => f.pipeline_stage === "done").length;
  const lastUpdate = useMemo(() => {
    const all = [
      ...files.map((f) => f.created_at),
      ...documents.map((d) => d.created_at),
      caseData.updated_at,
    ].filter(Boolean);
    if (all.length === 0) return null;
    return all.sort().slice(-1)[0] ?? null;
  }, [files, documents, caseData.updated_at]);

  const suggestion = computeSuggestion(hasClient, files, documents);
  const recentFiles = files.slice(0, 3);
  const recentDocs = documents.slice(0, 3);

  const handleGenerate = () => {
    if (!hasClient) {
      toast.error("Vincule um cliente antes de gerar uma peça.");
      return;
    }
    navigate(`/cases/${caseData.id}/drafts/new`);
  };

  return (
    <div className="space-y-6">
      <CaseStatusPanel
        clientId={caseData.client_id}
        clientName={caseData.client_name}
        lawyerName={caseData.lawyer_name}
        documentsReady={documentsReady}
        documentsTotal={files.length}
        lastUpdate={lastUpdate}
        suggestion={suggestion}
      />

      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-card px-4 py-3">
        <div className="flex items-center gap-2 text-sm">
          <span className="font-medium">Ficha do caso:</span>
          <CaseIntakeStatus values={intake} />
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() =>
            document.querySelector<HTMLElement>('[data-tab-trigger="intake"]')?.click()
          }
        >
          Abrir ficha
          <ArrowRight className="ml-1 h-3.5 w-3.5" />
        </Button>
      </div>



      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <CaseActionCard
          icon={FileSearch}
          title={analysis ? "Reanalisar Caso" : "Analisar Caso"}
          description="Resumo, riscos e próximos passos do caso."
          onClick={() => generate(!!analysis)}
          disabled={isRunning}
        />

        <CaseActionCard
          icon={FileSignature}
          title="Gerar Peça"
          description="Inicial, recurso, manifestação e mais."
          onClick={handleGenerate}
          disabled={!hasClient}
          disabledHint="Vincule um cliente antes de gerar uma peça."
        />
        <CaseActionCard
          icon={PenLine}
          title="Revisar Peça"
          description="Envie uma peça para revisão pela IA."
          onClick={() => setPlaceholder("review")}
          comingSoon
        />
        <CaseActionCard
          icon={MessageSquare}
          title="Conversar com IA"
          description="Tire dúvidas sobre os documentos do caso."
          onClick={onOpenChat}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <SummaryCard
          title="Documentos recentes"
          emptyText="Nenhum documento enviado ainda."
          actionLabel="Ver todos"
          onAction={() => document.querySelector<HTMLElement>('[data-tab-trigger="documents"]')?.click()}
          items={recentFiles.map((f) => ({
            id: f.id,
            primary: f.file_name,
            secondary: fileStatus(f.pipeline_stage),
            date: f.created_at,
          }))}
        />
        <SummaryCard
          title="Peças geradas"
          emptyText="Nenhuma peça gerada ainda."
          actionLabel="Ver todas"
          onAction={() => document.querySelector<HTMLElement>('[data-tab-trigger="pieces"]')?.click()}
          items={recentDocs.map((d) => ({
            id: d.id,
            primary: d.title,
            secondary: d.status,
            date: d.created_at,
          }))}
        />
      </div>

      <CaseAnalysisPanel
        analysis={analysis}
        isLoading={analysisLoading}
        isRunning={isRunning}
        onGenerate={() => generate(false)}
        onRegenerate={() => generate(true)}
      />


      <ComingSoonDialog
        open={placeholder === "review"}
        onOpenChange={(v) => !v && setPlaceholder(null)}
        title="Revisão de peça"
        description="A revisão de peças pela IA será implementada em etapa futura."
      />
    </div>
  );
}

interface SummaryItem {
  id: string;
  primary: string;
  secondary: string;
  date: string;
}

function SummaryCard({
  title,
  items,
  emptyText,
  actionLabel,
  onAction,
}: {
  title: string;
  items: SummaryItem[];
  emptyText: string;
  actionLabel: string;
  onAction: () => void;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-display text-base font-semibold">{title}</h3>
        {items.length > 0 && (
          <Button variant="ghost" size="sm" onClick={onAction}>
            {actionLabel}
            <ArrowRight className="ml-1 h-3.5 w-3.5" />
          </Button>
        )}
      </div>
      {items.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-muted/30 p-6 text-center text-sm text-muted-foreground">
          <FileText className="mx-auto mb-2 h-6 w-6 opacity-50" />
          {emptyText}
        </div>
      ) : (
        <ul className="divide-y divide-border">
          {items.map((item) => (
            <li key={item.id} className="flex items-center justify-between gap-3 py-2.5">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground">{item.primary}</p>
                <p className="text-xs text-muted-foreground">{item.secondary}</p>
              </div>
              <span className="shrink-0 text-xs text-muted-foreground">
                {new Date(item.date).toLocaleDateString("pt-BR")}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
