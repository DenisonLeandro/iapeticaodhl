// =============================================================================
// PR-4 — assemble-draft-chapters
// Montagem DETERMINÍSTICA da petição final a partir de case_draft_sections.
// Não usa LLM. Não altera generate-legal-draft, senior-legal-review,
// apply-senior-review-to-draft, review-legal-draft, export, modo rápido,
// generate-draft-section nem plan-draft-chapters.
// =============================================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "../_shared/cors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Fixas essenciais (bloqueiam montagem se ausentes/vazias/erradas)
const REQUIRED_ESSENTIAL = new Set<string>([
  "enderecamento",
  "qualificacao",
  "dados_funcionais",
  "sintese_fatos",
  "rol_pedidos_valores",
  "valor_causa",
  "pedido_final",
  "fechamento",
]);

// Explicitamente opcionais — podem estar vazias/skipped sem bloquear.
const OPTIONAL_KEYS = new Set<string>([
  "justica_gratuita",
  "preliminares",
]);

// Trio "essencial final" que precisa existir E ter conteúdo.
const FINAL_TRIPLET = ["rol_pedidos_valores", "valor_causa", "pedido_final"];

interface Section {
  id: string;
  section_key: string;
  section_label: string;
  order_index: number;
  content: string | null;
  status: string;
}

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function isRequired(section_key: string): boolean {
  if (OPTIONAL_KEYS.has(section_key)) return false;
  if (REQUIRED_ESSENTIAL.has(section_key)) return true;
  // Capítulos de mérito criados no planejamento são obrigatórios (salvo skipped).
  if (section_key.startsWith("merito_") || section_key === "merito") return true;
  // Demais capítulos criados no plano são considerados obrigatórios por padrão.
  return true;
}

function hasContent(s: Section): boolean {
  return typeof s.content === "string" && s.content.trim().length > 0;
}

function alreadyHasTitle(content: string, label: string): boolean {
  const head = content.trimStart().slice(0, 400).toLowerCase();
  if (head.startsWith("#")) return true;
  const norm = label.trim().toLowerCase();
  if (norm && head.startsWith(norm)) return true;
  return false;
}

