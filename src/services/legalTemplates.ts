// =============================================================================
// PR-4.4A — Serviço da Biblioteca de Modelos do Escritório
// =============================================================================
import { supabase } from "@/lib/backend/client";
import { sanitizeStorageKey } from "@/lib/utils/sanitize-filename";
import type {
  LegalTemplate,
  LegalTemplateStatus,
} from "@/types/legalTemplate";

const BUCKET = "legal-templates";
const ACCEPTED_MIME = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
];
const ACCEPTED_EXT = ["pdf", "docx", "txt"];
const MAX_FILE_BYTES = 20 * 1024 * 1024; // 20 MB

export interface LegalTemplateFilters {
  status?: LegalTemplateStatus | "all";
  legal_area?: string;
  piece_type?: string;
  search?: string;
}

export interface LegalTemplateInput {
  name: string;
  description?: string | null;
  internal_notes?: string | null;
  legal_area?: string | null;
  piece_type?: string | null;
  main_topic?: string | null;
  subtopic?: string | null;
  represented_party?: string | null;
  procedural_stage?: string | null;
  status?: LegalTemplateStatus;
}

function isAcceptedFile(file: File): boolean {
  const ext = (file.name.split(".").pop() ?? "").toLowerCase();
  return ACCEPTED_MIME.includes(file.type) || ACCEPTED_EXT.includes(ext);
}

async function getOrganizationId(): Promise<string> {
  const { data, error } = await supabase
    .from("profiles")
    .select("organization_id")
    .eq("id", (await supabase.auth.getUser()).data.user!.id)
    .maybeSingle();
  if (error || !data?.organization_id) {
    throw new Error("Organização não encontrada.");
  }
  return data.organization_id as string;
}

export async function listLegalTemplates(
  filters: LegalTemplateFilters = {},
): Promise<LegalTemplate[]> {
  let q = supabase
    .from("legal_templates")
    .select("*")
    .order("created_at", { ascending: false });
  if (filters.status && filters.status !== "all") q = q.eq("status", filters.status);
  if (filters.legal_area) q = q.eq("legal_area", filters.legal_area);
  if (filters.piece_type) q = q.eq("piece_type", filters.piece_type);
  if (filters.search) q = q.ilike("name", `%${filters.search}%`);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as LegalTemplate[];
}

export async function getLegalTemplate(id: string): Promise<LegalTemplate> {
  const { data, error } = await supabase
    .from("legal_templates")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Modelo não encontrado.");
  return data as unknown as LegalTemplate;
}

export async function createLegalTemplate(
  input: LegalTemplateInput,
): Promise<LegalTemplate> {
  const organization_id = await getOrganizationId();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from("legal_templates")
    .insert({
      ...input,
      organization_id,
      created_by: user?.id ?? null,
      updated_by: user?.id ?? null,
      status: input.status ?? "active",
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data as unknown as LegalTemplate;
}

export async function updateLegalTemplate(
  id: string,
  patch: Partial<LegalTemplateInput>,
): Promise<LegalTemplate> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from("legal_templates")
    .update({ ...patch, updated_by: user?.id ?? null })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data as unknown as LegalTemplate;
}

export async function setLegalTemplateStatus(
  id: string,
  status: LegalTemplateStatus,
): Promise<void> {
  const { error } = await supabase
    .from("legal_templates")
    .update({ status })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export async function uploadLegalTemplateFile(
  templateId: string,
  file: File,
): Promise<LegalTemplate> {
  if (!isAcceptedFile(file)) {
    throw new Error("Formato não suportado. Use .docx, .pdf ou .txt.");
  }
  if (file.size > MAX_FILE_BYTES) {
    throw new Error("Arquivo excede 20 MB.");
  }
  const organization_id = await getOrganizationId();
  const safeName = sanitizeStorageKey(file.name);
  const path = `${organization_id}/${templateId}/${Date.now()}_${safeName}`;

  const upload = await supabase.storage.from(BUCKET).upload(path, file, {
    upsert: true,
    contentType: file.type || undefined,
  });
  if (upload.error) throw new Error(upload.error.message);

  const patch = {
    file_name: file.name,
    file_path: path,
    file_mime_type: file.type || null,
    file_size_bytes: file.size,
    analysis_status: "pending" as const,
    analysis_error: null as string | null,
    // Reset analysis fields — new file requires re-analysis
    extracted_text: null,
    structure_summary: null,
    style_summary: null,
    standard_sections: null,
    topic_structure: null,
    writing_patterns: null,
    request_patterns: null,
    risk_notes: null,
    usage_guidelines: null,
    analyzed_at: null,
  };
  const { data, error } = await supabase
    .from("legal_templates")
    .update(patch)
    .eq("id", templateId)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data as unknown as LegalTemplate;
}

export async function getLegalTemplateDownloadUrl(
  path: string,
): Promise<string> {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, 60 * 10);
  if (error || !data?.signedUrl) throw new Error(error?.message ?? "Falha ao gerar URL.");
  return data.signedUrl;
}

/**
 * Baixa o arquivo do modelo via fetch da signed URL, evitando navegar para o
 * host do Storage (que pode ser bloqueado por extensões — ERR_BLOCKED_BY_CLIENT).
 * Mantém o bucket privado e a URL assinada; apenas o transporte muda para Blob local.
 */
export async function downloadLegalTemplateBlob(
  path: string,
  fileName: string,
): Promise<void> {
  const signedUrl = await getLegalTemplateDownloadUrl(path);
  const res = await fetch(signedUrl);
  if (!res.ok) throw new Error(`Falha ao baixar arquivo (${res.status}).`);
  const blob = await res.blob();
  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = objectUrl;
  a.download = fileName || "modelo";
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
}

export async function analyzeLegalTemplate(templateId: string): Promise<void> {
  const { error } = await supabase.functions.invoke("analyze-legal-template", {
    body: { template_id: templateId },
  });
  if (error) throw new Error(error.message);
}
