
# Fase 2 · Bloco 2 — Telemetria completa e visibilidade

Escopo: padronizar logging em todas as Edge Functions de IA restantes, corrigir telemetria do `case-chat`, estender toggle "Alta precisão" às telas pendentes e melhorar `/settings/ai-usage`. Sem cache de embeddings, sem migration, sem backfill, sem rate-limit server-side.

---

## 1. Logging padronizado nas Edge Functions restantes

Aplicar o mesmo padrão do Bloco 1 (`wrapAiCall` + `getEconomyMode` + `selectModelForTask` quando fizer sentido, sempre com `metadata.status` e `metadata.cost_level`).

Funções a instrumentar:

| Função | Ação | Observação |
|---|---|---|
| `review-legal-draft` | envolver chamada de IA com `wrapAiCall`, `high_precision` sempre `true` (sempre pro) | crítica jurídica |
| `senior-legal-review` | idem, sempre pro | crítica jurídica |
| `apply-senior-review-to-draft` | envolver chamada de IA, sempre pro | crítica |
| `build-claim-map` | envolver, sempre pro | crítica |
| `document-chat` | envolver, respeitar economy_mode + high_precision do payload | não crítica |
| `analyze-legal-template` | envolver, sempre pro | crítica |
| `process-pdf-analyze` | envolver, respeitar economy_mode + high_precision | flash por padrão |
| `ocr-extract` | envolver, modelo fixo `gemini-2.5-flash` (multimodal), cost_level informativo | |
| `voice-extract` | envolver, `gemini-2.5-flash` | |
| `voice-extract-client` | envolver, `gemini-2.5-flash` | |
| `classify-document` | envolver, sempre flash (economy) | |
| `extract-document-text` | envolver **apenas** no caminho de IA/OCR (fallback), não em extração pura de texto | |
| `suggest-case-intake` | envolver, respeitar economy_mode | |
| `embed-document-chunks` | apenas padronizar `metadata.status`/`cost_level` se já loga | não gerar log duplicado |

Regras:
- Falha no log nunca quebra a função.
- Metadata mínima quando disponível: `organization_id`, `user_id`, `case_id`, `client_id`, `draft_id`, `file_id`, `operation`, `edge_function`, `provider`, `model`, `status`, `processing_time_ms`, `cost_estimated`, `cost_level`, `input_tokens`, `output_tokens`.
- Onde já existe log parcial, só padronizar `status`/`cost_level`, sem duplicar.

## 2. Correção da telemetria do `case-chat`

Hoje o stream pode terminar em erro mas logar `success`. Ajustes em `supabase/functions/case-chat/index.ts`:

- Envolver o loop de streaming em try/catch dedicado.
- Rastrear flag `streamCompleted` (true após consumir o último chunk sem erro).
- No `finally`, chamar `logAiUsage` com:
  - `status: streamCompleted ? 'success' : 'error'`
  - `metadata.stream_completed` / `metadata.stream_error` (mensagem truncada)
  - `processing_time_ms`, tokens quando o SDK expuser.
- Detectar `event: error` em SSE do gateway e marcar `streamCompleted=false`.
- Não alterar o formato SSE devolvido ao cliente.

## 3. Toggle "Alta precisão" nas telas pendentes

Padrão do Bloco 1 (Switch shadcn, off por padrão, envia `high_precision` no payload). Aplicar em:

- `src/components/cases/drafts/SeniorReviewPanel.tsx` — passar `high_precision` ao serviço `caseDrafts`/`seniorReviewApply`.
- `src/components/ai/DocumentWizard.tsx` + `src/hooks/useDocumentGeneration.ts` — propagar até `ai-generate`.
- `src/components/cases/CaseChatPanel.tsx` (localizar via `rg`) — enviar `high_precision` para `case-chat`.
- `src/pages/cases/CaseClaimMapPage.tsx` — já tem confirm dialog; adicionar Switch de alta precisão para `build-claim-map`.
- `src/services/caseAnalysis.ts` já aceita `highPrecision`; expor Switch no local de disparo (painel de análise de caso), se ainda não houver.

Atualizar `ConfirmAICostDialog` para exibir modelo estimado conforme `highPrecision`/`economyMode`.

Tipos: estender payloads em `src/types/caseDraft.ts` e assinaturas dos services (`caseAnalysis`, `caseClaimMaps`, `seniorReviewApply`, `documentChat`, `caseChat`) com `high_precision?: boolean`.

## 4. Melhorias em `/settings/ai-usage`

Em `src/pages/settings/AIUsageLogPage.tsx` + `src/services/aiUsageLog.ts`:

- Novo filtro `edge_function` (select populado com valores distintos da página atual).
- Tabela com colunas: data, edge_function, operation, model, cost_level, status, tempo (ms), custo estimado, usuário, caso, arquivo/draft.
- Novos cards/rankings simples (listas top 10, sem gráfico):
  - Top 10 Edge Functions por nº chamadas
  - Top 10 Operations por nº chamadas
  - Top 10 Modelos
  - Top 10 registros por `cost_estimated` (quando existir)
- Rankings computados sobre o mesmo dataset filtrado (client-side, limitando janela para não sobrecarregar).

## 5. Compatibilidade com logs antigos

Na renderização:
- `status` ausente → "—"
- `cost_level` ausente → "—"
- `edge_function` ausente → tentar `metadata.edge_function`, senão "—"
- `model` ausente → "—"
- `operation` ausente → "—"

Sem migration nem backfill.

## Validação

- `bunx tsgo --noEmit`
- Smoke Playwright: abrir `/settings/ai-usage`, disparar revisão sênior (high precision on/off), gerar draft no wizard (on/off), enviar mensagem no chat do processo, rodar análise de caso, build claim map, análise de PDF, OCR — confirmar que aparecem novos logs com `status` e `cost_level` preenchidos e que o filtro por `edge_function` funciona.

## Fora deste bloco (Fase 3)

Embedding cache, backfill de logs antigos, rate-limit server-side, exportação Excel/PDF, dashboard com gráficos, cobrança por cliente, precificação SaaS.

## Detalhes técnicos

- Nenhum arquivo em `src/integrations/supabase/*` será alterado.
- `wrapAiCall` já existe em `supabase/functions/_shared/usage-log.ts` — reutilizado tal qual.
- `selectModelForTask` recebe novas chaves quando faltarem (`review_draft`, `senior_review`, `apply_senior_review`, `build_claim_map`, `analyze_legal_template`, `classify_document`, `suggest_case_intake`, `document_chat`, `pdf_analyze`, `ocr_extract`, `voice_extract`, `voice_extract_client`) mapeando para pro/flash conforme criticidade descrita na tabela.
- Sem alterações de schema no banco; `ai_usage_log` já contém as colunas necessárias (`metadata`, `cost_estimated`, tokens etc.).
