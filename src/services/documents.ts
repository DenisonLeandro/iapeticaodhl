// =============================================================================
// Documents Service — CRUD operations for the documents table
// Story 2.2 — Document Generation Flow
// =============================================================================

import { supabase } from "@/lib/backend/client";
import type {
  Document,
  DocumentType,
  DocumentStatus,
  LLMProviderId,
} from "@/types/ai";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CreateDocumentInput {
  organization_id: string;
  type: DocumentType;
  title: string;
  content: string;
  llm_provider: LLMProviderId;
  llm_model: string;
  prompt_used: string;
  tokens_used: number;
  status: DocumentStatus;
  created_by: string;
  case_id?: string | null;
  client_id?: string | null;
}

export interface UpdateDocumentInput {
  title?: string;
  content?: string;
  status?: DocumentStatus;
}

export interface LogAIUsageInput {
  organization_id: string;
  profile_id: string;
  provider: LLMProviderId;
  model: string;
  tokens_input: number;
  tokens_output: number;
  cost_estimated: number;
  document_id: string | null;
  prompt_summary: string;
}

// ---------------------------------------------------------------------------
// CRUD
// ---------------------------------------------------------------------------

export async function createDocument(
  input: CreateDocumentInput,
): Promise<Document> {
  const { data, error } = await supabase
    .from("documents")
    .insert(input)
    .select("*")
    .single();

  if (error) {
    throw new Error(`Falha ao salvar documento: ${error.message}`);
  }

  return data as Document;
}

export async function fetchDocument(id: string): Promise<Document> {
  const { data, error } = await supabase
    .from("documents")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    throw new Error(`Falha ao buscar documento: ${error.message}`);
  }

  return data as Document;
}

export interface FetchDocumentsParams {
  search?: string;
  type?: DocumentType | null;
  status?: DocumentStatus | null;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  pageSize?: number;
  orderBy?: "created_at" | "title" | "type";
  orderDirection?: "asc" | "desc";
}

export interface FetchDocumentsResult {
  data: Document[];
  count: number;
}

export async function fetchDocuments(
  organizationId: string,
  params: FetchDocumentsParams = {},
): Promise<FetchDocumentsResult> {
  const {
    search,
    type,
    status,
    dateFrom,
    dateTo,
    page = 1,
    pageSize = 20,
    orderBy = "created_at",
    orderDirection = "desc",
  } = params;

  let query = supabase
    .from("documents")
    .select("*", { count: "exact" })
    .eq("organization_id", organizationId);

  if (type) {
    query = query.eq("type", type);
  }

  if (status) {
    query = query.eq("status", status);
  }

  if (search && search.trim() !== "") {
    const term = `%${search.trim()}%`;
    query = query.or(`title.ilike.${term},content.ilike.${term}`);
  }

  if (dateFrom) {
    query = query.gte("created_at", dateFrom);
  }

  if (dateTo) {
    query = query.lte("created_at", dateTo);
  }

  query = query.order(orderBy, { ascending: orderDirection === "asc" });

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  query = query.range(from, to);

  const { data, error, count } = await query;

  if (error) {
    throw new Error(`Falha ao listar documentos: ${error.message}`);
  }

  return {
    data: (data ?? []) as Document[],
    count: count ?? 0,
  };
}

export async function deleteDocument(id: string): Promise<void> {
  const { error } = await supabase.from("documents").delete().eq("id", id);

  if (error) {
    throw new Error(`Falha ao excluir documento: ${error.message}`);
  }
}

export async function updateDocument(
  id: string,
  input: UpdateDocumentInput,
): Promise<Document> {
  const { data, error } = await supabase
    .from("documents")
    .update(input)
    .eq("id", id)
    .select("*")
    .single();

  if (error) {
    throw new Error(`Falha ao atualizar documento: ${error.message}`);
  }

  return data as Document;
}

// ---------------------------------------------------------------------------
// Content & Status Updates (Story 2.3)
// ---------------------------------------------------------------------------

export async function updateDocumentContent(
  id: string,
  content: string,
): Promise<Document> {
  return updateDocument(id, { content });
}

export async function updateDocumentStatus(
  id: string,
  status: DocumentStatus,
): Promise<Document> {
  return updateDocument(id, { status });
}

// ---------------------------------------------------------------------------
// AI Usage Log
// ---------------------------------------------------------------------------

export async function logAIUsage(input: LogAIUsageInput): Promise<void> {
  const { error } = await supabase.from("ai_usage_log").insert(input);

  if (error) {
    // Fire-and-forget — log error but don't throw
    console.error("Falha ao registrar uso de IA:", error.message);
  }
}
