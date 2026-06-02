import { supabase } from "@/lib/backend/client";
import type { ClientFile } from "@/types/client";

export async function listFiles(clientId: string): Promise<ClientFile[]> {
  const { data, error } = await supabase
    .from("client_files")
    .select("*")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Erro ao buscar arquivos do cliente: ${error.message}`);
  }

  return (data as ClientFile[]) ?? [];
}

export interface UploadFileOptions {
  document_kind?: string;
  case_id?: string;
  represented_party?: string;
}

export async function uploadFile(
  organizationId: string,
  clientId: string,
  uploadedBy: string,
  file: File,
  description?: string,
  options?: UploadFileOptions,
): Promise<ClientFile> {
  const storagePath = `${organizationId}/${clientId}/${Date.now()}_${file.name}`;

  // 1. Upload to Supabase Storage
  const { error: uploadError } = await supabase.storage
    .from("client-documents")
    .upload(storagePath, file, { contentType: file.type });

  if (uploadError) {
    throw new Error(`Erro ao fazer upload do arquivo: ${uploadError.message}`);
  }

  // 2. Insert metadata in client_files table
  const { data, error: dbError } = await supabase
    .from("client_files")
    .insert({
      organization_id: organizationId,
      client_id: clientId,
      uploaded_by: uploadedBy,
      file_name: file.name,
      file_type: file.type,
      file_size: file.size,
      storage_path: storagePath,
      description: description || null,
      document_kind: options?.document_kind ?? null,
      case_id: options?.case_id ?? null,
      represented_party: options?.represented_party ?? null,
      processing_status: "pending",
    })
    .select()
    .single();

  if (dbError) {
    await supabase.storage.from("client-documents").remove([storagePath]);
    throw new Error(`Erro ao salvar metadados do arquivo: ${dbError.message}`);
  }

  return data as ClientFile;
}

export interface ClientCaseOption {
  id: string;
  case_number: string;
  court: string | null;
  represented_party: string | null;
}

export async function listCasesByClient(clientId: string): Promise<ClientCaseOption[]> {
  const { data, error } = await supabase
    .from("cases")
    .select("id, case_number, court, represented_party")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Erro ao buscar processos do cliente: ${error.message}`);
  }

  return (data ?? []) as ClientCaseOption[];
}

export async function listFilesByCase(caseId: string): Promise<ClientFile[]> {
  const { data, error } = await supabase
    .from("client_files")
    .select(
      "id, organization_id, client_id, case_id, file_name, file_type, file_size, storage_path, description, document_kind, represented_party, processing_status, analysis_summary, analysis_json, processed_at, error_message, created_at, updated_at",
    )
    .eq("case_id", caseId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Erro ao buscar arquivos do processo: ${error.message}`);
  }
  return (data as ClientFile[]) ?? [];
}

export interface BatchUploadInput {
  file: File;
  description?: string;
  options?: UploadFileOptions;
}

export interface BatchUploadResultItem {
  file: File;
  success: boolean;
  data?: ClientFile;
  error?: string;
}

export async function uploadFiles(
  organizationId: string,
  clientId: string,
  uploadedBy: string,
  items: BatchUploadInput[],
  onItemDone?: (index: number, result: BatchUploadResultItem) => void,
): Promise<BatchUploadResultItem[]> {
  const results: BatchUploadResultItem[] = [];
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    try {
      const data = await uploadFile(
        organizationId,
        clientId,
        uploadedBy,
        item.file,
        item.description,
        item.options,
      );
      const res: BatchUploadResultItem = { file: item.file, success: true, data };
      results.push(res);
      onItemDone?.(i, res);
    } catch (err) {
      const res: BatchUploadResultItem = {
        file: item.file,
        success: false,
        error: err instanceof Error ? err.message : String(err),
      };
      results.push(res);
      onItemDone?.(i, res);
    }
  }
  return results;
}



export async function deleteFile(fileId: string): Promise<void> {
  // 1. Fetch file record to get storage_path
  const { data: fileRecord, error: fetchError } = await supabase
    .from("client_files")
    .select("storage_path")
    .eq("id", fileId)
    .single();

  if (fetchError) {
    throw new Error(`Erro ao buscar arquivo: ${fetchError.message}`);
  }

  // 2. Remove from Storage
  const { error: storageError } = await supabase.storage
    .from("client-documents")
    .remove([(fileRecord as { storage_path: string }).storage_path]);

  if (storageError) {
    throw new Error(`Erro ao remover arquivo do storage: ${storageError.message}`);
  }

  // 3. Delete metadata from DB
  const { error: dbError } = await supabase
    .from("client_files")
    .delete()
    .eq("id", fileId);

  if (dbError) {
    throw new Error(`Erro ao remover registro do arquivo: ${dbError.message}`);
  }
}

export async function getFileUrl(
  storagePath: string,
  expiresIn: number = 3600,
): Promise<string> {
  const { data, error } = await supabase.storage
    .from("client-documents")
    .createSignedUrl(storagePath, expiresIn);

  if (error) {
    throw new Error(`Erro ao gerar URL do arquivo: ${error.message}`);
  }

  return data.signedUrl;
}
