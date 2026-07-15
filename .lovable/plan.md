
## Objetivo

Eliminar o erro "Stream finalizou sem evento 'done'." garantindo que a edge function `case-chat` **sempre** envie um evento terminal (`done` ou `error`) ao cliente, e tratar corretamente respostas vazias, filtradas ou truncadas do Gemini.

## Diagnóstico confirmado

`supabase/functions/case-chat/index.ts` fecha o `ReadableStream` sem enviar `done` nem `error` em 3 cenários:

1. Upstream OK, mas `assistantText === ""` (Gemini devolveu 0 deltas — típico de `finish_reason: length`, `safety`, `content_filter`, ou timeout do provider).
2. `sawGatewayError = true` dentro do SSE: seta `streamErrorMessage` mas nunca envia `{type:"error"}` para o cliente.
3. Falha ao persistir a resposta quando `assistantText` está vazio (bloco `if (streamCompleted && assistantText)` inteiro é pulado).

Em todos os três casos o cliente (`src/services/caseChat.ts`) chega ao fim do `reader.read()` sem `finalResp` nem `streamError` e lança a mensagem genérica que o usuário viu.

## Escopo do PR (mínimo, 1 arquivo)

### `supabase/functions/case-chat/index.ts`

1. **Capturar `finish_reason`** de cada chunk SSE (`obj?.choices?.[0]?.finish_reason`) numa variável `finishReason`.
2. **Definir `max_tokens`** explícito na chamada ao gateway (ex.: `4096`) para evitar corte silencioso sem sinal.
3. **Sempre enviar evento terminal** ao final do stream, seguindo esta ordem de decisão:
   - Se `streamCompleted && assistantText` → envia `done` (comportamento atual).
   - Se `assistantText === ""` (sem conteúdo) → envia `{type:"error", error: <mensagem amigável>}` mencionando causa provável (`finish_reason` = `length`/`safety`/`content_filter`/`stop` vazio; ou gateway_error).
   - Se `sawGatewayError` e ainda não enviou `error` → envia `{type:"error", error: streamErrorMessage ?? "Falha no provedor de IA."}`.
   - Se falhar ao persistir → já envia `error` (mantém).
4. **Mensagens amigáveis por causa**:
   - `length`: "A resposta foi interrompida por limite de tokens. Refaça a pergunta pedindo uma versão mais curta."
   - `safety`/`content_filter`: "A resposta foi bloqueada pelo filtro de segurança do modelo. Reformule a pergunta."
   - vazio sem finish_reason: "O modelo não retornou conteúdo. Tente novamente em instantes."
5. **Telemetria**: incluir `finish_reason`, `assistant_empty: assistantText.length === 0` e `saw_gateway_error` no `metadata` do `logAiUsage` (já parcialmente presente).
6. **Não persistir** mensagem do assistant quando `assistantText` estiver vazia (mantém invariante atual).

## Fora do escopo

- Retry automático do case-chat (evita duplo custo sem clareza).
- Mudança de modelo/rota (`selectModelForTask`).
- Alterações no cliente `src/services/caseChat.ts` — a correção server-side já resolve; o cliente continuará mostrando o `evt.error` via `handlers.onError` + `toast.error` que já existem em `useCaseChat`.
- Qualquer mexida em `generate-legal-draft` / PR-Q1A.

## Verificação

- `bunx tsgo --noEmit` limpo.
- Repro com o prompt do usuário (texto longo em caixa alta) → agora deve aparecer toast com mensagem específica ("resposta interrompida por limite de tokens" ou similar) em vez do erro genérico.
- Log `ai_usage_log` com `status: "error"`, `finish_reason` preenchido e `assistant_empty: true` no metadata.

## Risco

Baixo. Um único arquivo, sem alteração de schema, sem alteração de contrato do stream (apenas garante emissão de `done|error`). O cliente já trata `evt.type === "error"`.
