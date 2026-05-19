import { supabase } from "@/lib/backend/client";
import type { Profile, UserRole } from "@/types/database.types";

export async function fetchOrganizationMembers(
  organizationId: string,
): Promise<Profile[]> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, role, organization_id, avatar_url, created_at, updated_at")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(`Erro ao buscar membros: ${error.message}`);
  }

  return (data as unknown as Profile[]) ?? [];
}

export async function updateMemberRole(
  profileId: string,
  newRole: UserRole,
  currentUserId: string,
): Promise<{ success: boolean; error?: string }> {
  if (profileId === currentUserId) {
    return {
      success: false,
      error: "Você não pode alterar seu próprio papel.",
    };
  }

  const { error } = await supabase
    .from("profiles")
    .update({ role: newRole })
    .eq("id", profileId);

  if (error) {
    return { success: false, error: `Erro ao atualizar papel: ${error.message}` };
  }

  return { success: true };
}

export async function removeMember(
  profileId: string,
  organizationId: string,
  currentUserId: string,
): Promise<{ success: boolean; error?: string }> {
  if (profileId === currentUserId) {
    return {
      success: false,
      error: "Você não pode remover a si mesmo da organização.",
    };
  }

  // Check if this is the last admin
  const { data: admins, error: adminError } = await supabase
    .from("profiles")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("role", "admin");

  if (adminError) {
    return { success: false, error: `Erro ao verificar administradores: ${adminError.message}` };
  }

  const memberIsAdmin = admins?.some((a) => a.id === profileId);
  if (memberIsAdmin && admins && admins.length <= 1) {
    return {
      success: false,
      error: "Não é possível remover o último administrador da organização.",
    };
  }

  const { error } = await supabase
    .from("profiles")
    .delete()
    .eq("id", profileId)
    .eq("organization_id", organizationId);

  if (error) {
    return { success: false, error: `Erro ao remover membro: ${error.message}` };
  }

  return { success: true };
}
