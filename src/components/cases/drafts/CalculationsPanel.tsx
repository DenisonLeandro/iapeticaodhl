import { useState } from "react";
import { Download, Calculator, Check, X } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useCalculationByDraft, useCalculationItemMutation } from "@/hooks/useCaseCalculations";
import { exportCalculationXlsx } from "@/lib/xlsx/export-calculations";
import {
  isDraftInjectable,
  deriveCalculationStatus,
  computeCaseValue,
  CALCULATION_STATUS_LABEL,
  type CaseCalculationItem,
  type CalculationStatus,
} from "@/types/caseCalculation";
import { toast } from "sonner";

const CONFIDENCE_LABEL: Record<string, string> = { high: "Alta", medium: "Média", low: "Baixa" };

const STATUS_LABEL: Record<string, string> = {
  complete: "Completa",
  partial: "Parcial",
  pending_data: "Aguardando dados",
};

const CASE_VALUE_LABEL: Record<string, string> = {
  complete: "Valor da causa completo",
  partial: "Valor da causa parcial — há pedidos pendentes",
  pending: "Sem base mínima para valor da causa",
  manual: "Valor da causa definido pelo advogado",
};

const STATUS_STYLE: Record<CalculationStatus, string> = {
  calculated: "bg-emerald-600 text-white hover:bg-emerald-600",
  estimated: "bg-sky-600 text-white hover:bg-sky-600",
  manual: "bg-violet-600 text-white hover:bg-violet-600",
  pending: "bg-amber-600 text-white hover:bg-amber-600",
};

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function ManualValueEditor({
  item,
  draftId,
}: {
  item: CaseCalculationItem;
  draftId: string;
}) {
  const mutate = useCalculationItemMutation(draftId);
  const [editing, setEditing] = useState(false);
  const [raw, setRaw] = useState(item.manual_value != null ? String(item.manual_value) : "");
  const [note, setNote] = useState(item.manual_value_note ?? "");

  const save = () => {
    const parsed = raw.trim() === "" ? null : Number(raw.replace(/\./g, "").replace(",", "."));
    if (parsed != null && (!isFinite(parsed) || parsed < 0)) {
      toast.error("Informe um valor numérico válido.");
      return;
    }
    mutate.mutate(
      { kind: "manual_value", itemId: item.id, value: parsed, note: note.trim() || null },
      {
        onSuccess: () => { setEditing(false); toast.success("Valor do advogado salvo (aguardando confirmação)."); },
        onError: (e) => toast.error((e as Error).message),
      },
    );
  };

  if (!editing) {
    return (
      <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px]">
        <span className="font-semibold text-muted-foreground">Valor definido pelo advogado:</span>
        <span className="font-mono">{item.manual_value != null ? brl(item.manual_value) : "—"}</span>
        {item.manual_value != null && (
          item.manual_value_confirmed ? (
            <Badge className="bg-violet-600 text-[10px] text-white hover:bg-violet-600">Confirmado</Badge>
          ) : (
            <Badge variant="outline" className="text-[10px]">Não confirmado</Badge>
          )
        )}
        <Button size="sm" variant="ghost" className="h-6 px-2 text-[11px]" onClick={() => setEditing(true)}>
          {item.manual_value != null ? "Editar" : "Definir valor"}
        </Button>
        {item.manual_value != null && (
          <Button
            size="sm"
            variant="ghost"
            className="h-6 px-2 text-[11px]"
            disabled={mutate.isPending}
            onClick={() =>
              mutate.mutate(
                { kind: "confirm_manual", itemId: item.id, confirmed: !item.manual_value_confirmed },
                { onError: (e) => toast.error((e as Error).message) },
              )
            }
          >
            {item.manual_value_confirmed ? "Revogar confirmação" : "Confirmar valor"}
          </Button>
        )}
        {item.manual_value_note && (
          <span className="text-muted-foreground italic">({item.manual_value_note})</span>
        )}
      </div>
    );
  }

  return (
    <div className="mt-1 flex flex-wrap items-center gap-2">
      <Input
        value={raw}
        onChange={(e) => setRaw(e.target.value)}
        placeholder="0,00"
        className="h-7 w-32 text-xs"
        inputMode="decimal"
      />
      <Input
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Observação (opcional)"
        className="h-7 w-56 text-xs"
      />
      <Button size="sm" className="h-7 px-2" onClick={save} disabled={mutate.isPending}>
        <Check className="h-3 w-3" />
      </Button>
      <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => setEditing(false)}>
        <X className="h-3 w-3" />
      </Button>
    </div>
  );
}

