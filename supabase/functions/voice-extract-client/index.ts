import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { logAiUsage } from "../_shared/usage-log.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `Você é um assistente jurídico brasileiro. Receba a transcrição de voz de um usuário descrevendo os dados de um cliente e extraia as informações estruturadas.

Retorne APENAS um JSON válido (sem markdown, sem comentários) com os campos abaixo. Use null para campos não mencionados.

{
  "nome": "string — nome completo ou razão social",
  "tipoDocumento": "cpf" | "cnpj" | null,
  "documento": "string — apenas dígitos, sem pontuação",
  "email": "string | null",
  "telefone": "string — apenas dígitos (DDD + número), sem pontuação",
  "endereco": {
    "cep": "string — 8 dígitos | null",
    "rua": "string | null",
    "numero": "string | null",
    "complemento": "string | null",
    "bairro": "string | null",
    "cidade": "string | null",
    "estado": "string — sigla UF 2 letras | null"
  },
  "notas": "string | null — qualquer informação extra mencionada"
}

Regras:
- CPF tem 11 dígitos, CNPJ tem 14 dígitos.
- Se o usuário disser "CPF" ou um número com 11 dígitos, use tipoDocumento = "cpf".
- Se disser "CNPJ" ou um número com 14 dígitos, use tipoDocumento = "cnpj".
- Telefone: remova parênteses, traços, espaços. Mantenha apenas dígitos.
- CEP: 8 dígitos sem traço.
- Estado: use sigla de 2 letras maiúsculas (SP, RJ, MG, etc.).
- Não invente dados. Se não foi mencionado, use null.`;

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startedAt = Date.now();
  try {
    const { transcript } = await req.json();

    if (!transcript || typeof transcript !== "string" || transcript.trim().length < 5) {
      return new Response(
        JSON.stringify({ error: "Transcrição muito curta ou ausente." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ error: "Chave de API não configurada." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Telemetria best-effort — depende de Authorization Bearer válido.
    let userId: string | null = null;
    let orgId: string | null = null;
    let adminClient: ReturnType<typeof createClient> | null = null;
    const authHeader = req.headers.get("Authorization");
    try {
      if (authHeader?.startsWith("Bearer ")) {
        const uc = createClient(
          Deno.env.get("SUPABASE_URL")!,
          Deno.env.get("SUPABASE_ANON_KEY")!,
          { global: { headers: { Authorization: authHeader } }, auth: { persistSession: false } },
        );
        const { data: u } = await uc.auth.getUser();
        userId = u?.user?.id ?? null;
        adminClient = createClient(
          Deno.env.get("SUPABASE_URL")!,
          Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
          { auth: { persistSession: false } },
        );
        if (userId) {
          const { data: p } = await adminClient.from("profiles").select("organization_id").eq("id", userId).maybeSingle();
          orgId = (p?.organization_id as string | null) ?? null;
        }
      }
    } catch { /* best-effort */ }

    const logT = async (status: "success" | "error", tIn: number, tOut: number, extra?: Record<string, unknown>) => {
      if (!adminClient || !orgId || !userId) return;
      const cost = (tIn / 1_000_000) * 0.075 + (tOut / 1_000_000) * 0.30;
      await logAiUsage(adminClient, {
        organization_id: orgId,
        profile_id: userId,
        operation: "extraction",
        provider: "lovable",
        model: "google/gemini-3-flash-preview",
        tokens_input: tIn,
        tokens_output: tOut,
        cost_estimated: cost,
        processing_time_ms: Date.now() - startedAt,
        prompt_summary: "voice_extract_client",
        metadata: { edge_function: "voice-extract-client", status, ...(extra ?? {}) },
      });
    };

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: transcript.trim() },
        ],
      }),
    });

    if (!response.ok) {
      await logT("error", 0, 0, { http_status: response.status });
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em instantes." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Créditos de IA insuficientes." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      const text = await response.text();
      console.error("AI gateway error:", response.status, text);
      return new Response(
        JSON.stringify({ error: "Erro ao processar com IA." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    const tIn = Number(data?.usage?.prompt_tokens ?? Math.ceil(transcript.length / 4));
    const tOut = Number(data?.usage?.completion_tokens ?? Math.ceil((content ?? "").length / 4));

    if (!content) {
      await logT("error", tIn, tOut, { empty_response: true });
      return new Response(
        JSON.stringify({ error: "Resposta vazia da IA." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const cleaned = content.replace(/^```(?:json)?\s*\n?/i, "").replace(/\n?```\s*$/i, "").trim();

    try {
      const extracted = JSON.parse(cleaned);
      await logT("success", tIn, tOut, { parse_ok: true });
      return new Response(
        JSON.stringify({ extracted }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    } catch {
      console.error("Failed to parse AI response:", cleaned);
      await logT("error", tIn, tOut, { parse_ok: false });
      return new Response(
        JSON.stringify({ error: "IA retornou formato inválido.", raw: cleaned }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
  } catch (err) {
    console.error("voice-extract-client error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Erro interno." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
