// =============================================================================
// PR-4.3A — Serviço da Ficha Inteligente Universal do Caso
// =============================================================================
import { supabase } from "@/lib/backend/client";
import type {
  CaseIntakeForm,
  CaseIntakeFormValues,
  CaseIntakeAISuggestion,
} from "@/types/caseIntake";

export async function getCaseIntake(caseId: string): Promise<CaseIntakeForm | null> {
  const { data, error } = await supabase
    .from("case_intake_forms")
    .select("*")
    .eq("case_id", caseId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as unknown as CaseIntakeForm | null) ?? null;
}

export async function upsertCaseIntake(
  caseId: string,
  organizationId: string,
  clientId: string | null,
  userId: string,
  values: CaseIntakeFormValues,
): Promise<CaseIntakeForm> {
  // Normaliza strings vazias para null para manter a base limpa
  const cleaned: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(values)) {
    if (typeof v === "string") cleaned[k] = v.trim() === "" ? null : v.trim();
    else cleaned[k] = v ?? null;
  }

  const payload = {
    ...cleaned,
    case_id: caseId,
    organization_id: organizationId,
    client_id: clientId,
    updated_by: userId,
  };

  const { data, error } = await supabase
    .from("case_intake_forms")
    .upsert(payload, { onConflict: "case_id" })
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return data as unknown as CaseIntakeForm;
}

export async function requestIntakeSuggestion(
  caseId: string,
): Promise<CaseIntakeAISuggestion> {
  const { data, error } = await supabase.functions.invoke("suggest-case-intake", {
    body: { caseId },
  });
  if (error) throw new Error(error.message || "Falha ao gerar sugestão");
  if (!data?.suggestion) throw new Error("Resposta inválida do servidor");
  return data.suggestion as CaseIntakeAISuggestion;
}
