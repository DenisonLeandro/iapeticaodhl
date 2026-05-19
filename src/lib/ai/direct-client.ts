// =============================================================================
// Direct AI Client — Lovable-compatible alternative to Edge Function
// =============================================================================

import { supabase } from '@/integrations/supabase/client';
import type {
  AIGenerateRequest,
  AIGenerateResponse,
  LLMProviderId,
} from '@/types/ai';

const DEFAULT_SYSTEM_PROMPT =
  'Você é um assistente jurídico especializado em direito brasileiro. Gere documentos jurídicos precisos e bem formatados em HTML.';

async function callOpenAI(
  prompt: string,
  model: string,
  apiKey: string,
  systemPrompt: string,
): Promise<AIGenerateResponse> {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt },
      ],
      max_tokens: 8192,
    }),
  });
  if (!response.ok) { const err = await response.text(); throw new Error(`OpenAI API error (${response.status}): ${err}`); }
  const data = await response.json();
  return {
    content: data.choices?.[0]?.message?.content ?? '',
    tokensUsed: { input: data.usage?.prompt_tokens ?? 0, output: data.usage?.completion_tokens ?? 0 },
    model: data.model ?? model,
    provider: 'openai',
  };
}

async function callGemini(
  prompt: string,
  model: string,
  apiKey: string,
  systemPrompt: string,
): Promise<AIGenerateResponse> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: `${systemPrompt}\n\n${prompt}` }] }],
      generationConfig: { maxOutputTokens: 8192 },
    }),
  });
  if (!response.ok) { const err = await response.text(); throw new Error(`Gemini API error (${response.status}): ${err}`); }
  const data = await response.json();
  const usage = data.usageMetadata ?? {};
  return {
    content: data.candidates?.[0]?.content?.parts?.[0]?.text ?? '',
    tokensUsed: { input: usage.promptTokenCount ?? 0, output: usage.candidatesTokenCount ?? 0 },
    model,
    provider: 'gemini',
  };
}

async function callClaude(
  prompt: string,
  model: string,
  apiKey: string,
  systemPrompt: string,
): Promise<AIGenerateResponse> {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      max_tokens: 8192,
      system: systemPrompt,
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  if (!response.ok) { const err = await response.text(); throw new Error(`Claude API error (${response.status}): ${err}`); }
  const data = await response.json();
  return {
    content: data.content?.[0]?.type === 'text' ? data.content[0].text : '',
    tokensUsed: { input: data.usage?.input_tokens ?? 0, output: data.usage?.output_tokens ?? 0 },
    model: data.model ?? model,
    provider: 'claude',
  };
}

async function getApiKeyFromOrg(organizationId: string, provider: LLMProviderId): Promise<string> {
  const { data, error } = await supabase.from('organizations').select('llm_config').eq('id', organizationId).single();
  if (error) throw new Error(`Failed to fetch org config: ${error.message}`);
  const config = (data as Record<string, unknown> | null)?.llm_config as Record<string, unknown> | null;
  const apiKey = config?.api_key as string | undefined;
  if (!apiKey) throw new Error(`No API key configured for provider "${provider}". Go to Settings > AI to configure your API key.`);
  return apiKey;
}

async function logUsage(request: AIGenerateRequest, response: AIGenerateResponse): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from('ai_usage_log').insert({
      organization_id: request.organizationId,
      profile_id: user.id,
      provider: response.provider,
      model: response.model,
      tokens_input: response.tokensUsed.input,
      tokens_output: response.tokensUsed.output,
      cost_estimated: estimateCost(response.provider, response.tokensUsed.input, response.tokensUsed.output),
      prompt_summary: request.prompt.substring(0, 500),
    });
  } catch { /* best-effort */ }
}

function estimateCost(provider: string, inputTokens: number, outputTokens: number): number {
  const rates: Record<string, { input: number; output: number }> = {
    openai: { input: 0.005, output: 0.015 },
    gemini: { input: 0.00125, output: 0.005 },
    claude: { input: 0.003, output: 0.015 },
  };
  const rate = rates[provider] ?? { input: 0.01, output: 0.03 };
  return (inputTokens / 1000) * rate.input + (outputTokens / 1000) * rate.output;
}

export async function directAIGenerate(request: AIGenerateRequest): Promise<AIGenerateResponse> {
  const { prompt, provider, model, organizationId, systemPrompt } = request;
  if (!prompt || !provider || !model || !organizationId) throw new Error('Missing required fields');

  // Lovable AI always goes through the edge function
  if (provider === 'lovable') {
    const { data, error } = await supabase.functions.invoke('ai-generate', {
      body: {
        prompt,
        provider,
        model,
        organizationId,
        systemPrompt,
      },
    });
    if (error) throw new Error(`Falha na geração: ${error.message}`);
    const result = data as AIGenerateResponse;
    logUsage(request, result);
    return result;
  }

  const apiKey = await getApiKeyFromOrg(organizationId, provider);
  const sysPrompt = systemPrompt || DEFAULT_SYSTEM_PROMPT;

  let response: AIGenerateResponse;
  switch (provider) {
    case 'openai': response = await callOpenAI(prompt, model, apiKey, sysPrompt); break;
    case 'gemini': response = await callGemini(prompt, model, apiKey, sysPrompt); break;
    case 'claude': response = await callClaude(prompt, model, apiKey, sysPrompt); break;
    default: throw new Error(`Unsupported provider: ${provider}`);
  }

  logUsage(request, response);
  return response;
}
