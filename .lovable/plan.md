## PR-6A.1 — Ajustes de robustez no `build-claim-map`

Escopo restrito a `supabase/functions/build-claim-map/index.ts` + reuso do helper `supabase/functions/_shared/pricing.ts`. Nenhum frontend, nenhuma migration, nenhum `case_drafts`, nenhum fluxo de geração/revisão/exportação tocado.

### 1. Guard determinístico das 23 claims (reforço)

`ensureRequiredClaims` já existe, mas os defaults e a ordem estão fracos. Ajustar para o padrão exigido:

- `risk_level: "medium"` (hoje: `"low"`)
- `missing_documents: ["Contexto insuficiente para avaliar esta tese com segurança."]`
- `warnings: ["Claim obrigatória não retornada pelo modelo; incluída por guarda determinística para revisão do advogado."]`
- demais campos já corretos (`uncertain`, `confidence:"low"`, `recommended_action:"confirm"`, `requires_lawyer_confirmation:true`, flags de inclusão `false`, `lawyer_decision:"pending"`).

Endurecer contra "claims não-canônicas substituindo obrigatórias" no caso 9c03: após `normalizeClaimIds`, descartar entradas cujo `id` não é canônico E não conseguiu ser mapeado por alias (mantendo-as apenas se não colidirem com o catálogo). Em seguida `ensureRequiredClaims` preenche todas as 23.

### 2. Fallback para contexto insuficiente (caso 74158d88)

Introduzir função `buildMinimalMap(required, missingCaseDataDetectado)` que devolve os 23 claims no formato fallback acima + `missing_case_data` com bullets padrão:
- "Ficha de atendimento (intake) ausente"
- "Análise jurídica ausente"
- "Documentos insuficientes ou não processados"
- "Função, datas de admissão/rescisão, remuneração e modalidade de rescisão não identificadas"

Trigger de uso:
- Antes de chamar o LLM, detectar contexto pobre: `!intake && !analysis && (files?.length ?? 0) <= 1` e área trabalhista.
- No path de erro do LLM (respostas 5xx, timeout, `ai_invalid_response`, ausência de `claims`): se área é trabalhista, gravar mapa mínimo em vez de 502. Retornar 200 com o mapa fallback (contendo aviso global explicando que foi fallback).

Para 402 (créditos) e 429 (rate limit) manter o erro atual — são falhas operacionais reais, não contexto insuficiente.

### 3. Guarda ADPF 501 / Súmula 450 (manter e endurecer)

Regra atual já cobre. Ajuste pontual: quando `isFeriasDobro` for detectado e `applicability !== "not_applicable"`, garantir também que `requires_lawyer_confirmation=true` (já ok) e que o warning ADPF 501 é injetado. Sem mudança estrutural.

### 4. `cost_estimate` populado

Importar `estimateCost` de `../_shared/pricing.ts` (que já tem `google/gemini-2.5-pro`: input 1.25/M, output 5.00/M).

- Calcular `const cost = estimateCost(model, inputTokens, outputTokens)`.
- Persistir `cost_estimate: cost` (em vez de `null`) no insert.
- Passar `cost_estimated: cost` para `logAiUsage` (hoje está zero).

Para o path fallback (sem chamada LLM efetiva): `cost_estimate = 0`.

### 5. Guardas conservadoras genéricas

Adicionar passagem final em `applyDeterministicGuards`:
- Se `applicability === "uncertain"` e `recommended_action` for `"include"` ou `"exclude"`: forçar `"confirm"` + `requires_lawyer_confirmation=true`.
- Se `risk_level in {"high","critical"}` e `applicability !== "not_applicable"`: forçar `requires_lawyer_confirmation=true` (não mexer em `recommended_action` para não sobrescrever `warn_only` legítimo).

### Revalidação (sem alteração de código)

Rodar `build-claim-map` com `force_regenerate: true` via `supabase--curl_edge_functions` para:
- **A. `9c035db9…`** — esperar 23 claims obrigatórias, sem entradas não-canônicas, `missing_case_data` populado.
- **B. `74158d88…`** — esperar HTTP 200 com mapa mínimo de 23 claims (`uncertain`/`not_applicable`, `confidence:"low"`) e `missing_case_data` explicativo. Nenhum 502.
- **C. Elvis `9ca0912f…`** — esperar 23 claims, `ferias_em_dobro` com warning ADPF 501, núcleo jurídico preservado, `cost_estimate` numérico > 0.

Para cada caso, verificar por SQL: apenas um `is_current=true`, `version` incrementou, `cost_estimate` não-null (quando houve chamada LLM), `case_drafts` inalterado (comparar `updated_at` antes/depois).

Rodar `bunx tsgo --noEmit` ao final.

### Arquivos afetados

- `supabase/functions/build-claim-map/index.ts` (única alteração de código real)
- Reuso de `supabase/functions/_shared/pricing.ts` (import only)

### Relatório final

- Diff resumido do arquivo alterado
- Tabela dos 3 casos: HTTP status, nº claims, `is_current`, `version`, `cost_estimate`, guarda ADPF 501, tempo total
- Resultado do typecheck
- Confirmação: `case_drafts` intocado, frontend intocado, migrations intocadas
- Limitações conhecidas (ex.: oscilação de risk_level entre execuções continua existindo — não é objeto do PR-6A.1)
