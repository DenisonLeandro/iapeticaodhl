// =============================================================================
// PR-4.5A — Serviço de Playbooks Jurídicos.
// =============================================================================
import { supabase } from "@/integrations/supabase/client";
import type { LegalPlaybook, PlaybookConfig } from "@/types/legalPlaybook";
import {
  MOTORISTA_PLAYBOOK_CONFIG,
  MOTORISTA_PLAYBOOK_META,
} from "./playbookSeeds";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export async function listPlaybooks(): Promise<LegalPlaybook[]> {
  const { data, error } = await db
    .from("legal_playbooks")
    .select("*")
    .order("legal_area")
    .order("document_type")
    .order("name");
  if (error) throw error;
  return (data ?? []) as LegalPlaybook[];
}

export async function getPlaybook(id: string): Promise<LegalPlaybook | null> {
  const { data, error } = await db.from("legal_playbooks").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return (data ?? null) as LegalPlaybook | null;
}

export interface PlaybookInput {
  name: string;
  legal_area: string;
  document_type: string;
  case_subtype: string | null;
  description: string | null;
  is_active: boolean;
  config: PlaybookConfig;
}

export async function createPlaybook(
  organization_id: string,
  created_by: string | null,
  input: PlaybookInput,
): Promise<LegalPlaybook> {
  const { data, error } = await db
    .from("legal_playbooks")
    .insert({
      organization_id,
      created_by,
      version: 1,
      ...input,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as LegalPlaybook;
}

export async function updatePlaybook(id: string, patch: Partial<PlaybookInput>): Promise<LegalPlaybook> {
  const { data, error } = await db
    .from("legal_playbooks")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return data as LegalPlaybook;
}

export async function togglePlaybookActive(id: string, is_active: boolean): Promise<void> {
  const { error } = await db.from("legal_playbooks").update({ is_active }).eq("id", id);
  if (error) throw error;
}

export async function duplicatePlaybook(
  source: LegalPlaybook,
  organization_id: string,
  created_by: string | null,
): Promise<LegalPlaybook> {
  return createPlaybook(organization_id, created_by, {
    name: `${source.name} (cópia)`,
    legal_area: source.legal_area,
    document_type: source.document_type,
    case_subtype: source.case_subtype,
    description: source.description,
    is_active: false,
    config: source.config,
  });
}

export async function deletePlaybook(id: string): Promise<void> {
  const { error } = await db.from("legal_playbooks").delete().eq("id", id);
  if (error) throw error;
}

export async function installMotoristaPlaybook(
  organization_id: string,
  created_by: string | null,
): Promise<{ playbook: LegalPlaybook | null; alreadyExists: boolean }> {
  // Verifica se já existe ativo idêntico
  const { data: existing } = await db
    .from("legal_playbooks")
    .select("*")
    .eq("organization_id", organization_id)
    .eq("legal_area", MOTORISTA_PLAYBOOK_META.legal_area)
    .eq("document_type", MOTORISTA_PLAYBOOK_META.document_type)
    .eq("case_subtype", MOTORISTA_PLAYBOOK_META.case_subtype)
    .eq("is_active", true)
    .maybeSingle();

  if (existing) return { playbook: existing as LegalPlaybook, alreadyExists: true };

  const created = await createPlaybook(organization_id, created_by, {
    name: MOTORISTA_PLAYBOOK_META.name,
    legal_area: MOTORISTA_PLAYBOOK_META.legal_area,
    document_type: MOTORISTA_PLAYBOOK_META.document_type,
    case_subtype: MOTORISTA_PLAYBOOK_META.case_subtype,
    description: MOTORISTA_PLAYBOOK_META.description,
    is_active: true,
    config: MOTORISTA_PLAYBOOK_CONFIG,
  });
  return { playbook: created, alreadyExists: false };
}
