// =============================================================================
// Edge Function: ai-generate — Lovable AI Gateway + external providers
// =============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface AIGenerateBody {
  prompt: string;
  provider: "lovable" | "openai" | "gemini" | "claude";
  model: string;
  organizationId: string;
  documentType?: string;
  context?: Record<string, string>;
  systemPrompt?: string;
}

interface LLMResult {
  content: string;
  tokensUsed: { input: number; output: number };
  model: string;
  provider: string;
}

const DEFAULT_SYSTEM =
  "Você é um assistente jurídico especializado em direito brasileiro. Gere documentos jurídicos precisos e bem formatados em HTML.";

// ---------------------------------------------------------------------------
// Lovable AI Gateway
// ---------------------------------------------------------------------------

async function callLovableAI(prompt: string, model: string, systemPrompt: string): Promise<LLMResult> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: prompt },
      ],
    }),
  });

  if (response.status === 429) {
    throw new Error("429: Limite de requisições excedido. Tente novamente em alguns instantes.");
  }
  if (response.status === 402) {
    throw new Error("402: Créditos insuficientes. Adicione créditos em Settings > Workspace > Usage.");
  }
  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Lovable AI error (${response.status}): ${err}`);
  }

  const data = await response.json();
  return {
    content: data.choices?.[0]?.message?.content ?? "",
    tokensUsed: {
      input: data.usage?.prompt_tokens ?? 0,
      output: data.usage?.completion_tokens ?? 0,
    },
    model: data.model ?? model,
    provider: "lovable",
  };
}

// ---------------------------------------------------------------------------
// External providers
// ---------------------------------------------------------------------------

async function callOpenAI(prompt: string, model: string, apiKey: string, systemPrompt: string): Promise<LLMResult> {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages: [{ role: "system", content: systemPrompt }, { role: "user", content: prompt }],
      max_tokens: 8192,
    }),
  });
  if (!response.ok) { const err = await response.text(); throw new Error(`OpenAI error (${response.status}): ${err}`); }
  const data = await response.json();
  return {
    content: data.choices?.[0]?.message?.content ?? "",
    tokensUsed: { input: data.usage?.prompt_tokens ?? 0, output: data.usage?.completion_tokens ?? 0 },
    model: data.model ?? model,
    provider: "openai",
  };
}

async function callGemini(prompt: string, model: string, apiKey: string, systemPrompt: string): Promise<LLMResult> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: `${systemPrompt}\n\n${prompt}` }] }],
      generationConfig: { maxOutputTokens: 8192 },
    }),
  });
  if (!response.ok) { const err = await response.text(); throw new Error(`Gemini error (${response.status}): ${err}`); }
  const data = await response.json();
  const usage = data.usageMetadata ?? {};
  return {
    content: data.candidates?.[0]?.content?.parts?.[0]?.text ?? "",
    tokensUsed: { input: usage.promptTokenCount ?? 0, output: usage.candidatesTokenCount ?? 0 },
    model,
    provider: "gemini",
  };
}

async function callClaude(prompt: string, model: string, apiKey: string, systemPrompt: string): Promise<LLMResult> {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "Content-Type": "application/json" },
    body: JSON.stringify({ model, max_tokens: 8192, system: systemPrompt, messages: [{ role: "user", content: prompt }] }),
  });
  if (!response.ok) { const err = await response.text(); throw new Error(`Claude error (${response.status}): ${err}`); }
  const data = await response.json();
  return {
    content: data.content?.[0]?.type === "text" ? data.content[0].text : "",
    tokensUsed: { input: data.usage?.input_tokens ?? 0, output: data.usage?.output_tokens ?? 0 },
    model: data.model ?? model,
    provider: "claude",
  };
}

// ---------------------------------------------------------------------------
// Get API key from org config (for external providers only)
// ---------------------------------------------------------------------------

async function getOrgApiKey(organizationId: string, provider: string): Promise<string> {
  const serviceSupabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
  const { data, error } = await serviceSupabase
    .from("organizations")
    .select("llm_config")
    .eq("id", organizationId)
    .single();

  if (error) throw new Error(`Failed to fetch org config: ${error.message}`);

  const config = (data as Record<string, unknown> | null)?.llm_config as Record<string, unknown> | null;
  const apiKey = config?.api_key as string | undefined;
  if (!apiKey) {
    throw new Error(`Nenhuma chave de API configurada para o provedor "${provider}". Vá em Configurações > Integrações IA para configurar.`);
  }
  return apiKey;
}

// ---------------------------------------------------------------------------
// Cost estimation
// ---------------------------------------------------------------------------

function estimateCost(provider: string, inputTokens: number, outputTokens: number): number {
  const rates: Record<string, { input: number; output: number }> = {
    lovable: { input: 0.001, output: 0.004 },
    openai: { input: 0.005, output: 0.015 },
    gemini: { input: 0.00125, output: 0.005 },
    claude: { input: 0.003, output: 0.015 },
  };
  const rate = rates[provider] ?? { input: 0.01, output: 0.03 };
  return (inputTokens / 1000) * rate.input + (outputTokens / 1000) * rate.output;
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing Authorization header" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body: AIGenerateBody = await req.json();
    const { prompt, provider, model, organizationId, systemPrompt } = body;

    if (!prompt || !provider || !model || !organizationId) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sysPrompt = systemPrompt || DEFAULT_SYSTEM;
    let result: LLMResult;

    if (provider === "lovable") {
      result = await callLovableAI(prompt, model, sysPrompt);
    } else {
      const apiKey = await getOrgApiKey(organizationId, provider);
      switch (provider) {
        case "openai": result = await callOpenAI(prompt, model, apiKey, sysPrompt); break;
        case "gemini": result = await callGemini(prompt, model, apiKey, sysPrompt); break;
        case "claude": result = await callClaude(prompt, model, apiKey, sysPrompt); break;
        default:
          return new Response(JSON.stringify({ error: `Unsupported provider: ${provider}` }), {
            status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
      }
    }

    // Log usage
    const serviceSupabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    try {
      await serviceSupabase.from("ai_usage_log").insert({
        organization_id: organizationId,
        profile_id: user.id,
        provider,
        model: result.model,
        tokens_input: result.tokensUsed.input,
        tokens_output: result.tokensUsed.output,
        cost_estimated: estimateCost(provider, result.tokensUsed.input, result.tokensUsed.output),
        prompt_summary: prompt.substring(0, 500),
      });
    } catch { /* best-effort logging */ }

    return new Response(JSON.stringify(result), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    let status = 500;
    if (message.startsWith("429:")) status = 429;
    else if (message.startsWith("402:")) status = 402;
    console.error("ai-generate error:", message);
    return new Response(JSON.stringify({ error: message }), {
      status, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
