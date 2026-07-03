import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { ArrowLeft, Loader2, Sparkles, Info } from "lucide-react";

import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { useCaseDetail } from "@/hooks/useCaseDetail";
import { useCaseIntake } from "@/hooks/useCaseIntake";
import { useCaseAnalysis } from "@/hooks/useCaseAnalysis";
import { useCaseFiles } from "@/hooks/useCaseFiles";
import { useGenerateDraft } from "@/hooks/useCaseDrafts";
import { useMatchingTemplates } from "@/hooks/useMatchingTemplates";
import {
  CASE_DRAFT_TYPE_OPTIONS,
  TONE_OPTIONS,
  type CaseDraftType,
} from "@/types/caseDraft";
import MatchingTemplatePicker from "@/components/cases/drafts/MatchingTemplatePicker";

export default function DraftGeneratorPage() {
  const { id: caseId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { caseData, isLoading: caseLoading } = useCaseDetail(caseId);
  const { intake } = useCaseIntake(caseId, caseData?.client_id);
  const { analysis } = useCaseAnalysis(caseId);
  const { data: files = [] } = useCaseFiles(caseId);

  const [draftType, setDraftType] = useState<CaseDraftType>("initial_petition");
  const [objective, setObjective] = useState("");
  const [tone, setTone] = useState("template_default");
  const [templateId, setTemplateId] = useState<string | null>(null);
  const [additionalInstructions, setAdditionalInstructions] = useState("");
  const [useIntake, setUseIntake] = useState(true);
  const [useAnalysis, setUseAnalysis] = useState(true);
  const [useDocuments, setUseDocuments] = useState(true);
  const [useTemplate, setUseTemplate] = useState(true);
  const [useChatHistory, setUseChatHistory] = useState(false);

  const hasIntake = !!intake;
  const hasAnalysis = !!analysis;
  const hasDocuments = files.some((f) => f.pipeline_stage === "done") || files.length > 0;

  const { data: matching = [], isLoading: matchLoading } = useMatchingTemplates({
    legal_area: (intake?.legal_area as string) || null,
    represented_party: (intake?.represented_party as string) || null,
    main_topic: null,
    procedural_stage: null,
    draft_type: draftType,
  });

  // Sugestão automática do modelo mais compatível
  useMemo(() => {
    if (!templateId && matching.length > 0) {
      setTemplateId(matching[0].template.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matching.length]);

  // Sugestão inicial de objetivo a partir da análise
  useMemo(() => {
    if (!objective && analysis?.content_json) {
      const rec = analysis.content_json.recommended_piece;
      const next = analysis.content_json.next_action;
      if (rec || next) {
        setObjective(
          `Preparar minuta${rec ? ` de ${rec}` : ""} com base na ficha, análise, documentos${templateId ? " e modelo do escritório" : ""}.${next ? ` Próxima providência: ${next}` : ""}`,
        );
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [analysis]);

  const generate = useGenerateDraft();

  // Feedback visual de progresso: alterna rótulos enquanto a edge processa
  // (edge função síncrona; ciclo baseado em tempo estimado por etapa)
  const PROGRESS_STEPS = [
    "Construindo mapa de pedidos…",
    "Redigindo minuta profissional…",
    "Revisando qualidade…",
    "Ajustando pontos fracos…",
  ];
  const [progressIdx, setProgressIdx] = useState(0);
  useEffect(() => {
    if (!generate.isPending) { setProgressIdx(0); return; }
    setProgressIdx(0);
    const step = setInterval(() => {
      setProgressIdx((i) => (i < PROGRESS_STEPS.length - 1 ? i + 1 : i));
    }, 12000);
    return () => clearInterval(step);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [generate.isPending]);

  const handleGenerate = async () => {
    if (!caseId) return;
    try {
      const res = await generate.mutateAsync({
        case_id: caseId,
        draft_type: draftType,
        objective: objective || undefined,
        tone,
        template_id: useTemplate ? templateId : null,
        use_intake: useIntake && hasIntake,
        use_analysis: useAnalysis && hasAnalysis,
        use_documents: useDocuments && hasDocuments,
        use_template: useTemplate && !!templateId,
        use_chat_history: useChatHistory,
        additional_instructions: additionalInstructions || undefined,
      });
      toast.success("Minuta gerada com sucesso.");
      navigate(`/cases/${caseId}/drafts/${res.draft_id}`);
    } catch (e) {
      toast.error((e as Error).message || "Falha ao gerar minuta.");
    }
  };


  if (caseLoading || !caseData) {
    return <Skeleton className="h-96 w-full" />;
  }

  return (
    <div className="space-y-6">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild><Link to="/cases">Processos</Link></BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link to={`/cases/${caseId}`}>
                {caseData.case_number || caseData.subject || caseData.client_name || "Caso"}
              </Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Gerar minuta</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold">Gerar Minuta de Peça</h1>
          <p className="text-sm text-muted-foreground">
            Combine Ficha, Análise, Documentos e Modelo do Escritório para produzir uma minuta revisável.
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={() => navigate(`/cases/${caseId}`)}>
          <ArrowLeft className="mr-1 h-4 w-4" /> Cancelar
        </Button>
      </div>

      <Card className="space-y-5 p-6">
        <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm">
          <div className="flex items-center gap-2 font-medium">
            <Info className="h-4 w-4 text-primary" />
            Nível de profundidade: <span className="text-primary">Profissional completo</span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            A peça será gerada com profundidade mínima equivalente ao modelo selecionado.
            O advogado deverá revisar fundamentos, jurisprudência e valores antes do protocolo.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Tipo de peça</Label>
            <Select value={draftType} onValueChange={(v) => setDraftType(v as CaseDraftType)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {CASE_DRAFT_TYPE_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Tom/estilo</Label>
            <Select value={tone} onValueChange={setTone}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {TONE_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-2">
          <Label>Objetivo da peça</Label>
          <Textarea
            value={objective}
            onChange={(e) => setObjective(e.target.value)}
            placeholder="Ex.: Preparar minuta de petição inicial trabalhista com base na ficha, análise, documentos e modelo do escritório."
            rows={3}
          />
        </div>

        <MatchingTemplatePicker
          templates={matching}
          value={templateId}
          onChange={setTemplateId}
          loading={matchLoading}
        />

        <div className="space-y-2">
          <Label>Fontes de contexto</Label>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <CheckboxRow
              checked={useIntake}
              onChange={setUseIntake}
              label="Usar Ficha Inteligente"
              disabled={!hasIntake}
              disabledLabel="(indisponível)"
            />
            <CheckboxRow
              checked={useAnalysis}
              onChange={setUseAnalysis}
              label="Usar Análise Inicial"
              disabled={!hasAnalysis}
              disabledLabel="(indisponível)"
            />
            <CheckboxRow
              checked={useDocuments}
              onChange={setUseDocuments}
              label="Usar documentos processados"
              disabled={!hasDocuments}
              disabledLabel="(indisponível)"
            />
            <CheckboxRow
              checked={useTemplate}
              onChange={setUseTemplate}
              label="Usar Modelo do Escritório"
              disabled={!templateId}
              disabledLabel="(selecione um modelo)"
            />
            <CheckboxRow
              checked={useChatHistory}
              onChange={setUseChatHistory}
              label="Usar histórico do Chat (opcional)"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label>Instruções adicionais do advogado</Label>
          <Textarea
            value={additionalInstructions}
            onChange={(e) => setAdditionalInstructions(e.target.value)}
            placeholder="Ex.: destacar férias pagas em atraso, FGTS, pagamentos por fora e jornada; marcar lacunas para confirmar com o cliente; não incluir dano moral sem base suficiente."
            rows={4}
          />
        </div>

        <div className="flex items-center justify-between gap-2 border-t pt-4">
          <div className="text-xs text-muted-foreground">
            {generate.isPending ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 className="h-3 w-3 animate-spin" />
                {PROGRESS_STEPS[progressIdx]}
              </span>
            ) : (
              <span>A geração pode levar 30–90 segundos.</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={() => navigate(`/cases/${caseId}`)}>
              Cancelar
            </Button>
            <Button onClick={handleGenerate} disabled={generate.isPending}>
              {generate.isPending ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Gerando…</>
              ) : (
                <><Sparkles className="mr-2 h-4 w-4" /> Gerar minuta</>
              )}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}


function CheckboxRow({
  checked,
  onChange,
  label,
  disabled,
  disabledLabel,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  disabled?: boolean;
  disabledLabel?: string;
}) {
  return (
    <label className={`flex items-center gap-2 rounded-md border p-2 text-sm ${disabled ? "opacity-60" : ""}`}>
      <Checkbox
        checked={disabled ? false : checked}
        onCheckedChange={(v) => onChange(Boolean(v))}
        disabled={disabled}
      />
      <span>{label}{disabled && disabledLabel ? ` ${disabledLabel}` : ""}</span>
    </label>
  );
}

// Keep tree-shaker happy for unused import warning
export { Input };
