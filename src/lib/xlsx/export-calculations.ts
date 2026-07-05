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

const HEADERS = ["Pedido", "Fundamento", "Fórmula", "Dados", "Premissas", "Período", "Valor (R$)", "Confiança", "Faltantes", "Notas"];

function rowsFor(items: CaseCalculationItem[]) {
  return items.map((i) => [
    i.request_label,
    i.legal_basis ?? "",
    i.formula ?? "",
    fmt(i.input_data),
    fmt(i.assumptions),
    i.period ?? "",
    i.estimated_value ?? "",
    i.confidence,
    Array.isArray(i.missing_fields) ? i.missing_fields.join("; ") : "",
    i.notes ?? "",
  ]);
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
