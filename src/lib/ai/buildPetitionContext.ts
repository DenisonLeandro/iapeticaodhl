// =============================================================================
// buildPetitionContext — Consolida dados de cliente, processo e (futuramente)
// análises de PDFs em um único contexto para o wizard "Nova Petição".
// Hierarquia: manual > case > client > analysis > default.
// =============================================================================

import type { Client, ClientAddress, ClientFile } from "@/types/client";
import { maskCPF, maskCNPJ } from "@/schemas/client.schema";

/** Subconjunto de `cases` que o helper consome. */
export interface CaseLike {
  case_number?: string | null;
  court?: string | null;
  branch?: string | null;
  subject?: string | null;
  opposing_party?: string | null;
  represented_party?: string | null;
}


export type FieldSource = "manual" | "case" | "client" | "analysis" | "default";

export interface ConsolidatedField<T> {
  value: T | undefined;
  source: FieldSource;
}

export type AutoFillField =
  | "autor.nome"
  | "autor.cpfCnpj"
  | "autor.endereco"
  | "reu.nome"
  | "numeroProcesso"
  | "tribunal"
  | "vara"
  | "assunto"
  | "representedParty";

export interface PetitionContextAlert {
  field: AutoFillField | "geral";
  message: string;
  severity: "info" | "warn";
}

export interface PetitionContextInput {
  client?: Client | null;
  caseRow?: CaseLike | null;
  /** Reservado para a próxima fase — aceito mas ignorado nesta versão. */
  analyses?: ClientFile[];
  /** Conjunto de campos que o usuário já editou manualmente — não serão sobrescritos. */
  dirtyFields?: Partial<Record<AutoFillField, boolean>>;
}

export interface PetitionContext {
  values: Partial<Record<AutoFillField, string>>;
  sources: Partial<Record<AutoFillField, FieldSource>>;
  alerts: PetitionContextAlert[];
}

import { isKnownTribunal } from "@/lib/legal/tribunais";

/** Mapeia um valor livre de `cases.court` para o enum aceito; retorna "Outro" como fallback. */
export function mapCourtToTribunal(court: string | null | undefined): {
  value: string;
  matched: boolean;
} {
  if (!court) return { value: "Outro", matched: false };
  const raw = court.trim();
  const normalized = raw.toUpperCase().replace(/\s+/g, "");

  // Match direto na lista oficial (TRT9, TJSP, STF, etc.)
  if (isKnownTribunal(normalized)) return { value: normalized, matched: true };

  // TRF1 → TRF-1
  const trfMatch = normalized.match(/^TRF-?([1-6])$/);
  if (trfMatch) {
    const v = `TRF-${trfMatch[1]}`;
    if (isKnownTribunal(v)) return { value: v, matched: true };
  }

  // TRT-9 / TRT09 → TRT9
  const trtMatch = normalized.match(/^TRT-?0?(\d{1,2})$/);
  if (trtMatch) {
    const v = `TRT${parseInt(trtMatch[1], 10)}`;
    if (isKnownTribunal(v)) return { value: v, matched: true };
  }

  // TRE-SP / TRESP → TRE-SP
  const treMatch = normalized.match(/^TRE-?([A-Z]{2,3})$/);
  if (treMatch) {
    const v = `TRE-${treMatch[1]}`;
    if (isKnownTribunal(v)) return { value: v, matched: true };
  }

  return { value: "Outro", matched: false };
}

function formatAddress(addr: ClientAddress | null | undefined): string | undefined {
  if (!addr || typeof addr !== "object") return undefined;
  const parts = [addr.street, addr.number, addr.complement, addr.neighborhood, addr.city, addr.state]
    .map((p) => (typeof p === "string" ? p.trim() : ""))
    .filter(Boolean);
  return parts.length ? parts.join(", ") : undefined;
}

function formatClientDocument(client: Client): string | undefined {
  if (!client.document_number) return undefined;
  return client.document_type === "cnpj"
    ? maskCNPJ(client.document_number)
    : maskCPF(client.document_number);
}

/** Define um campo no contexto consolidado respeitando a hierarquia. */
function setField(
  ctx: PetitionContext,
  field: AutoFillField,
  value: string | undefined,
  source: FieldSource,
  dirtyFields: PetitionContextInput["dirtyFields"],
) {
  if (dirtyFields?.[field]) {
    // Usuário já editou — preserva.
    ctx.sources[field] = "manual";
    return;
  }
  if (!value || value.trim() === "") return;
  ctx.values[field] = value;
  ctx.sources[field] = source;
}

export function buildPetitionContextFromClientCaseAndDocuments(
  input: PetitionContextInput,
): PetitionContext {
  const ctx: PetitionContext = { values: {}, sources: {}, alerts: [] };
  const dirty = input.dirtyFields ?? {};

  // ----- CLIENT -----
  if (input.client) {
    setField(ctx, "autor.nome", input.client.full_name, "client", dirty);
    setField(ctx, "autor.cpfCnpj", formatClientDocument(input.client), "client", dirty);
    setField(ctx, "autor.endereco", formatAddress(input.client.address), "client", dirty);
  }

  // ----- CASE (sobrescreve client onde aplicável) -----
  if (input.caseRow) {
    const c = input.caseRow;
    setField(ctx, "numeroProcesso", c.case_number, "case", dirty);
    setField(ctx, "vara", c.branch ?? undefined, "case", dirty);
    setField(ctx, "reu.nome", c.opposing_party ?? undefined, "case", dirty);
    setField(ctx, "assunto", c.subject ?? undefined, "case", dirty);
    setField(ctx, "representedParty", c.represented_party ?? undefined, "case", dirty);

    // Tribunal: mapeamento + alerta de fallback
    if (c.court && !dirty["tribunal"]) {
      const mapped = mapCourtToTribunal(c.court);
      setField(ctx, "tribunal", mapped.value, "case", dirty);
      if (!mapped.matched) {
        ctx.alerts.push({
          field: "tribunal",
          severity: "info",
          message: `Tribunal "${c.court}" não corresponde a um valor padrão e foi definido como "Outro".`,
        });
      }
    }
  }

  // ----- ANALYSES (reservado para próxima fase) -----
  // Intencionalmente sem ação nesta versão. Mantido na assinatura.

  return ctx;
}
