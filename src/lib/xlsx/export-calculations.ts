// =============================================================================
// PR-4.4B.2 — Exportação da memória de cálculo em .xlsx (usa SheetJS).
// Se `xlsx` não estiver disponível, cai para CSV automaticamente.
// =============================================================================
import type { CaseCalculationItem, CaseCalculation } from "@/types/caseCalculation";

function fmt(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const HEADERS = [
  "Pedido", "Fundamento", "Fórmula", "Dados",
  "Fonte dos dados", "Confiança", "Uso na peça", "Premissas", "Período",
  "Valor (R$)", "Faltantes", "Observações jurídicas",
];

function rowsFor(items: CaseCalculationItem[]) {
  return items.map((i) => {
    const a = (i.assumptions ?? {}) as Record<string, unknown>;
    const source = typeof a._source === "string" ? (a._source as string) : "";
    const premise = typeof a.premissa === "string" ? (a.premissa as string) : "";
    const injectable = a._draft_injectable === true && i.estimated_value != null;
    const otherAssumptions = Object.entries(a)
      .filter(([k]) => !k.startsWith("_") && k !== "premissa")
      .map(([k, v]) => `${k}: ${typeof v === "object" ? JSON.stringify(v) : String(v)}`)
      .join("; ");
    const premisesCombined = [premise, otherAssumptions].filter(Boolean).join(" | ");
    return [
      i.request_label,
      i.legal_basis ?? "",
      i.formula ?? "",
      fmt(i.input_data),
      source,
      i.confidence,
      injectable ? "Pronto para peça" : "Somente memória",
      premisesCombined,
      i.period ?? "",
      i.estimated_value ?? "",
      Array.isArray(i.missing_fields) ? i.missing_fields.join("; ") : "",
      i.notes ?? "",
    ];
  });
}

export async function exportCalculationXlsx(
  calc: CaseCalculation,
  items: CaseCalculationItem[],
  filename = "memoria-de-calculo.xlsx",
) {
  try {
    const XLSX = await import("xlsx");
    const wb = XLSX.utils.book_new();
    const rows = rowsFor(items);
    const summary = [
      ["Status", calc.calculation_status],
      ["Total estimado (R$)", calc.total_estimated_value ?? ""],
      ["Gerado em", new Date(calc.created_at).toLocaleString("pt-BR")],
      [],
      ["Premissas gerais:"],
      [fmt(calc.assumptions)],
    ];
    const ws1 = XLSX.utils.aoa_to_sheet([...summary, [], HEADERS, ...rows]);
    XLSX.utils.book_append_sheet(wb, ws1, "Memória de Cálculo");
    XLSX.writeFile(wb, filename);
    return { format: "xlsx" as const };
  } catch (_e) {
    // Fallback CSV
    const rows = rowsFor(items);
    const csv = [HEADERS, ...rows]
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    download(new Blob([csv], { type: "text/csv;charset=utf-8" }), filename.replace(/\.xlsx$/, ".csv"));
    return { format: "csv" as const };
  }
}
