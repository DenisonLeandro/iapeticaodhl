// =============================================================================
// PR-4.5A — Resolve o playbook aplicável para uma geração/revisão.
// Match exato area+type+subtype → fallback area+type (subtype null).
// Retorna null quando não encontrado (fluxo atual segue sem quebrar).
// =============================================================================
import type { LegalPlaybook } from "./types.ts";

type SupabaseAdmin = {
  from: (t: string) => {
    select: (c: string) => {
      eq: (col: string, val: unknown) => {
        eq: (col: string, val: unknown) => {
          eq: (col: string, val: unknown) => {
            eq: (col: string, val: unknown) => {
              maybeSingle: () => Promise<{ data: LegalPlaybook | null; error: unknown }>;
            };
            is: (col: string, val: unknown) => {
              maybeSingle: () => Promise<{ data: LegalPlaybook | null; error: unknown }>;
            };
          };
        };
      };
    };
  };
};

function norm(v: string | null | undefined): string {
  return String(v ?? "").trim().toLowerCase();
}

export async function loadApplicablePlaybook(
  admin: SupabaseAdmin,
  args: {
    organization_id: string;
    legal_area?: string | null;
    document_type?: string | null;
    case_subtype?: string | null;
  },
): Promise<LegalPlaybook | null> {
  const area = norm(args.legal_area);
  const type = norm(args.document_type);
  if (!area || !type) return null;

  const orgId = args.organization_id;

  // 1. Match exato com subtype
  const subtype = norm(args.case_subtype);
  if (subtype) {
    try {
      const { data } = await admin
        .from("legal_playbooks")
        .select("*")
        .eq("organization_id", orgId)
        .eq("is_active", true)
        .eq("legal_area", area)
        .eq("case_subtype", subtype)
        .maybeSingle();
      if (data && norm((data as LegalPlaybook).document_type) === type) return data as LegalPlaybook;
    } catch (_e) { /* ignore */ }
  }

  // 2. Fallback: subtype null
  try {
    const { data } = await admin
      .from("legal_playbooks")
      .select("*")
      .eq("organization_id", orgId)
      .eq("is_active", true)
      .eq("legal_area", area)
      .eq("document_type", type)
      // @ts-ignore chained builder
      .is("case_subtype", null)
      .maybeSingle();
    if (data) return data as LegalPlaybook;
  } catch (_e) { /* ignore */ }

  return null;
}

export function renderPlaybookForPrompt(pb: LegalPlaybook): string {
  const cfg = pb.config ?? {};
  const trunc = (s: string | undefined, n = 400) =>
    !s ? "" : s.length > n ? s.slice(0, n) + "…" : s;

  const lines: string[] = [];
  lines.push(`# REGRAS JURÍDICAS OBRIGATÓRIAS DO ESCRITÓRIO`);
  lines.push(`Playbook: ${pb.name} (v${pb.version})`);
  lines.push(`Área: ${pb.legal_area} | Tipo: ${pb.document_type}${pb.case_subtype ? ` | Subtipo: ${pb.case_subtype}` : ""}`);
  lines.push("");
  lines.push(`Este playbook é a RÉGUA DE CONTEÚDO OBRIGATÓRIO. Nenhum item marcado como obrigatório pode ser omitido. O modelo do escritório permanece como RÉGUA DE ESTILO.`);
  lines.push("");

  if (cfg.required_blocks?.length) {
    lines.push(`## Blocos obrigatórios (todos devem aparecer na peça)`);
    for (const b of cfg.required_blocks) {
      if (!b.required) continue;
      lines.push(`- [${b.key}] ${b.title}${b.placement ? ` — posição: ${b.placement}` : ""}`);
      if (b.default_text) lines.push(`  Texto base: ${trunc(b.default_text)}`);
    }
    lines.push("");
  }

  if (cfg.required_requests?.length) {
    lines.push(`## Pedidos obrigatórios (todos devem constar no pedido final)`);
    for (const r of cfg.required_requests) {
      if (!r.required) continue;
      lines.push(`- [${r.key}] ${r.title}`);
      if (r.default_text) lines.push(`  Texto base: ${trunc(r.default_text)}`);
    }
    lines.push("");
  }

  if (cfg.document_requests?.length) {
    const obrig = cfg.document_requests.filter((d) => d.importance === "obrigatorio");
    if (obrig.length) {
      lines.push(`## Documentos a pedir em exibição (obrigatórios — art. 400 CPC)`);
      lines.push(obrig.map((d) => `- ${d.label}`).join("\n"));
      lines.push("");
    }
    const rec = cfg.document_requests.filter((d) => d.importance !== "obrigatorio");
    if (rec.length) {
      lines.push(`## Documentos recomendados / se aplicáveis`);
      lines.push(rec.map((d) => `- ${d.label}`).join("\n"));
      lines.push("");
    }
  }

  if (cfg.sensitive_theses?.length) {
    lines.push(`## Teses sensíveis (usar SEMPRE o marcador exato quando a tese for citada)`);
    for (const t of cfg.sensitive_theses) {
      lines.push(`- ${t.label} → ${t.warning}${t.required_marker ? ` Marcador obrigatório: ${t.required_marker}` : ""}`);
    }
    lines.push("");
  }

  if (cfg.drafting_instructions?.length) {
    lines.push(`## Instruções de redação do escritório`);
    for (const s of cfg.drafting_instructions) lines.push(`- ${s}`);
    lines.push("");
  }

  return lines.join("\n");
}
