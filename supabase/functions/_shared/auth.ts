import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Cliente com identidade do usuário — usado para reaproveitar RLS.
export function userClient(req: Request) {
  const authHeader = req.headers.get("Authorization") ?? "";
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });
}

// Cliente de serviço — bypassa RLS. Uso restrito a edge functions.
export function serviceClient() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
}

// Valida JWT do usuário e retorna claims + organização. Usar em funções expostas.
export async function requireUser(req: Request): Promise<{
  userId: string;
  organizationId: string;
  isAdmin: boolean;
} | null> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.slice("Bearer ".length);
  const supa = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false },
  });
  const { data, error } = await supa.auth.getUser(token);
  if (error || !data?.user) return null;
  const svc = serviceClient();
  const { data: profile } = await svc
    .from("profiles")
    .select("organization_id, role")
    .eq("id", data.user.id)
    .maybeSingle();
  if (!profile?.organization_id) return null;
  return {
    userId: data.user.id,
    organizationId: profile.organization_id,
    isAdmin: profile.role === "admin",
  };
}

// Garante que apenas service_role pode invocar (functions internas).
// Aceita Authorization: Bearer <service_role_key> OU header x-internal-token.
export function requireServiceRole(req: Request): boolean {
  const auth = req.headers.get("Authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  const internal = req.headers.get("x-internal-token") ?? "";
  return (
    (token && token === SUPABASE_SERVICE_ROLE_KEY) ||
    (internal && internal === SUPABASE_SERVICE_ROLE_KEY)
  );
}
