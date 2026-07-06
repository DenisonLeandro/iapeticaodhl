// =============================================================================
// PR-1 — Serviço de leitura de capítulos da minuta (case_draft_sections)
// Sem mutations: geração/edição virão em PRs futuros via edge functions.
// =============================================================================
import { supabase } from "@/lib/backend/client";
import type { CaseDraftSection } from "@/types/caseDraft";

// Types do Supabase ainda não regenerados para esta tabela.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export async function listCaseDraftSections(
  draftId: string,
): Promise<CaseDraftSection[]> {
  const { data, error } = await db
    .from("case_draft_sections")
    .select("*")
    .eq("draft_id", draftId)
    .order("order_index", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as CaseDraftSection[];
}
