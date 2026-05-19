import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const CLIENT_PROMPT = `Você é um sistema de OCR especializado em documentos brasileiros.
Analise a imagem enviada e extraia os dados do cliente/pessoa.
Retorne APENAS um JSON válido (sem markdown, sem crases) com a seguinte estrutura:
{
  "full_name": "string ou null",
  "document_type": "cpf" ou "cnpj" ou null,
  "document_number": "string somente dígitos ou null",
  "email": "string ou null",
  "phone": "string somente dígitos ou null",
  "address": {
    "zip_code": "string 8 dígitos ou null",
    "street": "string ou null",
    "number": "string ou null",
    "complement": "string ou null",
    "neighborhood": "string ou null",
    "city": "string ou null",
    "state": "string 2 letras maiúsculas ou null"
  },
  "notes": "string ou null"
}
Se um campo não for encontrado na imagem, use null. Não invente dados.`;

const PETITION_PROMPT = `Você é um sistema de OCR especializado em documentos jurídicos brasileiros.
Analise a imagem enviada e extraia os dados relevantes para preenchimento de uma petição.
Retorne APENAS um JSON válido (sem markdown, sem crases) com a seguinte estrutura:
{
  "nomeAutor": "string ou null",
  "cpfAutor": "string somente dígitos ou null",
  "enderecoAutor": "string ou null",
  "nomeReu": "string ou null",
  "cpfReu": "string somente dígitos ou null",
  "enderecoReu": "string ou null",
  "numeroProcesso": "string ou null",
  "tribunal": "string abreviação ex: TJSP, TRF1 ou null",
  "vara": "string ou null",
  "comarca": "string ou null",
  "fatos": "string resumo dos fatos ou null",
  "fundamentacaoJuridica": "string ou null",
  "pedidos": "string ou null",
  "valorCausa": "string ou null"
}
Se um campo não for encontrado na imagem, use null. Não invente dados.`;

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { image, context } = await req.json();

    if (!image || typeof image !== "string") {
      return new Response(
        JSON.stringify({ error: "Campo 'image' (base64) é obrigatório." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!context || !["client", "petition"].includes(context)) {
      return new Response(
        JSON.stringify({ error: "Campo 'context' deve ser 'client' ou 'petition'." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ error: "LOVABLE_API_KEY não configurada." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const systemPrompt = context === "client" ? CLIENT_PROMPT : PETITION_PROMPT;

    // Detect mime type from base64 prefix or default to jpeg
    let mimeType = "image/jpeg";
    if (image.startsWith("data:")) {
      const match = image.match(/^data:(image\/[a-z]+|application\/pdf);base64,/);
      if (match) mimeType = match[1];
    }

    // Strip data URI prefix if present
    const base64Data = image.includes(",") ? image.split(",")[1] : image;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: [
              {
                type: "image_url",
                image_url: {
                  url: `data:${mimeType};base64,${base64Data}`,
                },
              },
              {
                type: "text",
                text: "Extraia os dados estruturados desta imagem/documento.",
              },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("AI Gateway error:", response.status, errText);

      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns segundos." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Créditos insuficientes. Adicione créditos em Configurações." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ error: "Erro ao processar documento com IA." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    const rawContent = data.choices?.[0]?.message?.content ?? "";

    // Strip markdown fences
    const cleaned = rawContent.replace(/```json?\s*/gi, "").replace(/```/g, "").trim();

    try {
      const extracted = JSON.parse(cleaned);
      return new Response(
        JSON.stringify({ extracted }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } catch {
      console.error("Failed to parse AI response:", cleaned);
      return new Response(
        JSON.stringify({ error: "Não foi possível interpretar a resposta da IA.", raw: cleaned }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  } catch (e) {
    console.error("ocr-extract error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
