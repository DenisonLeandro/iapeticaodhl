// One-shot: copia SUPABASE_SERVICE_ROLE_KEY do ambiente para o Vault para uso pelo cron.
// Aceita apenas service_role bearer (auto-invocação).
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { corsHeaders, json } from "../_shared/cors.ts";
import { requireServiceRole, serviceClient } from "../_shared/auth.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (!requireServiceRole(req)) return json({ error: "Forbidden" }, 403);

  const svc = serviceClient();
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  // Atualiza o segredo existente; se não existir, cria.
  const { error } = await svc.rpc("bootstrap_service_key_vault", { p_key: key });
  if (error) return json({ error: error.message }, 500);
  return json({ ok: true });
});
