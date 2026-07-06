// =============================================================================
// PR-4.5A — Verificação determinística de conformidade com Playbook.
// Sem IA: normaliza texto e casa keywords configuradas no playbook.
// =============================================================================
import type {
  ComplianceMissing,
  ComplianceResult,
  LegalPlaybook,
  PlaybookDocumentItem,
  PlaybookRequiredItem,
  PlaybookSensitiveThesis,
  PlaybookSeverity,
} from "./types.ts";

function normalize(text: string): string {
  return (text || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function keywordsFound(hay: string, keywords: string[] | undefined): boolean {
  if (!keywords || keywords.length === 0) return false;
  for (const k of keywords) {
    const n = normalize(k);
    if (!n) continue;
    if (hay.includes(n)) return true;
  }
  return false;
}

function severityFor(item: { severity_if_missing?: PlaybookSeverity }): PlaybookSeverity {
  return item.severity_if_missing ?? "atencao";
}

function checkBlockOrRequest(
  items: PlaybookRequiredItem[] | undefined,
  hay: string,
  kind: "block" | "request",
  missing: ComplianceMissing[],
  passed: Array<{ key: string; title: string; kind: string }>,
) {
  if (!items) return;
  for (const it of items) {
    if (!it.required) continue;
    if (it.applicability === "optional") continue;
    const found = keywordsFound(hay, it.keywords);
    if (found) {
      passed.push({ key: it.key, title: it.title, kind });
    } else {
      missing.push({
        key: it.key,
        title: it.title,
        severity: severityFor(it),
        reason: `${kind === "block" ? "Bloco" : "Pedido"} obrigatório "${it.title}" não foi identificado na peça.`,
        suggestion: it.default_text?.slice(0, 800),
        kind,
      });
    }
  }
}

function checkDocuments(
  items: PlaybookDocumentItem[] | undefined,
  hay: string,
  missing: ComplianceMissing[],
  passed: Array<{ key: string; title: string; kind: string }>,
) {
  if (!items) return;
  for (const it of items) {
    if (it.importance !== "obrigatorio") continue;
    const found = keywordsFound(hay, it.keywords ?? [it.label]);
    if (found) {
      passed.push({ key: it.key, title: it.label, kind: "document" });
    } else {
      missing.push({
        key: it.key,
        title: it.label,
        severity: it.severity_if_missing ?? "pendencia_documental",
        reason: `Documento obrigatório "${it.label}" não aparece no pedido de exibição.`,
        suggestion: it.observation,
        kind: "document",
      });
    }
  }
}

function checkSensitiveTheses(
  items: PlaybookSensitiveThesis[] | undefined,
  hay: string,
  content: string,
  alerts: ComplianceMissing[],
  passed: Array<{ key: string; title: string; kind: string }>,
) {
  if (!items) return;
  for (const it of items) {
    const mentioned = keywordsFound(hay, it.keywords ?? [it.label]);
    if (!mentioned) continue;
    const hasMarker = it.required_marker ? content.includes(it.required_marker) : true;
    if (hasMarker) {
      passed.push({ key: it.key, title: it.label, kind: "thesis" });
    } else {
      alerts.push({
        key: it.key,
        title: it.label,
        severity: it.severity ?? "risco_alto",
        reason: `${it.warning} Insira o marcador ${it.required_marker ?? ""}`.trim(),
        suggestion: it.required_marker,
        kind: "thesis",
      });
    }
  }
}

export function checkPlaybookCompliance(
  draftContent: string,
  playbook: LegalPlaybook | null | undefined,
): ComplianceResult | null {
  if (!playbook) return null;
  const cfg = playbook.config ?? {};
  const hay = normalize(draftContent);

  const missing_blocks: ComplianceMissing[] = [];
  const missing_requests: ComplianceMissing[] = [];
  const missing_documents: ComplianceMissing[] = [];
  const sensitive_alerts: ComplianceMissing[] = [];
  const passed: Array<{ key: string; title: string; kind: string }> = [];

  checkBlockOrRequest(cfg.required_blocks, hay, "block", missing_blocks, passed);
  checkBlockOrRequest(cfg.required_requests, hay, "request", missing_requests, passed);
  checkDocuments(cfg.document_requests, hay, missing_documents, passed);
  checkSensitiveTheses(cfg.sensitive_theses, hay, draftContent, sensitive_alerts, passed);

  const totalRequired =
    (cfg.required_blocks?.filter((b) => b.required).length ?? 0) +
    (cfg.required_requests?.filter((b) => b.required).length ?? 0) +
    (cfg.document_requests?.filter((d) => d.importance === "obrigatorio").length ?? 0);

  const totalMissing =
    missing_blocks.length + missing_requests.length + missing_documents.length;

  const passedCount = Math.max(totalRequired - totalMissing, 0);
  const score = totalRequired === 0 ? 100 : Math.round((passedCount / totalRequired) * 100);

  const hasRiscoAlto =
    [...missing_blocks, ...missing_requests, ...missing_documents, ...sensitive_alerts]
      .some((m) => m.severity === "risco_alto");

  let status: ComplianceResult["status"];
  if (hasRiscoAlto) status = "risco_alto";
  else if (totalMissing >= 4) status = "incompleto";
  else if (totalMissing > 0) status = "revisar_antes";
  else status = "aprovado_para_revisao";

  return {
    score,
    status,
    missing_blocks,
    missing_requests,
    missing_documents,
    sensitive_alerts,
    passed_items: passed,
    checked_at: new Date().toISOString(),
  };
}
