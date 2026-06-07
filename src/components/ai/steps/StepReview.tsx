// =============================================================================
// StepReview — Step 4: Final review before generation
// Phase C — Conferência final + aviso de PDFs pendentes
// =============================================================================

import { useMemo, useState } from "react";
import {
  Pencil,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  FileText,
  Scale,
  User,
  Building2,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { useFilesByCase } from "@/hooks/useClientDetail";
import { DOCUMENT_TYPE_LABELS } from "@/types/ai";
import {
  REPRESENTED_PARTY_LABELS,
  isRepresentedParty,
} from "@/lib/represented-party";
import type { DocumentType } from "@/types/ai";
import type { DocumentGenerationFormData } from "@/lib/validators/document-generation";
import type { JurisprudenceResult } from "@/types/jurisprudence";

interface StepReviewProps {
  documentType: DocumentType;
  formData: DocumentGenerationFormData;
  selectedJurisprudence: JurisprudenceResult[];
  selectedAnalysisFileIds: string[];
  providerLabel?: string;
  modelLabel?: string;
  onEditStep: (step: 1 | 2 | 3) => void;
  onConfirm: () => void;
}

function SectionCard({
  icon: Icon,
  title,
  onEdit,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  onEdit?: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        </div>
        {onEdit && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={onEdit}
          >
            <Pencil className="mr-1 h-3 w-3" /> Editar
          </Button>
        )}
      </div>
      <div className="text-sm text-foreground/90 space-y-2">{children}</div>
    </div>
  );
}

function Field({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-[140px_1fr] gap-2 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-foreground/90 break-words">
        {value ?? <span className="text-muted-foreground italic">não informado</span>}
      </span>
    </div>
  );
}

function Truncated({ text, limit = 320 }: { text: string; limit?: number }) {
  const [expanded, setExpanded] = useState(false);
  if (!text) return <span className="text-muted-foreground italic">não informado</span>;
  if (text.length <= limit) return <span className="whitespace-pre-wrap">{text}</span>;
  return (
    <div>
      <span className="whitespace-pre-wrap">
        {expanded ? text : text.slice(0, limit) + "…"}
      </span>
      <button
        type="button"
        className="ml-1 text-xs text-primary hover:underline"
        onClick={() => setExpanded((v) => !v)}
      >
        {expanded ? "ver menos" : "ver mais"}
      </button>
    </div>
  );
}

const STATUS_LABEL: Record<string, string> = {
  analyzed: "Analisado",
  processing: "Processando",
  pending: "Pendente",
  error: "Erro",
};

