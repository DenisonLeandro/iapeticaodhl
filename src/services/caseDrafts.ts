// =============================================================================
// PR-4.4B — Serviço de minutas do caso (case_drafts)
// =============================================================================
import { supabase } from "@/lib/backend/client";
import { withInflight } from "@/lib/ai/inflight-guard";
import type {
  AssembleChaptersBlocked,
  AssembleChaptersPayload,
  AssembleChaptersResponse,
  CaseDraft,
  CaseDraftStatus,
  GenerateDraftPayload,
  GenerateDraftResponse,
  GenerateDraftSectionPayload,
  GenerateDraftSectionResponse,
  PlanChaptersPayload,
  PlanChaptersResponse,
  PlanChaptersUnsupported,
} from "@/types/caseDraft";



// Types ainda não regenerados para a tabela case_drafts; usamos any localmente.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export async function listCaseDrafts(caseId: string): Promise<CaseDraft[]> {
  const { data, error } = await db
    .from("case_drafts")
    .select("*")
    .eq("case_id", caseId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as CaseDraft[];
}

export async function getCaseDraft(id: string): Promise<CaseDraft> {
  const { data, error } = await db
    .from("case_drafts")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Minuta não encontrada.");
  return data as CaseDraft;
}

export async function updateCaseDraft(
  id: string,
  patch: Partial<Pick<CaseDraft, "content" | "title" | "status">>,
): Promise<CaseDraft> {
  const { data: userData } = await supabase.auth.getUser();
  const { data, error } = await db
    .from("case_drafts")
    .update({ ...patch, updated_by: userData.user?.id ?? null })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data as CaseDraft;
}

export async function archiveCaseDraft(id: string): Promise<void> {
  const { error } = await db
    .from("case_drafts")
    .update({ status: "archived" as CaseDraftStatus })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export async function triggerDraftReview(draftId: string): Promise<void> {
  const { withInflight } = await import("@/lib/ai/inflight-guard");
  await withInflight(`review-legal-draft:${draftId}`, async () => {
    try {
      await supabase.functions.invoke("review-legal-draft", {
        body: { draft_id: draftId },
      });
    } catch (e) {
      console.warn("triggerDraftReview failed", (e as Error).message);
    }
  });
}


export async function generateCaseDraft(
  payload: GenerateDraftPayload,
): Promise<GenerateDraftResponse> {
  return withInflight(`generate-legal-draft:${payload.case_id}:${payload.draft_type}`, async () => {
  const FRIENDLY = "Não foi possível gerar a minuta. Verifique os dados do caso/modelo ou tente novamente.";
  const { data, error } = await supabase.functions.invoke(
    "generate-legal-draft",
    { body: payload },
  );

  // Erro de rede/HTTP não-2xx: supabase-js retorna FunctionsHttpError com response no context.
  if (error) {
    let status: number | undefined;
    let code: string | undefined;
    let stage: string | undefined;
    let message: string | undefined;
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const resp: Response | undefined = (error as any)?.context?.response;
      if (resp) {
        status = resp.status;
        const parsed = await resp.clone().json().catch(() => null);
        if (parsed && typeof parsed === "object") {
          code = parsed.code;
          stage = parsed.stage;
          message = parsed.message;
        }
      }
    } catch { /* ignore parse errors */ }
    console.error("generateCaseDraft:error", {
      fn: "generate-legal-draft",
      status,
      code,
      stage,
      message: message ?? error.message,
    });
    throw new Error(FRIENDLY);
  }

  // Edge respondeu 2xx mas com success:false (não deve ocorrer, mas por segurança)
  if (data && data.success === false) {
    console.error("generateCaseDraft:soft_error", {
      fn: "generate-legal-draft",
      code: data.code,
      stage: data.stage,
      message: data.message,
    });
    throw new Error(FRIENDLY);
  }

  if (!data?.draft_id) {
    console.error("generateCaseDraft:invalid_response", { fn: "generate-legal-draft" });
    throw new Error(FRIENDLY);
  }
  return data as GenerateDraftResponse;
  });
}

