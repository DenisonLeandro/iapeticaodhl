import { supabase } from "@/lib/backend/client";
import type { ClientInteraction } from "@/types/client";
import type { InteractionFormValues } from "@/schemas/client.schema";

export interface InteractionListParams {
  page: number;
  pageSize: number;
}

export interface InteractionListResult {
  data: ClientInteraction[];
  count: number;
}

export async function listInteractions(
  clientId: string,
  params: InteractionListParams,
): Promise<InteractionListResult> {
  const { page, pageSize } = params;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const { data, error, count } = await supabase
    .from("client_interactions")
    .select("*", { count: "exact" })
    .eq("client_id", clientId)
    .order("interaction_date", { ascending: false })
    .range(from, to);

  if (error) {
    throw new Error(`Erro ao buscar histórico de atendimentos: ${error.message}`);
  }

  return {
    data: (data as ClientInteraction[]) ?? [],
    count: count ?? 0,
  };
}

export async function createInteraction(
  organizationId: string,
  clientId: string,
  createdBy: string,
  formData: InteractionFormValues,
): Promise<ClientInteraction> {
  const { data, error } = await supabase
    .from("client_interactions")
    .insert({
      organization_id: organizationId,
      client_id: clientId,
      created_by: createdBy,
      interaction_date: formData.interaction_date,
      subject: formData.subject,
      notes: formData.notes || null,
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Erro ao registrar atendimento: ${error.message}`);
  }

  return data as ClientInteraction;
}
