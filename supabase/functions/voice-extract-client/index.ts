import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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

    if (!content) {
      return new Response(
        JSON.stringify({ error: "Resposta vazia da IA." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Strip markdown fences
    const cleaned = content.replace(/^```(?:json)?\s*\n?/i, "").replace(/\n?```\s*$/i, "").trim();

    try {
      const extracted = JSON.parse(cleaned);
      return new Response(
        JSON.stringify({ extracted }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    } catch {
      console.error("Failed to parse AI response:", cleaned);
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
