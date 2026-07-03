// =============================================================================
// PR-4.4B — Serviço de minutas do caso (case_drafts)
// =============================================================================
import { supabase } from "@/lib/backend/client";
import type {
  CaseDraft,
  CaseDraftStatus,
  GenerateDraftPayload,
  GenerateDraftResponse,
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
  try {
    await supabase.functions.invoke("review-legal-draft", {
      body: { draft_id: draftId },
    });
  } catch (e) {
    // Fire-and-forget — falha silenciosa; UI mostrará status via polling.
    console.warn("triggerDraftReview failed", (e as Error).message);
  }
}


export async function generateCaseDraft(
  payload: GenerateDraftPayload,
): Promise<GenerateDraftResponse> {
  const { data, error } = await supabase.functions.invoke(
    "generate-legal-draft",
    { body: payload },
  );
  if (error) throw new Error(error.message || "Falha ao gerar minuta.");
  if (!data?.draft_id) {
    throw new Error(data?.error || "Resposta inválida do servidor.");
  }
  return data as GenerateDraftResponse;
}

