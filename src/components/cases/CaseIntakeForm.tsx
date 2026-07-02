// =============================================================================
// PR-4.3A — Ficha Inteligente Universal do Caso (formulário em blocos)
// =============================================================================
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Download, Loader2, Save, Sparkles, Wand2 } from "lucide-react";
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
import { buildIntakePrefill } from "@/services/caseIntakePrefill";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

import {
  CLIENT_GOAL_OPTIONS,
  LEGAL_AREA_OPTIONS,
  REPRESENTED_PARTY_OPTIONS,
  URGENCY_OPTIONS,
  caseIntakeFormSchema,
  computeIntakeStatus,
  type CaseIntakeFormValues,
} from "@/types/caseIntake";

import { useCaseIntake } from "@/hooks/useCaseIntake";
import { useCaseAnalysis } from "@/hooks/useCaseAnalysis";
import CaseIntakeStatus from "./CaseIntakeStatus";
import CaseIntakeAISuggestions from "./CaseIntakeAISuggestions";
import type { CaseWithRelations } from "@/types/case";

interface Props {
  caseData: CaseWithRelations;
  onAnalyzed?: () => void;
}

const EMPTY: CaseIntakeFormValues = {
  legal_area: "",
  legal_area_other: "",
  represented_party: "",
  opposing_party: "",
  problem_summary: "",
  client_story: "",
  client_goal: "",
  client_goal_other: "",
  urgency: "",
  deadline_date: "",
  facts_period: "",
  facts_location: "",
  amount_involved: "",
  has_existing_lawsuit: null,
  existing_case_number: "",
  existing_documents: "",
  uploaded_documents_notes: "",
  missing_documents: "",
  witnesses: "",
  other_evidence: "",
  internal_notes: "",
};

