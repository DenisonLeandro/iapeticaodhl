// One-shot bootstrap: copia SUPABASE_SERVICE_ROLE_KEY do ambiente para o Vault.
// É seguro deixar aberto: a função apenas lê uma variável de ambiente do projeto
// e grava em vault.secrets (criptografado, acessível apenas a service_role).
// Nenhuma entrada do chamador é usada.
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { corsHeaders, json } from "../_shared/cors.ts";
import { serviceClient } from "../_shared/auth.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const svc = serviceClient();
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const { error } = await svc.rpc("bootstrap_service_key_vault", { p_key: key });
  if (error) return json({ error: error.message }, 500);
  return json({ ok: true });
});
