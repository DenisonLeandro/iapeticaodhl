// =============================================================================
// Edge Function: voice-extract — Extract structured form data from voice text
// Uses Lovable AI Gateway
// =============================================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { logAiUsage } from "../_shared/usage-log.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `Você é um assistente jurídico que extrai dados estruturados de texto falado por um advogado brasileiro.

O advogado vai descrever um caso jurídico por voz. Extraia TODOS os dados mencionados e retorne um JSON.

Use EXATAMENTE estas chaves (inclua apenas as que encontrar dados):
{
  "autor": { "nome": "", "cpfCnpj": "", "endereco": "", "profissao": "", "estadoCivil": "" },
  "reu": { "nome": "", "cpfCnpj": "", "endereco": "", "profissao": "", "estadoCivil": "" },
  "fatos": "",
  "fundamentacao": "",
  "tribunal": "",
  "vara": "",
  "numeroProcesso": "",
  "pedidos": "",
  "valorCausa": "",
  "instrucoesAdicionais": "",
  "preliminares": "",
  "decisaoRecorrida": "",
  "razoesRecurso": "",
  "tipoContrato": "",
  "objetoContrato": "",
  "destinatarioNotificacao": "",
  "prazoResposta": ""
}

Regras:
- Para "tribunal", use as siglas: STF, STJ, TST, TSE, STM, TJPE, TJSP, TJRJ, TJMG, TRF-1 a TRF-5, Outro
- Para "estadoCivil", use: Solteiro(a), Casado(a), Divorciado(a), Viúvo(a), União Estável
- Para CPF/CNPJ, formate corretamente (000.000.000-00 ou 00.000.000/0001-00)
- Os "fatos" devem ser um texto completo e detalhado baseado no que foi descrito
- Retorne APENAS o JSON, sem markdown, sem explicações`;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const startedAt = Date.now();
  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { transcript } = await req.json();
    if (!transcript || typeof transcript !== "string" || transcript.trim().length < 10) {
      return new Response(JSON.stringify({ error: "Transcrição muito curta ou ausente" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Telemetria best-effort
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
        prompt_summary: "voice_extract",
        metadata: { edge_function: "voice-extract", status, ...(extra ?? {}) },
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
          { role: "user", content: `Texto transcrito do advogado:\n\n"${transcript}"` },
        ],
      }),
    });

    if (!response.ok) {
      await logT("error", 0, 0, { http_status: response.status });
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns instantes." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos insuficientes. Adicione créditos nas configurações." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errText = await response.text();
      console.error("AI gateway error:", response.status, errText);
      return new Response(JSON.stringify({ error: "Erro ao processar com IA" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content ?? "";
    const tIn = Number(data?.usage?.prompt_tokens ?? Math.ceil(transcript.length / 4));
    const tOut = Number(data?.usage?.completion_tokens ?? Math.ceil(content.length / 4));

    let extracted: Record<string, unknown>;
    try {
      const jsonStr = content.replace(/```json?\s*/g, "").replace(/```\s*/g, "").trim();
      extracted = JSON.parse(jsonStr);
    } catch {
      console.error("Failed to parse AI response as JSON:", content);
      await logT("error", tIn, tOut, { parse_ok: false });
      return new Response(JSON.stringify({ error: "Não foi possível interpretar a resposta da IA", raw: content }), {
        status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await logT("success", tIn, tOut, { parse_ok: true });
    return new Response(JSON.stringify({ extracted }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("voice-extract error:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