function Block({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <header className="mb-4">
        <h3 className="font-display text-base font-semibold">{title}</h3>
        {description && <p className="mt-1 text-xs text-muted-foreground">{description}</p>}
      </header>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

export default function CaseIntakeForm({ caseData, onAnalyzed }: Props) {
  const { intake, isLoading, save, isSaving, suggest, isSuggesting } =
    useCaseIntake(caseData.id, caseData.client_id);
  const { generate, isRunning: isAnalyzing } = useCaseAnalysis(caseData.id);

  const form = useForm<CaseIntakeFormValues>({
    resolver: zodResolver(caseIntakeFormSchema),
    defaultValues: EMPTY,
  });

  const [isPrefilling, setIsPrefilling] = useState(false);
  const [pendingPrefill, setPendingPrefill] = useState<{
    values: Partial<CaseIntakeFormValues>;
    conflicts: (keyof CaseIntakeFormValues)[];
    heuristicFields: (keyof CaseIntakeFormValues)[];
    documentSourcedFields: (keyof CaseIntakeFormValues)[];
    sourcesUsed: string[];
  } | null>(null);


  // Hidrata o form quando intake chega
  useEffect(() => {
    if (intake) {
      form.reset({
        legal_area: intake.legal_area ?? "",
        legal_area_other: intake.legal_area_other ?? "",
        represented_party: intake.represented_party ?? "",
        opposing_party: intake.opposing_party ?? "",
        problem_summary: intake.problem_summary ?? "",
        client_story: intake.client_story ?? "",
        client_goal: intake.client_goal ?? "",
        client_goal_other: intake.client_goal_other ?? "",
        urgency: intake.urgency ?? "",
        deadline_date: intake.deadline_date ?? "",
        facts_period: intake.facts_period ?? "",
        facts_location: intake.facts_location ?? "",
        amount_involved: intake.amount_involved ?? "",
        has_existing_lawsuit: intake.has_existing_lawsuit ?? null,
        existing_case_number: intake.existing_case_number ?? "",
        existing_documents: intake.existing_documents ?? "",
        uploaded_documents_notes: intake.uploaded_documents_notes ?? "",
        missing_documents: intake.missing_documents ?? "",
        witnesses: intake.witnesses ?? "",
        other_evidence: intake.other_evidence ?? "",
        internal_notes: intake.internal_notes ?? "",
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intake?.id]);

  const watched = form.watch();
  const status = useMemo(() => computeIntakeStatus(watched), [watched]);

  async function handleSave(notify = true): Promise<boolean> {
    const ok = await form.trigger();
    if (!ok) {
      toast.error("Verifique os campos da ficha.");
      return false;
    }
    try {
      await save(form.getValues());
      if (notify) {
        if (status === "complete") toast.success("Ficha salva com sucesso.");
        else if (status === "partial")
          toast.message(
            "Ficha salva como parcial. Complete mais informações para melhorar a análise da IA.",
          );
        else toast.success("Ficha salva.");
      }
      return true;
    } catch (e) {
      toast.error((e as Error).message || "Erro ao salvar ficha.");
      return false;
    }
  }

  async function handleSaveAndAnalyze() {
    if (status === "empty") {
      toast.message(
        "A ficha está praticamente vazia — a análise será apenas preliminar.",
      );
    } else if (status === "partial") {
      toast.message(
        "Ficha parcial — a análise será preliminar e poderá apontar limitações.",
      );
    }
    const saved = await handleSave(false);
    if (!saved) return;
    try {
      generate(true);
      toast.success("Análise iniciada com base na ficha.");
      onAnalyzed?.();
    } catch (e) {
      toast.error(
        "A ficha foi salva, mas a análise falhou. Tente novamente em instantes.",
      );
      console.error("intake:analyze_error", e);
    }
  }

  async function handleSuggest() {
    // Salva antes de pedir sugestão para garantir contexto atualizado
    const saved = await handleSave(false);
    if (!saved) return;
    try {
      await suggest();
    } catch {
      // toast já tratado no hook
    }
  }

  function applySuggestedArea(area: string) {
    form.setValue("legal_area", area, { shouldDirty: true });
    toast.success("Área aplicada à ficha. Lembre-se de salvar.");
  }

  function applyPrefillValues(
    values: Partial<CaseIntakeFormValues>,
    mode: "fill-empty" | "overwrite",
    heuristicFields: (keyof CaseIntakeFormValues)[] = [],
    documentSourcedFields: (keyof CaseIntakeFormValues)[] = [],
    sourcesUsed: string[] = [],
  ) {
    const current = form.getValues();
    let applied = 0;
    const appliedHeuristic: string[] = [];
    const appliedDocSourced: string[] = [];
    (Object.keys(values) as (keyof CaseIntakeFormValues)[]).forEach((k) => {
      const incoming = values[k];
      if (incoming === undefined || incoming === null || incoming === "") return;
      const existing = current[k];
      const isEmpty =
        existing === undefined ||
        existing === null ||
        (typeof existing === "string" && existing.trim() === "");
      if (mode === "fill-empty" && !isEmpty) return;
      form.setValue(k, incoming as never, { shouldDirty: true });
      applied += 1;
      if (heuristicFields.includes(k)) appliedHeuristic.push(k);
      if (documentSourcedFields.includes(k)) appliedDocSourced.push(k);
    });
    if (applied === 0) {
      toast.message("Nenhum campo novo para preencher.");
      return;
    }
    const sourcesTxt = sourcesUsed.length ? ` Fontes: ${sourcesUsed.join(", ")}.` : "";
    toast.success(
      `Importação concluída: ${applied} campo(s) preenchido(s).${sourcesTxt} Revise antes de salvar.`,
    );
    if (
      appliedDocSourced.includes("client_story") ||
      appliedDocSourced.includes("problem_summary")
    ) {
      toast.warning(
        "Relato/Resumo importado de documentos processados — revise antes de salvar.",
        { duration: 8000 },
      );
    }
    if (appliedHeuristic.length > 0) {
      toast.warning(
        `Atenção: ${appliedHeuristic.join(", ")} extraído(s) de documentos por heurística — revise antes de salvar.`,
        { duration: 8000 },
      );
    }
  }

  async function handleImportExisting() {
    setIsPrefilling(true);
    try {
      const result = await buildIntakePrefill(caseData.id, caseData.client_id);
      // Diagnóstico apenas com metadados (sem texto sensível)
      console.info("[intake-prefill]", result.diagnostics);

      if (result.insufficientText) {
        toast.warning(
          "Não foi encontrado texto processado suficiente para preencher o relato detalhado. Verifique se a ficha/documento foi enviada e processada.",
          { duration: 9000 },
        );
      }

      if (result.filledFields.length === 0) {
        toast.message("Não encontramos ficha ou relato anterior para importar.");
        return;
      }
      const current = form.getValues();
      const conflicts = result.filledFields.filter((k) => {
        const existing = current[k];
        return (
          existing !== undefined &&
          existing !== null &&
          !(typeof existing === "string" && existing.trim() === "")
        );
      });
      if (conflicts.length === 0) {
        applyPrefillValues(
          result.values,
          "fill-empty",
          result.heuristicFields,
          result.documentSourcedFields,
          result.sourcesUsed,
        );
      } else {
        setPendingPrefill({
          values: result.values,
          conflicts,
          heuristicFields: result.heuristicFields,
          documentSourcedFields: result.documentSourcedFields,
          sourcesUsed: result.sourcesUsed,
        });
      }
    } catch (e) {
      toast.error((e as Error).message || "Falha ao importar dados existentes.");
    } finally {
      setIsPrefilling(false);
    }
  }



  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12 text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        Carregando ficha…
      </div>
    );
  }

  const legalArea = form.watch("legal_area");
  const clientGoal = form.watch("client_goal");
  const hasLawsuit = form.watch("has_existing_lawsuit");

  return (
    <div className="space-y-5">
      {/* Cabeçalho */}
      <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h2 className="font-display text-lg font-semibold">Ficha Inteligente do Caso</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Preencha o essencial agora. A IA indicará o que precisa ser complementado. A ficha pode
            ser salva parcialmente.
          </p>
        </div>
        <CaseIntakeStatus values={watched} />
      </div>

      {/* Botões principais */}
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => handleSave(true)} disabled={isSaving}>
          {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          Salvar ficha
        </Button>
        <Button
          variant="default"
          onClick={handleSaveAndAnalyze}
          disabled={isSaving || isAnalyzing}
        >
          {isAnalyzing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wand2 className="mr-2 h-4 w-4" />}
          Salvar e analisar com IA
        </Button>
        <Button
          variant="outline"
          onClick={handleImportExisting}
          disabled={isPrefilling || isSaving}
          title="Importa dados já existentes do caso (assunto, parte contrária, interações, análise anterior, documentos)"
        >
          {isPrefilling ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Download className="mr-2 h-4 w-4" />
          )}
          Preencher com dados existentes
        </Button>
        <Button variant="outline" onClick={handleSuggest} disabled={isSaving || isSuggesting}>
          {isSuggesting ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="mr-2 h-4 w-4" />
          )}
          Sugerir área e perguntas complementares
        </Button>
      </div>

      {/* Diálogo de conflito ao importar */}
      <AlertDialog
        open={!!pendingPrefill}
        onOpenChange={(open) => {
          if (!open) setPendingPrefill(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Substituir campos já preenchidos?</AlertDialogTitle>
            <AlertDialogDescription>
              Encontramos dados existentes para campos que você já preencheu manualmente:
              <strong className="ml-1">{pendingPrefill?.conflicts.join(", ")}</strong>.
              <br />
              Você pode preencher apenas os campos vazios (recomendado) ou substituir o conteúdo
              atual pelos dados importados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pendingPrefill)
                  applyPrefillValues(
                    pendingPrefill.values,
                    "fill-empty",
                    pendingPrefill.heuristicFields,
                    pendingPrefill.documentSourcedFields,
                    pendingPrefill.sourcesUsed,
                  );
                setPendingPrefill(null);
              }}
            >
              Preencher só os vazios
            </AlertDialogAction>
            <AlertDialogAction
              onClick={() => {
                if (pendingPrefill)
                  applyPrefillValues(
                    pendingPrefill.values,
                    "overwrite",
                    pendingPrefill.heuristicFields,
                    pendingPrefill.documentSourcedFields,
                    pendingPrefill.sourcesUsed,
                  );
                setPendingPrefill(null);
              }}
            >
              Substituir tudo
            </AlertDialogAction>

          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Sugestões da IA (cache persistido) */}
      <CaseIntakeAISuggestions
        intake={intake}
        currentLegalArea={legalArea ?? null}
        onApplyArea={applySuggestedArea}
      />

      {/* Bloco 1 */}
      <Block title="1. Identificação do caso">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <Label>Cliente</Label>
            <Input value={caseData.client_name ?? "(não vinculado)"} readOnly disabled />
          </div>
          <div>
            <Label>Área jurídica provável</Label>
            <Select
              value={legalArea || ""}
              onValueChange={(v) => form.setValue("legal_area", v, { shouldDirty: true })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                {LEGAL_AREA_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {legalArea === "outra" && (
            <div className="md:col-span-2">
              <Label>Qual área?</Label>
              <Input {...form.register("legal_area_other")} />
            </div>
          )}
          <div>
            <Label>Parte representada</Label>
            <Select
              value={form.watch("represented_party") || ""}
              onValueChange={(v) =>
                form.setValue("represented_party", v, { shouldDirty: true })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                {REPRESENTED_PARTY_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Parte contrária</Label>
            <Input
              placeholder="Nome ou descrição da parte contrária"
              {...form.register("opposing_party")}
            />
          </div>
        </div>
      </Block>

      {/* Bloco 2 */}
      <Block
        title="2. Resumo e relato"
        description="O relato é uma das principais fontes de contexto da IA."
      >
        <div>
          <Label>Resumo do problema</Label>
          <Textarea
            rows={2}
            placeholder="Ex.: Cliente relata cobrança indevida em financiamento, com possível negativação."
            {...form.register("problem_summary")}
          />
        </div>
        <div>
          <Label>Relato detalhado do cliente</Label>
          <Textarea
            rows={10}
            placeholder="Descreva com as palavras do cliente o que aconteceu, quando aconteceu, quem participou, quais documentos existem e qual resultado ele espera."
            {...form.register("client_story")}
          />
        </div>
      </Block>

      {/* Bloco 3 */}
      <Block title="3. Objetivo e urgência">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <Label>Objetivo do cliente</Label>
            <Select
              value={clientGoal || ""}
              onValueChange={(v) => form.setValue("client_goal", v, { shouldDirty: true })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                {CLIENT_GOAL_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Urgência / prazo</Label>
            <Select
              value={form.watch("urgency") || ""}
              onValueChange={(v) => form.setValue("urgency", v, { shouldDirty: true })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                {URGENCY_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {clientGoal === "outro" && (
            <div className="md:col-span-2">
              <Label>Qual objetivo?</Label>
              <Input {...form.register("client_goal_other")} />
            </div>
          )}
          <div>
            <Label>Data limite (se houver)</Label>
            <Input type="date" {...form.register("deadline_date")} />
          </div>
        </div>
      </Block>

      {/* Bloco 4 */}
      <Block title="4. Fatos, local e valores">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <Label>Período dos fatos</Label>
            <Input placeholder="Ex.: entre 2022 e 2024" {...form.register("facts_period")} />
          </div>
          <div>
            <Label>Local dos fatos</Label>
            <Input placeholder="Ex.: Londrina/PR" {...form.register("facts_location")} />
          </div>
          <div className="md:col-span-2">
            <Label>Valores envolvidos (se houver)</Label>
            <Input
              placeholder="Ex.: R$ 35.000,00 aproximadamente"
              {...form.register("amount_involved")}
            />
          </div>
        </div>
      </Block>

      {/* Bloco 5 */}
      <Block
        title="5. Provas e documentos"
        description="A IA poderá sugerir documentos complementares conforme o relato."
      >
        <div className="grid grid-cols-1 gap-4">
          <div>
            <Label>Documentos existentes</Label>
            <Textarea
              rows={3}
              placeholder="Ex.: contrato, holerites, prints de WhatsApp, laudos…"
              {...form.register("existing_documents")}
            />
          </div>
          <div>
            <Label>Documentos já enviados ao sistema (observações)</Label>
            <Textarea rows={2} {...form.register("uploaded_documents_notes")} />
          </div>
          <div>
            <Label>Documentos faltantes percebidos</Label>
            <Textarea rows={2} {...form.register("missing_documents")} />
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <Label>Testemunhas</Label>
              <Textarea rows={2} {...form.register("witnesses")} />
            </div>
            <div>
              <Label>Outras provas</Label>
              <Textarea rows={2} {...form.register("other_evidence")} />
            </div>
          </div>
        </div>
      </Block>

      {/* Bloco 6 */}
      <Block title="6. Processo judicial existente">
        <div className="flex items-center gap-3">
          <Switch
            checked={hasLawsuit === true}
            onCheckedChange={(v) =>
              form.setValue("has_existing_lawsuit", v, { shouldDirty: true })
            }
          />
          <span className="text-sm">Existe processo judicial relacionado a este caso?</span>
        </div>
        {hasLawsuit === true && (
          <div>
            <Label>Número do processo (se houver)</Label>
            <Input
              placeholder="0000000-00.0000.0.00.0000"
              {...form.register("existing_case_number")}
            />
            {caseData.case_number && (
              <p className="mt-1 text-xs text-muted-foreground">
                Este caso já tem número cadastrado: <strong>{caseData.case_number}</strong>. Use
                este campo apenas se houver processo adicional.
              </p>
            )}
          </div>
        )}
      </Block>

      {/* Bloco 7 */}
      <Block
        title="7. Observações internas do advogado"
        description="Estratégia, percepção inicial, riscos, pontos sensíveis. Não confundir com relato do cliente."
      >
        <Textarea rows={5} {...form.register("internal_notes")} />
      </Block>

      {/* Botões inferiores */}
      <div className="flex flex-wrap gap-2 pb-6">
        <Button onClick={() => handleSave(true)} disabled={isSaving}>
          {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          Salvar ficha
        </Button>
        <Button
          variant="default"
          onClick={handleSaveAndAnalyze}
          disabled={isSaving || isAnalyzing}
        >
          {isAnalyzing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wand2 className="mr-2 h-4 w-4" />}
          Salvar e analisar com IA
        </Button>
        <Button variant="outline" onClick={handleSuggest} disabled={isSaving || isSuggesting}>
          {isSuggesting ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="mr-2 h-4 w-4" />
          )}
          Sugerir área e perguntas complementares
        </Button>
      </div>
    </div>
  );
}
