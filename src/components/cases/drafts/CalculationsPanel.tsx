import { Download, Calculator } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useCalculationByDraft } from "@/hooks/useCaseCalculations";
import { exportCalculationXlsx } from "@/lib/xlsx/export-calculations";
import { isDraftInjectable } from "@/types/caseCalculation";
import { toast } from "sonner";

const CONFIDENCE_LABEL: Record<string, string> = {
  high: "Alta",
  medium: "Média",
  low: "Baixa",
};

const STATUS_LABEL: Record<string, string> = {
  complete: "Completa",
  partial: "Parcial",
  pending_data: "Aguardando dados",
};

export default function CalculationsPanel({ draftId }: { draftId: string }) {
  const { data, isLoading } = useCalculationByDraft(draftId);

  if (isLoading) return null;
  if (!data) return null;

  const { calculation, items } = data;

  const handleExport = async () => {
    try {
      const r = await exportCalculationXlsx(calculation, items, `memoria-calculo-${calculation.id.slice(0, 8)}.xlsx`);
      toast.success(`Memória de cálculo exportada (${r.format.toUpperCase()}).`);
    } catch (e) {
      toast.error((e as Error).message || "Falha ao exportar.");
    }
  };

  return (
    <Card className="p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Calculator className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">Memória de cálculo estimativa</h3>
          <Badge variant="outline" className="text-xs">{STATUS_LABEL[calculation.calculation_status] ?? calculation.calculation_status}</Badge>
        </div>
        <Button size="sm" variant="outline" onClick={handleExport}>
          <Download className="mr-1 h-3 w-3" /> Exportar .xlsx
        </Button>
      </div>

      <div className="text-xs text-muted-foreground">
        Total estimado:{" "}
        <strong className="text-foreground">
          {calculation.total_estimated_value != null
            ? calculation.total_estimated_value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
            : "—"}
        </strong>
      </div>

      <p className="mt-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-2 text-[11px] text-amber-800 dark:text-amber-200">
        Estas estimativas são ferramenta de apoio. Valores só entram automaticamente na petição
        quando marcados como <strong>Pronto para peça</strong>. Os demais devem ser conferidos
        antes do protocolo.
      </p>

      <div className="mt-3 space-y-2">
        {items.length === 0 && (
          <p className="text-xs text-muted-foreground">Nenhum item calculado ainda.</p>
        )}
        {items.map((it) => {
          const a = (it.assumptions ?? {}) as Record<string, unknown>;
          const source = typeof a._source === "string" ? a._source : null;
          const premise = typeof a.premissa === "string" ? a.premissa : null;
          const injectable = isDraftInjectable(it);
          const otherAssumptions = Object.entries(a)
            .filter(([k]) => !k.startsWith("_") && k !== "premissa")
            .map(([k, v]) => `${k}: ${typeof v === "object" ? JSON.stringify(v) : String(v)}`);
          return (
            <div key={it.id} className="rounded-md border p-2 text-xs">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="font-medium">{it.request_label}</div>
                <div className="flex flex-wrap items-center gap-2">
                  {injectable ? (
                    <Badge className="bg-emerald-600 text-[10px] text-white hover:bg-emerald-600">Pronto para peça</Badge>
                  ) : (
                    <Badge variant="outline" className="border-amber-500/60 text-[10px] text-amber-700 dark:text-amber-300" title="Este valor não entra automaticamente na petição — revisar antes do protocolo.">
                      Somente memória — revisar
                    </Badge>
                  )}
                  <Badge variant={it.confidence === "high" ? "default" : "outline"} className="text-[10px]">
                    {CONFIDENCE_LABEL[it.confidence] ?? it.confidence}
                  </Badge>
                  <span className="font-mono">
                    {it.estimated_value != null
                      ? it.estimated_value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
                      : "[CALCULAR VALOR]"}
                  </span>
                </div>
              </div>
              {it.legal_basis && <div className="mt-0.5 text-muted-foreground">{it.legal_basis}</div>}
              {it.formula && <div className="mt-0.5 font-mono text-[11px] text-muted-foreground">Fórmula: {it.formula}</div>}
              {source && (
                <div className="mt-1 text-[11px]">
                  <span className="font-semibold text-muted-foreground">Fonte dos dados: </span>
                  <span>{source}</span>
                </div>
              )}
              {premise && (
                <div className="mt-1 text-[11px]">
                  <span className="font-semibold text-muted-foreground">Premissa: </span>
                  <span>{premise}</span>
                </div>
              )}
              {otherAssumptions.length > 0 && (
                <div className="mt-1 text-[11px] text-muted-foreground">
                  <span className="font-semibold">Premissas técnicas: </span>{otherAssumptions.join("; ")}
                </div>
              )}
              {Array.isArray(it.missing_fields) && it.missing_fields.length > 0 && (
                <div className="mt-1 text-[11px] text-amber-700 dark:text-amber-300">
                  Faltam: {it.missing_fields.join("; ")}
                </div>
              )}
              {it.notes && (
                <div className="mt-1 text-[11px] italic text-muted-foreground">
                  <span className="font-semibold not-italic">Observações jurídicas: </span>{it.notes}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <p className="mt-3 text-[11px] italic text-muted-foreground">
        Cálculos determinísticos, sem IA. Valores estimativos, sujeitos à liquidação com documentos.
      </p>
    </Card>
  );
}
