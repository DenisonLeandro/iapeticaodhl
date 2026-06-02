// =============================================================================
// StepDocumentData — Step 2: Contextual data form (expanded)
// Story 2.2 — Document Generation Flow
// =============================================================================

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState, useMemo } from "react";
import { Check, ChevronsUpDown, Mic, FileSearch } from "lucide-react";
import VoiceFillDialog from "@/components/ai/VoiceFillDialog";
import OCRUploadDialog from "@/components/shared/OCRUploadDialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { maskCPF, maskCNPJ } from "@/schemas/client.schema";
import {
  documentGenerationSchema,
  type DocumentGenerationFormData,
} from "@/lib/validators/document-generation";
import type { DocumentType } from "@/types/ai";
import { useClients } from "@/hooks/useClients";
import { useClientCases } from "@/hooks/useClientDetail";
import {
  buildPetitionContextFromClientCaseAndDocuments,
  type AutoFillField,
  type FieldSource,
} from "@/lib/ai/buildPetitionContext";



interface StepDocumentDataProps {
  documentType: DocumentType;
  initialData: Partial<DocumentGenerationFormData> | null;
  onSubmit: (data: DocumentGenerationFormData) => void;
  formRef: React.RefObject<HTMLFormElement | null>;
}

const TRIBUNAIS = [
  { value: "STF", label: "STF — Supremo Tribunal Federal" },
  { value: "STJ", label: "STJ — Superior Tribunal de Justiça" },
  { value: "TST", label: "TST — Tribunal Superior do Trabalho" },
  { value: "TSE", label: "TSE — Tribunal Superior Eleitoral" },
  { value: "STM", label: "STM — Superior Tribunal Militar" },
  { value: "TJPE", label: "TJPE — Tribunal de Justiça de Pernambuco" },
  { value: "TJSP", label: "TJSP — Tribunal de Justiça de São Paulo" },
  { value: "TJRJ", label: "TJRJ — Tribunal de Justiça do Rio de Janeiro" },
  { value: "TJMG", label: "TJMG — Tribunal de Justiça de Minas Gerais" },
  { value: "TRF-1", label: "TRF-1 — Tribunal Regional Federal da 1ª Região" },
  { value: "TRF-2", label: "TRF-2 — Tribunal Regional Federal da 2ª Região" },
  { value: "TRF-3", label: "TRF-3 — Tribunal Regional Federal da 3ª Região" },
  { value: "TRF-4", label: "TRF-4 — Tribunal Regional Federal da 4ª Região" },
  { value: "TRF-5", label: "TRF-5 — Tribunal Regional Federal da 5ª Região" },
  { value: "Outro", label: "Outro" },
];

const ESTADOS_CIVIS = [
  "Solteiro(a)", "Casado(a)", "Divorciado(a)", "Viúvo(a)", "União Estável",
];

const TIPOS_CONTRATO = [
  { value: "prestacao_servicos", label: "Prestação de Serviços" },
  { value: "compra_venda", label: "Compra e Venda" },
  { value: "locacao", label: "Locação" },
  { value: "parceria", label: "Parceria" },
  { value: "outro", label: "Outro" },
];

// Helper categories
const isPetition = (t: DocumentType) => t === "petition";
const isContestation = (t: DocumentType) => t === "contestation";
const isRecurso = (t: DocumentType) =>
  ["appeal", "injunction_appeal", "internal_appeal", "special_appeal", "extraordinary_appeal"].includes(t);
const isEmbargos = (t: DocumentType) => t === "declaration_objection";
const isContract = (t: DocumentType) => t === "contract";
const isNotification = (t: DocumentType) => t === "notification";
const needsProcessNumber = (t: DocumentType) => t !== "petition" && t !== "contract" && t !== "notification" && t !== "requirement";