function assembleContent(sections: Section[]): string {
  const parts: string[] = [];
  for (const s of sections) {
    const content = String(s.content ?? "").trim();
    if (!content) continue;
    const block = alreadyHasTitle(content, s.section_label)
      ? content
      : `## ${s.section_label}\n\n${content}`;
    parts.push(block);
  }
  return parts.join("\n\n\n");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ success: false, code: "method_not_allowed" }, 405);

  // ---- Auth ----
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) {
    return json({ success: false, code: "unauthorized", message: "Não autenticado." }, 401);
  }
  const userSupa = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });
  const { data: userData, error: userErr } = await userSupa.auth.getUser();
  if (userErr || !userData?.user) {
    return json({ success: false, code: "unauthorized", message: "Não autenticado." }, 401);
  }
  const userId = userData.user.id;

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  const { data: profile } = await admin
    .from("profiles")
    .select("organization_id")
    .eq("id", userId)
    .maybeSingle();
  if (!profile?.organization_id) {
    return json({ success: false, code: "no_organization", message: "Perfil sem organização." }, 403);
  }
  const organizationId = profile.organization_id as string;

  // ---- Payload ----
  let payload: { draft_id?: string } = {};
  try { payload = await req.json(); } catch { /* keep empty */ }
  const draftId = String(payload.draft_id ?? "").trim();
  if (!draftId) {
    return json({ success: false, code: "invalid_payload", message: "draft_id obrigatório." }, 400);
  }

  // ---- Draft ----
  const { data: draft, error: draftErr } = await admin
    .from("case_drafts")
    .select("id, organization_id, case_id, content, generation_mode, piece_type_key, assembly_status")
    .eq("id", draftId)
    .maybeSingle();
  if (draftErr) {
    return json({ success: false, code: "db_error", message: draftErr.message }, 500);
  }
  if (!draft) {
    return json({ success: false, code: "not_found", message: "Minuta não encontrada." }, 404);
  }
  if (draft.organization_id !== organizationId) {
    return json({ success: false, code: "forbidden", message: "Acesso negado." }, 403);
  }
  if (draft.generation_mode !== "chapters") {
    return json({
      success: false,
      code: "wrong_mode",
      message: "Esta minuta não é do modo por capítulos.",
    }, 409);
  }
  if (!draft.piece_type_key) {
    return json({
      success: false,
      code: "missing_piece_type",
      message: "Tipo de peça não definido para esta minuta.",
    }, 409);
  }

  // ---- Sections ----
  const { data: rawSections, error: secErr } = await admin
    .from("case_draft_sections")
    .select("id, section_key, section_label, order_index, content, status")
    .eq("draft_id", draftId)
    .order("order_index", { ascending: true });
  if (secErr) {
    return json({ success: false, code: "db_error", message: secErr.message }, 500);
  }
  const sections = (rawSections ?? []) as Section[];
  if (sections.length === 0) {
    return json({
      success: false,
      code: "no_sections",
      message: "Nenhum capítulo planejado para esta minuta.",
    }, 409);
  }

  // ---- Validação de pendências ----
  const pending: Array<{ section_key: string; section_label: string; reason: string; status: string }> = [];
  for (const s of sections) {
    if (s.status === "skipped") continue; // opcionais/skipped são ignorados
    if (!isRequired(s.section_key)) {
      // opcionais sem conteúdo apenas são ignorados na montagem
      continue;
    }
    if (s.status === "pending" || s.status === "generating") {
      pending.push({ section_key: s.section_key, section_label: s.section_label, reason: "not_generated", status: s.status });
      continue;
    }
    if (s.status === "failed") {
      pending.push({ section_key: s.section_key, section_label: s.section_label, reason: "failed", status: s.status });
      continue;
    }
    if (!hasContent(s)) {
      pending.push({ section_key: s.section_key, section_label: s.section_label, reason: "empty_content", status: s.status });
      continue;
    }
  }

  // Trio final essencial precisa existir E ter conteúdo (e não estar skipped).
  const byKey = new Map(sections.map((s) => [s.section_key, s]));
  for (const key of FINAL_TRIPLET) {
    const s = byKey.get(key);
    if (!s || s.status === "skipped" || !hasContent(s)) {
      if (!pending.some((p) => p.section_key === key)) {
        pending.push({
          section_key: key,
          section_label: s?.section_label ?? key,
          reason: s ? "empty_content" : "missing",
          status: s?.status ?? "missing",
        });
      }
    }
  }

  if (pending.length > 0) {
    return json({
      success: false,
      code: "missing_required_sections",
      message: "Existem capítulos obrigatórios pendentes ou com falha. Gere ou corrija esses capítulos antes de montar a petição final.",
      pending_sections: pending,
    }, 409);
  }

  // ---- Montagem determinística ----
  const usableSections = sections.filter(
    (s) => s.status !== "skipped" && hasContent(s),
  );
  const assembled = assembleContent(usableSections);
  if (!assembled.trim()) {
    return json({
      success: false,
      code: "empty_assembly",
      message: "A montagem produziu conteúdo vazio.",
    }, 500);
  }

  // ---- Versionamento ----
  const previousContent = String(draft.content ?? "");
  const hadPrevious = previousContent.trim().length > 0;

  if (hadPrevious) {
    const { error: prevErr } = await admin
      .from("case_draft_versions")
      .insert({
        organization_id: organizationId,
        draft_id: draftId,
        content: previousContent,
        source: "before_chapters_reassembled",
        applied_suggestion_ids: null,
        created_by: userId,
      });
    if (prevErr) {
      return json({ success: false, code: "db_error", message: `snapshot_previous_failed: ${prevErr.message}` }, 500);
    }
  }

  const newSource = hadPrevious ? "chapters_reassembled" : "chapters_assembled";
  const { data: newVersion, error: newVerErr } = await admin
    .from("case_draft_versions")
    .insert({
      organization_id: organizationId,
      draft_id: draftId,
      content: assembled,
      source: newSource,
      applied_suggestion_ids: null,
      created_by: userId,
    })
    .select("id")
    .single();
  if (newVerErr) {
    return json({ success: false, code: "db_error", message: `snapshot_new_failed: ${newVerErr.message}` }, 500);
  }

  // ---- Atualiza o draft ----
  const { error: updErr } = await admin
    .from("case_drafts")
    .update({
      content: assembled,
      assembly_status: "assembled",
      updated_by: userId,
    })
    .eq("id", draftId);
  if (updErr) {
    return json({ success: false, code: "db_error", message: `draft_update_failed: ${updErr.message}` }, 500);
  }

  return json({
    success: true,
    draft_id: draftId,
    version_id: (newVersion as { id: string }).id,
    sections_used: usableSections.length,
    chars: assembled.length,
    source: newSource,
  });
});