export default function CalculationsPanel({ draftId }: { draftId: string }) {
  const { data, isLoading } = useCalculationByDraft(draftId);
  const mutate = useCalculationItemMutation(draftId);

  if (isLoading) return null;
  if (!data) return null;

  const { calculation, items } = data;
  const caseValue = computeCaseValue(items);

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

      <div className="rounded-md border p-2 text-xs">
        <div>
          Soma dos pedidos com valor utilizável:{" "}
          <strong className="text-foreground">{brl(caseValue.claim_value_sum)}</strong>
        </div>
        <div className="mt-0.5 text-muted-foreground">
          {CASE_VALUE_LABEL[caseValue.case_value_status]}
        </div>
        {caseValue.pending_claims.length > 0 && (
          <div className="mt-1 text-[11px] text-amber-700 dark:text-amber-300">
            Fora do somatório: {caseValue.pending_claims.map((p) => p.label).join("; ")}
          </div>
        )}
      </div>

      <p className="mt-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-2 text-[11px] text-amber-800 dark:text-amber-200">
        Havendo pedidos pendentes, este subtotal <strong>não</strong> é lançado automaticamente
        como valor da causa na petição — depende de confirmação expressa do advogado.
      </p>

      <div className="mt-3 space-y-2">
        {items.length === 0 && (
          <p className="text-xs text-muted-foreground">Nenhum item calculado ainda.</p>
        )}
        {items.map((it) => {
          const a = (it.assumptions ?? {}) as Record<string, unknown>;
          const source = typeof a._source === "string" ? a._source : null;
          const premise = typeof a.premissa === "string" ? a.premissa : null;
          const status = deriveCalculationStatus(it);
          const injectable = isDraftInjectable(it);
          const otherAssumptions = Object.entries(a)
            .filter(([k]) => !k.startsWith("_") && k !== "premissa")
            .map(([k, v]) => `${k}: ${typeof v === "object" ? JSON.stringify(v) : String(v)}`);
          return (
            <div key={it.id} className="rounded-md border p-2 text-xs">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="font-medium">{it.request_label}</div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className={`text-[10px] ${STATUS_STYLE[status]}`}>
                    {CALCULATION_STATUS_LABEL[status]}
                  </Badge>
                  {injectable && (
                    <Badge variant="outline" className="text-[10px]">Entra na peça</Badge>
                  )}
                  <Badge variant={it.confidence === "high" ? "default" : "outline"} className="text-[10px]">
                    {CONFIDENCE_LABEL[it.confidence] ?? it.confidence}
                  </Badge>
                </div>
              </div>

              <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px]">
                <span className="font-semibold text-muted-foreground">Valor calculado pelo sistema:</span>
                <span className="font-mono">
                  {it.estimated_value != null ? brl(it.estimated_value) : "[CALCULAR VALOR]"}
                </span>
                {it.estimated_value != null && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 px-2 text-[11px]"
                    disabled={mutate.isPending}
                    onClick={() =>
                      mutate.mutate(
                        { kind: "confirm_system", itemId: it.id, confirmed: !it.system_value_confirmed },
                        { onError: (e) => toast.error((e as Error).message) },
                      )
                    }
                  >
                    {it.system_value_confirmed ? "Revogar confirmação" : "Confirmar valor do sistema"}
                  </Button>
                )}
              </div>

              <ManualValueEditor item={it} draftId={draftId} />

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