export default function StepReview({
  documentType,
  formData,
  selectedJurisprudence,
  selectedAnalysisFileIds,
  providerLabel = "Lovable AI",
  modelLabel = "google/gemini-3-flash-preview",
  onEditStep,
  onConfirm,
}: StepReviewProps) {
  const hasCase = !!formData.caseId;
  const { files } = useFilesByCase(hasCase ? formData.caseId! : undefined);

  const selectedFiles = useMemo(
    () => files.filter((f) => selectedAnalysisFileIds.includes(f.id)),
    [files, selectedAnalysisFileIds],
  );
  const pendingFiles = useMemo(
    () =>
      files.filter(
        (f) => (f.processing_status ?? "pending") !== "analyzed",
      ),
    [files],
  );

  const partyLabel = formData.representedParty && isRepresentedParty(formData.representedParty)
    ? REPRESENTED_PARTY_LABELS[formData.representedParty]
    : formData.representedParty ?? null;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-foreground">Conferência final</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Revise abaixo todas as informações que serão enviadas para a IA. Você pode editar qualquer bloco antes de gerar.
        </p>
      </div>

      {/* Tipo */}
      <SectionCard icon={Scale} title="Tipo de petição" onEdit={() => onEditStep(1)}>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="text-sm">
            {DOCUMENT_TYPE_LABELS[documentType]}
          </Badge>
        </div>
      </SectionCard>

      {/* Dados das partes / processo */}
      <SectionCard icon={User} title="Partes e processo" onEdit={() => onEditStep(2)}>
        <Field label="Autor / Cliente" value={formData.autor?.nome} />
        {formData.autor?.cpfCnpj && (
          <Field label="CPF/CNPJ" value={formData.autor.cpfCnpj} />
        )}
        <Field label="Réu / Parte contrária" value={formData.reu?.nome || null} />
        {formData.reu?.cpfCnpj && (
          <Field label="CPF/CNPJ (réu)" value={formData.reu.cpfCnpj} />
        )}
        <Field label="Parte representada" value={partyLabel} />
        <Field label="Nº do processo" value={formData.numeroProcesso || null} />
        <Field label="Tribunal" value={formData.tribunal} />
        <Field label="Vara" value={formData.vara || null} />
        {formData.assunto && <Field label="Assunto" value={formData.assunto} />}
      </SectionCard>

      {/* Fatos / Pedido / Fundamentação */}
      <SectionCard icon={FileText} title="Conteúdo da peça" onEdit={() => onEditStep(2)}>
        <div className="space-y-3">
          <div>
            <div className="text-xs font-medium text-muted-foreground mb-1">Fatos</div>
            <Truncated text={formData.fatos ?? ""} />
          </div>
          {formData.pedidos && (
            <div>
              <div className="text-xs font-medium text-muted-foreground mb-1">Pedidos</div>
              <Truncated text={formData.pedidos} limit={240} />
            </div>
          )}
          {formData.fundamentacao && (
            <div>
              <div className="text-xs font-medium text-muted-foreground mb-1">
                Fundamentação desejada
              </div>
              <Truncated text={formData.fundamentacao} limit={240} />
            </div>
          )}
          {formData.instrucoesAdicionais && (
            <div>
              <div className="text-xs font-medium text-muted-foreground mb-1">
                Instruções adicionais
              </div>
              <Truncated text={formData.instrucoesAdicionais} limit={240} />
            </div>
          )}
        </div>
      </SectionCard>

      {/* Jurisprudência */}
      <SectionCard icon={Scale} title="Jurisprudência selecionada" onEdit={() => onEditStep(2)}>
        {selectedJurisprudence.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">
            Nenhuma jurisprudência selecionada — a IA não citará precedentes.
          </p>
        ) : (
          <ul className="space-y-2">
            {selectedJurisprudence.map((j, idx) => (
              <li key={idx} className="rounded-md border border-border/60 p-2 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className="text-[10px]">{j.court}</Badge>
                  <span className="font-medium">{j.caseNumber}</span>
                  {j.relator && (
                    <span className="text-xs text-muted-foreground">Rel. {j.relator}</span>
                  )}
                  {j.link && (
                    <a
                      href={j.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ml-auto inline-flex items-center gap-1 text-xs text-primary hover:underline"
                    >
                      Fonte <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
                <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{j.summary}</p>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      {/* Documentos do processo */}
      {hasCase && (
        <SectionCard
          icon={FileText}
          title="Documentos do processo"
          onEdit={() => onEditStep(3)}
        >
          {selectedFiles.length > 0 ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs text-emerald-500">
                <CheckCircle2 className="h-3.5 w-3.5" />
                <span>{selectedFiles.length} PDF(s) analisado(s) que serão usados pela IA</span>
              </div>
              <ul className="space-y-1">
                {selectedFiles.map((f) => (
                  <li key={f.id} className="flex items-center gap-2 text-xs">
                    <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="truncate">{f.file_name}</span>
                    {f.document_kind && (
                      <Badge variant="outline" className="text-[10px]">{f.document_kind}</Badge>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground italic">
              Nenhum PDF selecionado. A IA não terá acesso a documentos do processo.
            </p>
          )}

          {pendingFiles.length > 0 && (
            <Alert className="border-amber-500/50 bg-amber-500/10">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              <AlertDescription className="space-y-2">
                <div className="text-sm text-amber-200">
                  <strong>{pendingFiles.length} documento(s)</strong> deste processo ainda
                  não foram analisados e <strong>NÃO</strong> serão considerados pela IA se você prosseguir.
                </div>
                <ul className="space-y-1">
                  {pendingFiles.map((f) => (
                    <li
                      key={f.id}
                      className="flex flex-wrap items-center gap-2 text-xs text-amber-100/90"
                    >
                      <FileText className="h-3.5 w-3.5" />
                      <span className="truncate">{f.file_name}</span>
                      {f.document_kind && (
                        <Badge variant="outline" className="text-[10px]">{f.document_kind}</Badge>
                      )}
                      <Badge variant="outline" className="text-[10px]">
                        {STATUS_LABEL[f.processing_status ?? "pending"] ?? "Pendente"}
                      </Badge>
                    </li>
                  ))}
                </ul>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-2"
                  onClick={() => onEditStep(3)}
                >
                  Voltar para Documentos
                </Button>
              </AlertDescription>
            </Alert>
          )}
        </SectionCard>
      )}

      {/* Provider/modelo */}
      <SectionCard icon={Building2} title="Modelo de IA">
        <Field label="Provider" value={providerLabel} />
        <Field label="Modelo" value={modelLabel} />
        <p className="text-xs text-muted-foreground">
          Para alterar, acesse Configurações → IA.
        </p>
      </SectionCard>

      <Separator />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
        <Button type="button" size="lg" onClick={onConfirm}>
          <Sparkles className="mr-2 h-4 w-4" />
          Gerar petição
        </Button>
      </div>
    </div>
  );
}
