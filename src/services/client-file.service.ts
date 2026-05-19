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

export async function uploadFile(
  organizationId: string,
  clientId: string,
  uploadedBy: string,
  file: File,
  description?: string,
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
    })
    .select()
    .single();

  if (dbError) {
    // Attempt to clean up the uploaded file if DB insert fails
    await supabase.storage.from("client-documents").remove([storagePath]);
    throw new Error(`Erro ao salvar metadados do arquivo: ${dbError.message}`);
  }

  return data as ClientFile;
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