export default function StepDocumentData({
  documentType,
  initialData,
  onSubmit,
  formRef,
}: StepDocumentDataProps) {
  const { clients } = useClients({ page: 1, pageSize: 200 });
  const [clientPopoverOpen, setClientPopoverOpen] = useState(false);
  const [clientSearch, setClientSearch] = useState("");
  const [voiceDialogOpen, setVoiceDialogOpen] = useState(false);
  const [ocrDialogOpen, setOcrDialogOpen] = useState(false);
  const [fieldSources, setFieldSources] = useState<Partial<Record<AutoFillField, FieldSource>>>({});
  const [contextAlerts, setContextAlerts] = useState<
    Array<{ field: AutoFillField | "geral"; message: string; severity: "info" | "warn" }>
  >([]);



  const handleVoiceExtracted = (data: Partial<DocumentGenerationFormData>) => {
    // Apply all extracted fields to the form
    const flatFields = ["fatos", "fundamentacao", "tribunal", "vara", "numeroProcesso",
      "pedidos", "valorCausa", "instrucoesAdicionais", "preliminares", "impugnacaoFatos",
      "direitoReu", "pedidosReu", "decisaoRecorrida", "dataDecisao", "razoesRecurso",
      "pedidoReforma", "ondeVicio", "esclarecimentoPretendido", "tipoContrato",
      "objetoContrato", "obrigacoes", "valorContrato", "formaPagamento", "prazoContrato",
      "dataInicio", "dataFim", "clausulaRescisao", "foroEleicao",
      "destinatarioNotificacao", "prazoResposta", "provas"] as const;

    for (const key of flatFields) {
      if (data[key]) form.setValue(key, data[key] as string);
    }

    // Nested autor/reu
    if (data.autor) {
      if (data.autor.nome) form.setValue("autor.nome", data.autor.nome);
      if (data.autor.cpfCnpj) form.setValue("autor.cpfCnpj", data.autor.cpfCnpj);
      if (data.autor.endereco) form.setValue("autor.endereco", data.autor.endereco);
      if (data.autor.profissao) form.setValue("autor.profissao", data.autor.profissao);
      if (data.autor.estadoCivil) form.setValue("autor.estadoCivil", data.autor.estadoCivil);
    }
    if (data.reu) {
      if (data.reu.nome) form.setValue("reu.nome", data.reu.nome);
      if (data.reu.cpfCnpj) form.setValue("reu.cpfCnpj", data.reu.cpfCnpj);
      if (data.reu.endereco) form.setValue("reu.endereco", data.reu.endereco);
      if (data.reu.profissao) form.setValue("reu.profissao", data.reu.profissao);
      if (data.reu.estadoCivil) form.setValue("reu.estadoCivil", data.reu.estadoCivil);
    }
  };

  const form = useForm<DocumentGenerationFormData>({
    resolver: zodResolver(documentGenerationSchema),
    defaultValues: {
      documentType,
      autor: { nome: "", cpfCnpj: "", endereco: "", profissao: "", estadoCivil: "" },
      reu: { nome: "", cpfCnpj: "", endereco: "", profissao: "", estadoCivil: "" },
      fatos: "",
      fundamentacao: "",
      tribunal: undefined,
      vara: "",
      numeroProcesso: "",
      clienteVinculadoId: "",
      caseId: "",
      selectedAnalysisFileIds: [],

      instrucoesAdicionais: "",
      pedidos: "",
      valorCausa: "",
      provas: "",
      justicaGratuita: false,
      preliminares: "",
      impugnacaoFatos: "",
      direitoReu: "",
      pedidosReu: "",
      decisaoRecorrida: "",
      dataDecisao: "",
      razoesRecurso: "",
      pedidoReforma: "",
      comprovarPreparo: false,
      vicioObscuridade: false,
      vicioContradicao: false,
      vicioOmissao: false,
      ondeVicio: "",
      esclarecimentoPretendido: "",
      tipoContrato: "",
      objetoContrato: "",
      obrigacoes: "",
      valorContrato: "",
      formaPagamento: "",
      prazoContrato: "",
      dataInicio: "",
      dataFim: "",
      clausulaRescisao: "",
      foroEleicao: "",
      destinatarioNotificacao: "",
      prazoResposta: "",
      ...initialData,
    },
  });

  useEffect(() => {
    form.setValue("documentType", documentType);
  }, [documentType, form]);

  /**
   * Aplica um contexto consolidado ao formulário respeitando dirtyFields.
   * Não marca os campos como dirty (shouldDirty: false).
   */
  const applyContext = (
    client: Parameters<typeof buildPetitionContextFromClientCaseAndDocuments>[0]["client"],
    caseRow: Parameters<typeof buildPetitionContextFromClientCaseAndDocuments>[0]["caseRow"],
  ) => {
    const dirtyFields = form.formState.dirtyFields as Record<string, unknown>;
    const isDirty = (path: string) => {
      // dirtyFields para campos aninhados vem como { autor: { nome: true } }
      const parts = path.split(".");
      let node: unknown = dirtyFields;
      for (const p of parts) {
        if (!node || typeof node !== "object") return false;
        node = (node as Record<string, unknown>)[p];
      }
      return Boolean(node);
    };

    const ctx = buildPetitionContextFromClientCaseAndDocuments({
      client: client ?? null,
      caseRow: caseRow ?? null,
      dirtyFields: {
        "autor.nome": isDirty("autor.nome"),
        "autor.cpfCnpj": isDirty("autor.cpfCnpj"),
        "autor.endereco": isDirty("autor.endereco"),
        "reu.nome": isDirty("reu.nome"),
        numeroProcesso: isDirty("numeroProcesso"),
        tribunal: isDirty("tribunal"),
        vara: isDirty("vara"),
        assunto: isDirty("assunto"),
        representedParty: isDirty("representedParty"),
      },
    });

    // Aplica somente os campos que foram resolvidos no contexto (i.e., não-manuais com valor).
    for (const [field, value] of Object.entries(ctx.values)) {
      if (value === undefined || value === "") continue;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      form.setValue(field as any, value as any, { shouldDirty: false, shouldValidate: false });
    }

    // Atualiza badges de origem (preserva sources de campos não tocados nesta chamada).
    setFieldSources((prev) => ({ ...prev, ...ctx.sources }));
    setContextAlerts(ctx.alerts);
  };

  const SourceBadge = ({ field }: { field: AutoFillField }) => {
    const source = fieldSources[field];
    if (!source || source === "manual" || source === "default") return null;
    const label =
      source === "case"
        ? "preenchido a partir do processo"
        : source === "client"
        ? "preenchido a partir do cliente"
        : "sugerido pela análise do PDF";
    return <p className="mt-1 text-[11px] text-muted-foreground italic">{label}</p>;
  };



  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-foreground">Dados do Documento</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Preencha as informações necessárias para a geração do documento.
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <Button
            type="button"
            variant="outline"
            className="gap-2"
            onClick={() => setOcrDialogOpen(true)}
          >
            <FileSearch className="h-4 w-4" />
            Preencher por Documento
          </Button>
          <Button
            type="button"
            variant="outline"
            className="gap-2"
            onClick={() => setVoiceDialogOpen(true)}
          >
            <Mic className="h-4 w-4" />
            Preencher por voz
          </Button>
        </div>
      </div>

      <VoiceFillDialog
        open={voiceDialogOpen}
        onOpenChange={setVoiceDialogOpen}
        onExtracted={handleVoiceExtracted}
      />

      <OCRUploadDialog
        open={ocrDialogOpen}
        onOpenChange={setOcrDialogOpen}
        context="petition"
        onExtracted={handleVoiceExtracted as (data: Record<string, unknown>) => void}
      />

      <Form {...form}>
        <form ref={formRef} onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">

          {/* Cliente vinculado — Combobox com busca */}
          <FormField
            control={form.control}
            name="clienteVinculadoId"
            render={({ field }) => {
              const selectedClient = clients?.find((c) => c.id === field.value);
              const filteredClients = (clients ?? []).filter((c) => {
                if (!clientSearch) return true;
                const term = clientSearch.toLowerCase();
                return (
                  c.full_name.toLowerCase().includes(term) ||
                  (c.document_number ?? "").includes(term.replace(/\D/g, "")) ||
                  (c.email ?? "").toLowerCase().includes(term)
                );
              });

              const handleSelectClient = (clientId: string) => {
                const client = clients?.find((c) => c.id === clientId);
                if (!client) return;
                field.onChange(clientId);
                // Auto-fill via helper (respeita dirtyFields, não sobrescreve manual)
                applyContext(client, null);
                setClientPopoverOpen(false);
                setClientSearch("");
              };


              return (
                <FormItem className="flex flex-col">
                  <FormLabel>Cliente Vinculado</FormLabel>
                  <Popover open={clientPopoverOpen} onOpenChange={setClientPopoverOpen}>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant="outline"
                          role="combobox"
                          aria-expanded={clientPopoverOpen}
                          className={cn(
                            "w-full justify-between font-normal",
                            !field.value && "text-muted-foreground"
                          )}
                        >
                          {selectedClient
                            ? selectedClient.full_name
                            : "Buscar por nome, CPF/CNPJ ou email..."}
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                      <Command shouldFilter={false}>
                        <CommandInput
                          placeholder="Digite nome, CPF/CNPJ ou email..."
                          value={clientSearch}
                          onValueChange={setClientSearch}
                        />
                        <CommandList>
                          <CommandEmpty>Nenhum cliente encontrado.</CommandEmpty>
                          <CommandGroup>
                            {filteredClients.map((c) => (
                              <CommandItem
                                key={c.id}
                                value={c.id}
                                onSelect={() => handleSelectClient(c.id)}
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    field.value === c.id ? "opacity-100" : "opacity-0"
                                  )}
                                />
                                <div className="flex flex-col">
                                  <span className="font-medium">{c.full_name}</span>
                                  <span className="text-xs text-muted-foreground">
                                    {c.document_number
                                      ? (c.document_type === "cnpj" ? maskCNPJ(c.document_number) : maskCPF(c.document_number))
                                      : ""}
                                    {c.document_number && c.email ? " · " : ""}
                                    {c.email ?? ""}
                                  </span>
                                </div>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              );
            }}
          />

          {/* Processo vinculado — depende do cliente */}
          <FormField
            control={form.control}
            name="caseId"
            render={({ field }) => {
              const clienteId = form.watch("clienteVinculadoId") || undefined;
              // eslint-disable-next-line react-hooks/rules-of-hooks
              const { cases: clientCases, isLoading: loadingCases } = useClientCases(clienteId);

              const handleSelect = (value: string) => {
                if (value === "__none__") {
                  field.onChange("");
                  form.setValue("selectedAnalysisFileIds", []);
                  return;
                }
                field.onChange(value);
                form.setValue("selectedAnalysisFileIds", []);
                const c = clientCases.find((x) => x.id === value);
                const client = clients?.find((cli) => cli.id === clienteId);
                // Aplica via helper: fix bug de `vara` (agora usa `branch`), mapeia tribunal,
                // preenche réu, assunto e representedParty.
                applyContext(client ?? null, c ?? null);
              };


              return (
                <FormItem>
                  <FormLabel>Processo vinculado</FormLabel>
                  {!clienteId ? (
                    <p className="text-xs text-muted-foreground">
                      Selecione um cliente acima para listar os processos.
                    </p>
                  ) : loadingCases ? (
                    <p className="text-xs text-muted-foreground">Carregando processos...</p>
                  ) : clientCases.length === 0 ? (
                    <p className="text-xs text-muted-foreground">
                      Este cliente ainda não possui processos cadastrados.
                    </p>
                  ) : (
                    <Select value={field.value || "__none__"} onValueChange={handleSelect}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione um processo..." />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="__none__">Não vincular</SelectItem>
                        {clientCases.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.case_number}
                            {c.court ? ` — ${c.court}` : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  <FormMessage />
                </FormItem>
              );
            }}
          />



          {/* Número do processo */}
          {needsProcessNumber(documentType) && (
            <FormField
              control={form.control}
              name="numeroProcesso"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Número do Processo</FormLabel>
                  <FormControl>
                    <Input placeholder="0000000-00.0000.0.00.0000" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}

          <Separator />

          {/* ===== PARTES ENVOLVIDAS ===== */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-foreground">Qualificação do Autor</h3>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <FormField control={form.control} name="autor.nome" render={({ field }) => (
                <FormItem><FormLabel>Nome *</FormLabel><FormControl><Input placeholder="Nome completo" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="autor.cpfCnpj" render={({ field }) => (
                <FormItem><FormLabel>CPF/CNPJ</FormLabel><FormControl><Input placeholder="000.000.000-00" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
            </div>
            {isPetition(documentType) && (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <FormField control={form.control} name="autor.endereco" render={({ field }) => (
                  <FormItem><FormLabel>Endereço</FormLabel><FormControl><Input placeholder="Endereço completo" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="autor.profissao" render={({ field }) => (
                  <FormItem><FormLabel>Profissão</FormLabel><FormControl><Input placeholder="Profissão" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="autor.estadoCivil" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Estado Civil</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger></FormControl>
                      <SelectContent>
                        {ESTADOS_CIVIS.map((e) => <SelectItem key={e} value={e}>{e}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
            )}
          </div>

          <div className="space-y-4">
            <h3 className="text-sm font-medium text-foreground">Qualificação do Réu</h3>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <FormField control={form.control} name="reu.nome" render={({ field }) => (
                <FormItem><FormLabel>Nome do Réu</FormLabel><FormControl><Input placeholder="Nome completo do réu" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="reu.cpfCnpj" render={({ field }) => (
                <FormItem><FormLabel>CPF/CNPJ do Réu</FormLabel><FormControl><Input placeholder="000.000.000-00" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
            </div>
            {isPetition(documentType) && (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <FormField control={form.control} name="reu.endereco" render={({ field }) => (
                  <FormItem><FormLabel>Endereço</FormLabel><FormControl><Input placeholder="Endereço completo" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="reu.profissao" render={({ field }) => (
                  <FormItem><FormLabel>Profissão</FormLabel><FormControl><Input placeholder="Profissão" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="reu.estadoCivil" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Estado Civil</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger></FormControl>
                      <SelectContent>
                        {ESTADOS_CIVIS.map((e) => <SelectItem key={e} value={e}>{e}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
            )}
          </div>

          <Separator />

          {/* ===== FATOS E FUNDAMENTAÇÃO ===== */}
          <div className="space-y-4">
            <FormField control={form.control} name="fatos" render={({ field }) => (
              <FormItem>
                <FormLabel>Dos Fatos *</FormLabel>
                <FormControl>
                  <Textarea placeholder="Descreva os fatos relevantes do caso com detalhes (mínimo 50 caracteres)..." className="min-h-[120px]" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="fundamentacao" render={({ field }) => (
              <FormItem>
                <FormLabel>Do Direito / Fundamentação Jurídica</FormLabel>
                <FormControl>
                  <Textarea placeholder="Artigos de lei, jurisprudência ou doutrina (opcional)..." className="min-h-[80px]" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />
          </div>

          {/* ===== PETIÇÃO INICIAL — Art. 319 CPC ===== */}
          {isPetition(documentType) && (
            <>
              <Separator />
              <div className="space-y-4">
                <h3 className="text-sm font-medium text-foreground">Pedidos e Valor (Art. 319 CPC)</h3>
                <FormField control={form.control} name="pedidos" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Dos Pedidos</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Liste os pedidos numerados (ex: 1. Condenar o réu ao pagamento...)" className="min-h-[100px]" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <FormField control={form.control} name="valorCausa" render={({ field }) => (
                    <FormItem><FormLabel>Valor da Causa (R$)</FormLabel><FormControl><Input placeholder="R$ 0,00" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="provas" render={({ field }) => (
                    <FormItem><FormLabel>Provas que pretende produzir</FormLabel><FormControl><Input placeholder="Documental, testemunhal, pericial..." {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                </div>
                <FormField control={form.control} name="justicaGratuita" render={({ field }) => (
                  <FormItem className="flex flex-row items-center gap-3 space-y-0">
                    <FormControl>
                      <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                    <FormLabel className="font-normal">Requerer Justiça Gratuita (Art. 98 CPC)</FormLabel>
                  </FormItem>
                )} />
              </div>
            </>
          )}

          {/* ===== CONTESTAÇÃO ===== */}
          {isContestation(documentType) && (
            <>
              <Separator />
              <div className="space-y-4">
                <h3 className="text-sm font-medium text-foreground">Dados da Contestação</h3>
                <FormField control={form.control} name="preliminares" render={({ field }) => (
                  <FormItem><FormLabel>Preliminares</FormLabel><FormControl><Textarea placeholder="Incompetência, ilegitimidade, litispendência..." className="min-h-[80px]" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="impugnacaoFatos" render={({ field }) => (
                  <FormItem><FormLabel>Impugnação dos Fatos</FormLabel><FormControl><Textarea placeholder="Impugne cada fato alegado pelo autor..." className="min-h-[100px]" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="direitoReu" render={({ field }) => (
                  <FormItem><FormLabel>Do Direito do Réu</FormLabel><FormControl><Textarea placeholder="Fundamentação jurídica da defesa..." className="min-h-[80px]" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="pedidosReu" render={({ field }) => (
                  <FormItem><FormLabel>Pedidos do Réu</FormLabel><FormControl><Textarea placeholder="Pedidos da parte ré..." className="min-h-[80px]" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
              </div>
            </>
          )}

          {/* ===== RECURSOS ===== */}
          {isRecurso(documentType) && (
            <>
              <Separator />
              <div className="space-y-4">
                <h3 className="text-sm font-medium text-foreground">Dados do Recurso</h3>
                <FormField control={form.control} name="decisaoRecorrida" render={({ field }) => (
                  <FormItem><FormLabel>Decisão Recorrida</FormLabel><FormControl><Textarea placeholder="Transcreva ou resuma a decisão que se pretende reformar..." className="min-h-[100px]" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="dataDecisao" render={({ field }) => (
                  <FormItem><FormLabel>Data da Decisão Recorrida</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="razoesRecurso" render={({ field }) => (
                  <FormItem><FormLabel>Razões do Recurso</FormLabel><FormControl><Textarea placeholder="Fundamentos para reforma da decisão..." className="min-h-[100px]" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="pedidoReforma" render={({ field }) => (
                  <FormItem><FormLabel>Pedido de Reforma</FormLabel><FormControl><Textarea placeholder="O que se pede ao tribunal ad quem..." className="min-h-[80px]" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="comprovarPreparo" render={({ field }) => (
                  <FormItem className="flex flex-row items-center gap-3 space-y-0">
                    <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                    <FormLabel className="font-normal">Anexar comprovante de preparo depois</FormLabel>
                  </FormItem>
                )} />
              </div>
            </>
          )}

          {/* ===== EMBARGOS DE DECLARAÇÃO ===== */}
          {isEmbargos(documentType) && (
            <>
              <Separator />
              <div className="space-y-4">
                <h3 className="text-sm font-medium text-foreground">Embargos de Declaração</h3>
                <div className="flex flex-wrap gap-6">
                  <FormField control={form.control} name="vicioObscuridade" render={({ field }) => (
                    <FormItem className="flex flex-row items-center gap-2 space-y-0">
                      <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                      <FormLabel className="font-normal">Obscuridade</FormLabel>
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="vicioContradicao" render={({ field }) => (
                    <FormItem className="flex flex-row items-center gap-2 space-y-0">
                      <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                      <FormLabel className="font-normal">Contradição</FormLabel>
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="vicioOmissao" render={({ field }) => (
                    <FormItem className="flex flex-row items-center gap-2 space-y-0">
                      <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                      <FormLabel className="font-normal">Omissão</FormLabel>
                    </FormItem>
                  )} />
                </div>
                <FormField control={form.control} name="ondeVicio" render={({ field }) => (
                  <FormItem><FormLabel>Onde está o vício</FormLabel><FormControl><Textarea placeholder="Indique onde está a obscuridade, contradição ou omissão..." className="min-h-[80px]" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="esclarecimentoPretendido" render={({ field }) => (
                  <FormItem><FormLabel>Esclarecimento Pretendido</FormLabel><FormControl><Textarea placeholder="O que se pretende que seja esclarecido..." className="min-h-[80px]" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
              </div>
            </>
          )}

          {/* ===== CONTRATOS ===== */}
          {isContract(documentType) && (
            <>
              <Separator />
              <div className="space-y-4">
                <h3 className="text-sm font-medium text-foreground">Dados do Contrato</h3>
                <FormField control={form.control} name="tipoContrato" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo de Contrato</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Selecione o tipo" /></SelectTrigger></FormControl>
                      <SelectContent>
                        {TIPOS_CONTRATO.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="objetoContrato" render={({ field }) => (
                  <FormItem><FormLabel>Objeto do Contrato</FormLabel><FormControl><Textarea placeholder="Descrição detalhada do objeto contratual..." className="min-h-[80px]" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="obrigacoes" render={({ field }) => (
                  <FormItem><FormLabel>Obrigações das Partes</FormLabel><FormControl><Textarea placeholder="Descreva as obrigações de cada parte..." className="min-h-[80px]" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <FormField control={form.control} name="valorContrato" render={({ field }) => (
                    <FormItem><FormLabel>Valor</FormLabel><FormControl><Input placeholder="R$ 0,00" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="formaPagamento" render={({ field }) => (
                    <FormItem><FormLabel>Forma de Pagamento</FormLabel><FormControl><Input placeholder="PIX, boleto, etc." {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                </div>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <FormField control={form.control} name="dataInicio" render={({ field }) => (
                    <FormItem><FormLabel>Data de Início</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="dataFim" render={({ field }) => (
                    <FormItem><FormLabel>Data de Término</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                </div>
                <FormField control={form.control} name="clausulaRescisao" render={({ field }) => (
                  <FormItem><FormLabel>Cláusula de Rescisão</FormLabel><FormControl><Textarea placeholder="Condições para rescisão contratual..." className="min-h-[60px]" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="foroEleicao" render={({ field }) => (
                  <FormItem><FormLabel>Foro de Eleição</FormLabel><FormControl><Input placeholder="Comarca de..." {...field} /></FormControl><FormMessage /></FormItem>
                )} />
              </div>
            </>
          )}

          {/* ===== NOTIFICAÇÃO EXTRAJUDICIAL ===== */}
          {isNotification(documentType) && (
            <>
              <Separator />
              <div className="space-y-4">
                <h3 className="text-sm font-medium text-foreground">Dados da Notificação</h3>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <FormField control={form.control} name="destinatarioNotificacao" render={({ field }) => (
                    <FormItem><FormLabel>Destinatário</FormLabel><FormControl><Input placeholder="Nome do destinatário" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="prazoResposta" render={({ field }) => (
                    <FormItem><FormLabel>Prazo para Resposta</FormLabel><FormControl><Input placeholder="Ex: 15 dias" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                </div>
              </div>
            </>
          )}

          <Separator />

          {/* ===== TRIBUNAL E VARA ===== */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <FormField control={form.control} name="tribunal" render={({ field }) => (
              <FormItem>
                <FormLabel>Tribunal *</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl><SelectTrigger><SelectValue placeholder="Selecione o tribunal" /></SelectTrigger></FormControl>
                  <SelectContent>
                    {TRIBUNAIS.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="vara" render={({ field }) => (
              <FormItem><FormLabel>Vara / Câmara</FormLabel><FormControl><Input placeholder="Ex: 2ª Vara Cível da Comarca do Recife" {...field} /></FormControl><FormMessage /></FormItem>
            )} />
          </div>

          <Separator />

          {/* ===== INSTRUÇÕES ADICIONAIS ===== */}
          <FormField control={form.control} name="instrucoesAdicionais" render={({ field }) => (
            <FormItem>
              <FormLabel>Instruções Adicionais para a IA</FormLabel>
              <FormControl>
                <Textarea placeholder="Instruções extras: tom, estilo, pontos específicos a abordar (opcional)..." className="min-h-[80px]" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )} />
        </form>
      </Form>
    </div>
  );
}
