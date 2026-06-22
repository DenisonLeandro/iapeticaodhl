import { supabase } from "@/lib/backend/client";
import type { ClientFile } from "@/types/client";
import { sanitizeStorageKey } from "@/lib/utils/sanitize-filename";
import { splitPdfIfLarge } from "@/lib/pdf/split-large-pdf";

export async function listFiles(clientId: string): Promise<ClientFile[]> {
  // PR-3.6: oculta partes filhas — só mostra documentos lógicos (parent_file_id IS NULL).
  const { data, error } = await supabase
    .from("client_files")
    .select("*")
    .eq("client_id", clientId)
    .is("parent_file_id", null)
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

/**
 * Insere uma linha em client_files. Quando `storagePath` é null trata-se da linha
 * "pai" agregadora (PR-3.6) — sem arquivo próprio no storage.
 */
async function insertClientFileRow(
  organizationId: string,
  clientId: string,
  uploadedBy: string,
  fileName: string,
  fileType: string | null,
  fileSize: number,
  storagePath: string | null,
  options: UploadFileOptions & {
    description?: string | null;
    parent_file_id?: string | null;
    logical_file_name?: string | null;
    part_index?: number | null;
    total_parts?: number | null;
  },
): Promise<ClientFile> {
  const { data, error } = await supabase
    .from("client_files")
    .insert({
      organization_id: organizationId,
      client_id: clientId,
      uploaded_by: uploadedBy,
      file_name: fileName,
      file_type: fileType,
      file_size: fileSize,
      storage_path: storagePath,
      description: options.description ?? null,
      document_kind: options.document_kind ?? null,
      case_id: options.case_id ?? null,
      represented_party: options.represented_party ?? null,
      processing_status: "pending",
      parent_file_id: options.parent_file_id ?? null,
      logical_file_name: options.logical_file_name ?? null,
      part_index: options.part_index ?? null,
      total_parts: options.total_parts ?? null,
    })
    .select()
    .single();

  if (error) throw new Error(`Erro ao salvar metadados do arquivo: ${error.message}`);
  return data as ClientFile;
}

async function uploadToStorage(
  organizationId: string,
  clientId: string,
  file: File,
): Promise<string> {
  const safeName = sanitizeStorageKey(file.name);
  const storagePath = `${organizationId}/${clientId}/${Date.now()}_${Math.random()
    .toString(36)
    .slice(2, 8)}_${safeName}`;
  const { error } = await supabase.storage
    .from("client-documents")
    .upload(storagePath, file, { contentType: file.type });
  if (error) throw new Error(`Erro ao fazer upload do arquivo: ${error.message}`);
  return storagePath;
}

/**
 * Upload com split automático (PR-3.6).
 * - PDFs pequenos: 1 linha em client_files + storage_path próprio (comportamento legado).
 * - PDFs grandes: cria 1 linha "pai" sem storage_path + N linhas "parte" com storage_path
 *   e parent_file_id apontando para o pai. Cada parte é enfileirada para processamento.
 *   O gatilho `aggregate_parent_file_status` atualiza o pai quando todas terminam.
 */
export async function uploadFile(
  organizationId: string,
  clientId: string,
  uploadedBy: string,
  file: File,
  description?: string,
  options?: UploadFileOptions,
): Promise<ClientFile> {
  const split = await splitPdfIfLarge(file);

  if (!split.needsSplit) {
    const storagePath = await uploadToStorage(organizationId, clientId, file);
    try {
      const row = await insertClientFileRow(
        organizationId,
        clientId,
        uploadedBy,
        file.name,
        file.type,
        file.size,
        storagePath,
        { ...(options ?? {}), description },
      );
      supabase.functions
        .invoke("enqueue-file-processing", { body: { file_id: row.id } })
        .catch(() => {});
      return row;
    } catch (err) {
      await supabase.storage.from("client-documents").remove([storagePath]);
      throw err;
    }
  }

  // ------ Split path ------
  // 1) Cria a linha "pai" (sem storage_path). file_size = tamanho original.
  const parent = await insertClientFileRow(
    organizationId,
    clientId,
    uploadedBy,
    file.name,
    file.type || "application/pdf",
    file.size,
    null,
    {
      ...(options ?? {}),
      description,
      logical_file_name: file.name,
      total_parts: split.parts.length,
    },
  );

  // 2) Upload + insert + enqueue para cada parte, em série (preserva ordem e poupa memória).
  const uploadedPaths: string[] = [];
  const childIds: string[] = [];
  try {
    for (const part of split.parts) {
      const storagePath = await uploadToStorage(organizationId, clientId, part.file);
      uploadedPaths.push(storagePath);
      const child = await insertClientFileRow(
        organizationId,
        clientId,
        uploadedBy,
        part.file.name,
        "application/pdf",
        part.file.size,
        storagePath,
        {
          ...(options ?? {}),
          description: null,
          parent_file_id: parent.id,
          logical_file_name: file.name,
          part_index: part.partIndex,
          total_parts: part.totalParts,
        },
      );
      childIds.push(child.id);
      supabase.functions
        .invoke("enqueue-file-processing", { body: { file_id: child.id } })
        .catch(() => {});
    }
  } catch (err) {
    // Rollback best-effort: remove storage e linhas criadas.
    try {
      if (uploadedPaths.length) {
        await supabase.storage.from("client-documents").remove(uploadedPaths);
      }
    } catch { /* ignore */ }
    try {
      if (childIds.length) {
        await supabase.from("client_files").delete().in("id", childIds);
      }
    } catch { /* ignore */ }
    try {
      await supabase.from("client_files").delete().eq("id", parent.id);
    } catch { /* ignore */ }
    throw err;
  }

  return parent;
}

export interface ClientCaseOption {
  id: string;
  case_number: string;
  court: string | null;
  branch: string | null;
  subject: string | null;
  opposing_party: string | null;
  represented_party: string | null;
}

export async function listCasesByClient(clientId: string): Promise<ClientCaseOption[]> {
  const { data, error } = await supabase
    .from("cases")
    .select("id, case_number, court, branch, subject, opposing_party, represented_party")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Erro ao buscar processos do cliente: ${error.message}`);
  }

  return (data ?? []) as ClientCaseOption[];
}


export async function listFilesByCase(caseId: string): Promise<ClientFile[]> {
  // PR-3.6: oculta partes filhas.
  const { data, error } = await supabase
    .from("client_files")
    .select(
      "id, organization_id, client_id, case_id, file_name, file_type, file_size, storage_path, description, document_kind, represented_party, processing_status, analysis_summary, analysis_json, processed_at, error_message, created_at, updated_at, parent_file_id, logical_file_name, part_index, total_parts",
    )
    .eq("case_id", caseId)
    .is("parent_file_id", null)
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
  // PR-3.6: ao deletar um documento lógico, também removemos os filhos do storage.
  // O ON DELETE CASCADE em parent_file_id cuida das linhas filhas no banco.
  const { data: row, error: fetchError } = await supabase
    .from("client_files")
    .select("storage_path")
    .eq("id", fileId)
    .single();
  if (fetchError) throw new Error(`Erro ao buscar arquivo: ${fetchError.message}`);

  const { data: children } = await supabase
    .from("client_files")
    .select("storage_path")
    .eq("parent_file_id", fileId);

  const paths: string[] = [];
  const root = (row as { storage_path: string | null }).storage_path;
  if (root) paths.push(root);
  for (const c of (children ?? []) as Array<{ storage_path: string | null }>) {
    if (c.storage_path) paths.push(c.storage_path);
  }
  if (paths.length) {
    const { error: storageError } = await supabase.storage
      .from("client-documents")
      .remove(paths);
    if (storageError) {
      throw new Error(`Erro ao remover arquivo do storage: ${storageError.message}`);
    }
  }

  const { error: dbError } = await supabase.from("client_files").delete().eq("id", fileId);
  if (dbError) throw new Error(`Erro ao remover registro do arquivo: ${dbError.message}`);
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