// =============================================================================
// PR-2 — Planejar capítulos (modo "por capítulos")
// Retorna a resposta bruta (sucesso ou "unsupported_piece_type") para o hook
// tratar de forma amigável, sem lançar exceção nesse caso.
// =============================================================================
export async function planDraftChapters(
  payload: PlanChaptersPayload,
): Promise<PlanChaptersResponse | PlanChaptersUnsupported> {
  const FRIENDLY = "Não foi possível planejar os capítulos. Verifique os dados do caso e tente novamente.";
  const { data, error } = await supabase.functions.invoke("plan-draft-chapters", { body: payload });

  if (error) {
    let status: number | undefined;
    let code: string | undefined;
    let message: string | undefined;
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const resp: Response | undefined = (error as any)?.context?.response;
      if (resp) {
        status = resp.status;
        const parsed = await resp.clone().json().catch(() => null);
        if (parsed && typeof parsed === "object") {
          code = parsed.code;
          message = parsed.message;
        }
      }
    } catch { /* ignore */ }
    console.error("planDraftChapters:error", { status, code, message: message ?? error.message });
    throw new Error(FRIENDLY);
  }

  if (data && data.success === false) {
    if (data.code === "unsupported_piece_type") {
      return data as PlanChaptersUnsupported;
    }
    console.error("planDraftChapters:soft_error", { code: data.code, message: data.message });
    throw new Error(FRIENDLY);
  }
  if (!data?.draft_id) {
    console.error("planDraftChapters:invalid_response");
    throw new Error(FRIENDLY);
  }
  return data as PlanChaptersResponse;
}




// PR-3 — Gera o conteúdo de UMA seção (case_draft_sections.content)
export async function generateDraftSection(
  payload: GenerateDraftSectionPayload,
): Promise<GenerateDraftSectionResponse> {
  const FRIENDLY = "Não foi possível gerar este capítulo. Tente novamente.";
  const { data, error } = await supabase.functions.invoke("generate-draft-section", { body: payload });

  if (error) {
    let status: number | undefined;
    let code: string | undefined;
    let message: string | undefined;
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const resp: Response | undefined = (error as any)?.context?.response;
      if (resp) {
        status = resp.status;
        const parsed = await resp.clone().json().catch(() => null);
        if (parsed && typeof parsed === "object") {
          code = parsed.code;
          message = parsed.message;
        }
      }
    } catch { /* ignore */ }
    console.error("generateDraftSection:error", { status, code, message: message ?? error.message });
    throw new Error(message ?? FRIENDLY);
  }

  if (data && data.success === false) {
    console.error("generateDraftSection:soft_error", { code: data.code, message: data.message });
    throw new Error(data.message ?? FRIENDLY);
  }
  return data as GenerateDraftSectionResponse;
}

// PR-4 — Montagem determinística da petição final a partir dos capítulos.
// Retorna `AssembleChaptersBlocked` (sem lançar) quando faltam obrigatórios,
// para a UI listar os capítulos pendentes. Demais erros lançam.
export async function assembleDraftChapters(
  payload: AssembleChaptersPayload,
): Promise<AssembleChaptersResponse | AssembleChaptersBlocked> {
  const FRIENDLY = "Não foi possível montar a petição final. Tente novamente.";
  const { data, error } = await supabase.functions.invoke("assemble-draft-chapters", { body: payload });

  if (error) {
    let status: number | undefined;
    let code: string | undefined;
    let message: string | undefined;
    let parsedBody: unknown = null;
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const resp: Response | undefined = (error as any)?.context?.response;
      if (resp) {
        status = resp.status;
        const parsed = await resp.clone().json().catch(() => null);
        parsedBody = parsed;
        if (parsed && typeof parsed === "object") {
          code = (parsed as { code?: string }).code;
          message = (parsed as { message?: string }).message;
        }
      }
    } catch { /* ignore */ }
    console.error("assembleDraftChapters:error", { status, code, message: message ?? error.message });
    if (code === "missing_required_sections" && parsedBody && typeof parsedBody === "object") {
      return parsedBody as AssembleChaptersBlocked;
    }
    throw new Error(message ?? FRIENDLY);
  }

  if (data && data.success === false) {
    if (data.code === "missing_required_sections") {
      return data as AssembleChaptersBlocked;
    }
    console.error("assembleDraftChapters:soft_error", { code: data.code, message: data.message });
    throw new Error(data.message ?? FRIENDLY);
  }
  if (!data?.draft_id) {
    console.error("assembleDraftChapters:invalid_response");
    throw new Error(FRIENDLY);
  }
  return data as AssembleChaptersResponse;
}


