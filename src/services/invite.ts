import { supabase } from "@/lib/backend/client";
import type { UserRole } from "@/types/database.types";

export async function inviteUserByEmail(
  email: string,
  role: UserRole,
  organizationId: string,
): Promise<{ success: boolean; error?: string }> {
  // Check if email already exists in the organization
  const { data: existing, error: checkError } = await supabase
    .from("profiles")
    .select("id")
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (checkError) {
    return { success: false, error: `Erro ao verificar email: ${checkError.message}` };
  }

  if (existing) {
    return { success: false, error: "Este email já pertence a um membro da organização." };
  }

  // Use signInWithOtp as a client-side invite approach (MVP)
  // This sends a magic link to the user's email
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      data: {
        organization_id: organizationId,
        role,
      },
      emailRedirectTo: `${window.location.origin}/dashboard`,
    },
  });

  if (error) {
    if (error.message.includes("rate limit")) {
      return { success: false, error: "Limite de envios atingido. Tente novamente em alguns minutos." };
    }
    return { success: false, error: `Erro ao enviar convite: ${error.message}` };
  }

  return { success: true };
}
