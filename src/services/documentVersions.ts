// =============================================================================
// documentVersions service — Fase D
// =============================================================================

import { supabase } from "@/lib/backend/client";

export type VersionSource = "manual" | "chat_ai" | "editor" | "restored" | "initial";

export interface DocumentVersion {
  id: string;
  document_id: string;
  organization_id: string;
  version: number;
  content: string;
  change_summary: string | null;
  source: VersionSource;
  created_by: string | null;
  created_at: string;
}

export async function listVersions(documentId: string): Promise<DocumentVersion[]> {
  const { data, error } = await supabase
    .from("document_versions")
    .select("*")
    .eq("document_id", documentId)
    .order("version", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as DocumentVersion[];
}

/**
 * Aplica novo conteúdo ao documento e grava versão.
 * - Lê versão atual de `documents.version`.
 * - Atualiza `documents.content` + `version + 1`.
 * - Insere linha em `document_versions`.
 */
export async function applyNewVersion(params: {
  documentId: string;
  newContent: string;
  changeSummary: string;
  source: VersionSource;
}): Promise<DocumentVersion> {
  const { documentId, newContent, changeSummary, source } = params;

  const { data: doc, error: docErr } = await supabase
    .from("documents")
    .select("organization_id, version, content")
    .eq("id", documentId)
    .single();
  if (docErr || !doc) throw new Error(docErr?.message ?? "Documento não encontrado");

  const currentVersion = (doc.version as number) ?? 1;
  const nextVersion = currentVersion + 1;

  // Se ainda não existe v1 no histórico, grava a v1 atual antes
  const { data: existing } = await supabase
    .from("document_versions")
    .select("id, version")
    .eq("document_id", documentId)
    .order("version", { ascending: true })
    .limit(1);
  if (!existing || existing.length === 0) {
    await supabase.from("document_versions").insert({
      organization_id: doc.organization_id,
      document_id: documentId,
      version: currentVersion,
      content: doc.content as string,
      change_summary: "Versão inicial",
      source: "initial",
    });
  }

  const userRes = await supabase.auth.getUser();
  const userId = userRes.data.user?.id ?? null;

  const { data: inserted, error: insErr } = await supabase
    .from("document_versions")
    .insert({
      organization_id: doc.organization_id,
      document_id: documentId,
      version: nextVersion,
      content: newContent,
      change_summary: changeSummary,
      source,
      created_by: userId,
    })
    .select("*")
    .single();
  if (insErr) throw new Error(insErr.message);

  const { error: upErr } = await supabase
    .from("documents")
    .update({ content: newContent, version: nextVersion })
    .eq("id", documentId);
  if (upErr) throw new Error(upErr.message);

  return inserted as DocumentVersion;
}

export async function restoreVersion(documentId: string, versionId: string): Promise<DocumentVersion> {
  const { data: v, error } = await supabase
    .from("document_versions")
    .select("content, version")
    .eq("id", versionId)
    .single();
  if (error || !v) throw new Error(error?.message ?? "Versão não encontrada");
  return applyNewVersion({
    documentId,
    newContent: v.content as string,
    changeSummary: `Restaurada a partir da versão ${v.version}`,
    source: "restored",
  });
}
