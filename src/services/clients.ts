import { supabase } from "@/lib/backend/client";
import type { Client, ClientListParams, ClientListResult } from "@/types/client";
import type { ClientFormValues } from "@/schemas/client.schema";

export async function fetchClients(
  organizationId: string,
  params: ClientListParams,
): Promise<ClientListResult> {
  const { search, page, pageSize, sortBy = "created_at", sortOrder = "desc" } = params;

  let query = supabase
    .from("clients")
    .select("*", { count: "exact" })
    .eq("organization_id", organizationId)
    .is("deleted_at", null);

  // Search across full_name, document_number, and email
  if (search && search.trim() !== "") {
    const term = `%${search.trim()}%`;
    query = query.or(`full_name.ilike.${term},document_number.ilike.${term},email.ilike.${term}`);
  }

  // Sorting
  query = query.order(sortBy, { ascending: sortOrder === "asc" });

  // Pagination
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  query = query.range(from, to);

  const { data, error, count } = await query;

  if (error) {
    throw new Error(`Erro ao buscar clientes: ${error.message}`);
  }

  return {
    data: (data as unknown as Client[]) ?? [],
    count: count ?? 0,
  };
}

export async function getClientById(id: string): Promise<Client> {
  const { data, error } = await supabase
    .from("clients")
    .select("*")
    .eq("id", id)
    .is("deleted_at", null)
    .single();

  if (error) {
    throw new Error(`Erro ao buscar cliente: ${error.message}`);
  }

  return data as unknown as Client;
}

export async function createClient(
  organizationId: string,
  createdBy: string,
  formData: ClientFormValues,
): Promise<Client> {
  const cleanedDocNumber = formData.document_number.replace(/\D/g, "");

  const { data, error } = await supabase
    .from("clients")
    .insert({
      organization_id: organizationId,
      created_by: createdBy,
      full_name: formData.full_name.trim(),
      document_type: formData.document_type,
      document_number: cleanedDocNumber || null,
      email: formData.email?.trim() || null,
      phone: formData.phone.replace(/\D/g, "") || null,
      address: formData.address ? {
        street: formData.address.street.trim(),
        number: formData.address.number.trim(),
        complement: formData.address.complement?.trim() || "",
        neighborhood: formData.address.neighborhood.trim(),
        city: formData.address.city.trim(),
        state: formData.address.state.trim(),
        zip_code: formData.address.zip_code.replace(/\D/g, ""),
      } : null,
      notes: formData.notes?.trim() || null,
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Erro ao criar cliente: ${error.message}`);
  }

  return data as unknown as Client;
}

export async function updateClient(
  id: string,
  formData: ClientFormValues,
): Promise<Client> {
  const cleanedDocNumber = formData.document_number.replace(/\D/g, "");

  const { data, error } = await supabase
    .from("clients")
    .update({
      full_name: formData.full_name.trim(),
      document_type: formData.document_type,
      document_number: cleanedDocNumber || null,
      email: formData.email?.trim() || null,
      phone: formData.phone.replace(/\D/g, "") || null,
      address: formData.address ? {
        street: formData.address.street.trim(),
        number: formData.address.number.trim(),
        complement: formData.address.complement?.trim() || "",
        neighborhood: formData.address.neighborhood.trim(),
        city: formData.address.city.trim(),
        state: formData.address.state.trim(),
        zip_code: formData.address.zip_code.replace(/\D/g, ""),
      } : null,
      notes: formData.notes?.trim() || null,
    })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    throw new Error(`Erro ao atualizar cliente: ${error.message}`);
  }

  return data as unknown as Client;
}

export async function softDeleteClient(id: string): Promise<void> {
  const { error } = await supabase
    .from("clients")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);

  if (error) {
    throw new Error(`Erro ao excluir cliente: ${error.message}`);
  }
}
