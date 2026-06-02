import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import type { ClientFile } from "@/types/client";
import {
  REPRESENTED_PARTY_LABELS,
  isRepresentedParty,
} from "@/lib/represented-party";

interface Props {
  file: ClientFile | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const SECTION_LABELS: { key: string; label: string; list: boolean }[] = [
  { key: "perspectiva_da_analise", label: "Perspectiva da análise", list: false },
  { key: "parte_contraria", label: "Parte contrária", list: false },
  { key: "fase_processual", label: "Fase processual", list: false },
  { key: "partes_identificadas", label: "Partes identificadas", list: true },
  { key: "pedidos_principais", label: "Pedidos principais", list: true },
  { key: "teses_da_parte_contraria", label: "Teses da parte contrária", list: true },
  { key: "decisoes_despachos", label: "Decisões e despachos", list: true },
  { key: "documentos_relevantes", label: "Documentos relevantes", list: true },
  { key: "provas_identificadas", label: "Provas identificadas", list: true },
  {
    key: "pontos_favoraveis_a_parte_representada",
    label: "Pontos favoráveis à parte representada",
    list: true,
  },
  {
    key: "pontos_de_risco_para_parte_representada",
    label: "Pontos de risco para a parte representada",
    list: true,
  },
  {
    key: "estrategia_recomendada_para_parte_representada",
    label: "Estratégia recomendada",
    list: false,
  },
  { key: "sugestao_de_peticao_cabivel", label: "Sugestão de petição cabível", list: false },
  { key: "informacoes_nao_encontradas", label: "Informações não encontradas", list: true },
  { key: "observacoes", label: "Observações", list: false },
  { key: "resumo_geral", label: "Resumo geral", list: false },
];

function renderValue(value: unknown, list: boolean) {
  if (list && Array.isArray(value)) {
    if (value.length === 0) return <p className="text-xs text-muted-foreground">—</p>;
    return (
      <ul className="list-disc space-y-1 pl-5 text-sm">
        {value.map((v, i) => (
          <li key={i}>{String(v)}</li>
        ))}
      </ul>
    );
  }
  if (typeof value === "string" && value.trim()) {
    return <p className="whitespace-pre-wrap text-sm">{value}</p>;
  }
  return <p className="text-xs text-muted-foreground">—</p>;
}

export default function FileAnalysisDialog({ file, open, onOpenChange }: Props) {
  if (!file) return null;
  const analysis = (file.analysis_json ?? null) as Record<string, unknown> | null;
  const summary = file.analysis_summary ?? "";

  const partyRaw =
    (analysis?.parte_representada as string | undefined) ?? file.represented_party ?? null;
  const partyLabel =
    partyRaw && isRepresentedParty(partyRaw)
      ? REPRESENTED_PARTY_LABELS[partyRaw]
      : partyRaw ?? null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="truncate">Análise: {file.file_name}</DialogTitle>
          <DialogDescription>
            {file.processed_at
              ? `Analisado em ${new Date(file.processed_at).toLocaleString("pt-BR")}`
              : "Análise não disponível"}
            <span className="ml-2">
              <Badge variant="outline" className="font-normal">
                Revisão obrigatória pelo advogado
              </Badge>
            </span>
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[65vh] pr-4">
          {partyLabel && (
            <div className="mb-3">
              <Badge variant="default" className="font-normal">
                Perspectiva: {partyLabel}
              </Badge>
            </div>
          )}

          {summary && (
            <section className="mb-4 rounded-md border border-border bg-muted/40 p-4">
              <h3 className="mb-2 text-sm font-semibold">Resumo para o advogado</h3>
              <p className="whitespace-pre-wrap text-sm">{summary}</p>
            </section>
          )}

          {analysis ? (
            <Accordion
              type="multiple"
              defaultValue={[
                "perspectiva_da_analise",
                "pedidos_principais",
                "pontos_favoraveis_a_parte_representada",
                "pontos_de_risco_para_parte_representada",
              ]}
            >
              {SECTION_LABELS.map(({ key, label, list }) => (
                <AccordionItem key={key} value={key}>
                  <AccordionTrigger className="text-sm">{label}</AccordionTrigger>
                  <AccordionContent>{renderValue(analysis[key], list)}</AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          ) : (
            <p className="text-sm text-muted-foreground">Sem dados estruturados.</p>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
