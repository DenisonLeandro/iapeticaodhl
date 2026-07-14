# PR-Q1A — Emergencial de qualidade com controle de custo

## Arquivos alterados

Novos:
- `supabase/functions/_shared/template-excerpt.ts` — seleção determinística de trechos curtos do `extracted_text` (teto 6.000 chars) + auditoria leve.
- `supabase/functions/_shared/style-guide.ts` — style guide curto (≤ 1200 chars) adaptado ao template.

Editados:
- `supabase/functions/generate-legal-draft/index.ts` — carrega `extracted_text`, aplica excerpt, injeta style guide + regras dominantes, roda auditoria leve, enriquece telemetria com custo real (`estimateCost`), baseline por caso e métricas do template.
- `src/pages/cases/drafts/DraftGeneratorPage.tsx` — modo por capítulos oculto para usuários comuns; visível apenas para admin com badge "Experimental".

## Como o modo por capítulos foi suspenso
`isAdmin = profile?.role === "admin"`. O card do modo "Gerar por capítulos" só renderiza quando `isAdmin` é true, e recebe badge amarelo "Experimental — apenas admin/testes". Modo padrão para todos = `"fast"`. Rotas e código do modo capítulos **não foram removidos**.

## Como o modelo real é usado no modo rápido
1. `select` amplia para incluir `extracted_text`, `main_topic`, `represented_party`.
2. `buildTemplateExcerpt` seleciona 3 trechos curtos:
   - **opening** (≤1500): match de `DADOS FUNCIONAIS|PRELIMINARMENTE|JUSTIÇA GRATUITA|INVERSÃO DO ÔNUS` → fallback head.
   - **requests** (≤2500): match de `PEDIDOS|Isto posto|Ex positis|DIANTE DO EXPOSTO` → fallback tail.
   - **style** (≤2000): busca por `main_topic` → fallback trecho central.
3. Truncamento cascata garante teto **hard** de 6.000 chars totais (corta style primeiro, depois opening; nunca requests).
4. Trechos injetados no prompt como bloco `[MODELO DO ESCRITÓRIO — TRECHOS LITERAIS]` com regra de "não copiar fatos, valores, datas".
5. `buildOfficeStyleGuide` gera style guide **forte** quando o modelo usa numeração arábica (`1.-, 2.-`), e apenas orienta a espelhar o padrão do próprio modelo caso contrário.
6. Bloco de regras obrigatórias: modelo dominante, densidade proporcional, rol reitera pedidos, sem placeholders crus, pendências vão para "PONTOS A CONFIRMAR ANTES DO PROTOCOLO".

## Limites de caracteres implementados
- `template_excerpt_total_chars ≤ 6000` (hard)
- `opening ≤ 1500`, `style ≤ 2000`, `requests ≤ 2500`
- Style guide ≤ 1200 chars

## Auditoria leve determinística (sem nova IA)
Após geração, `runLightDraftAudit` verifica e gera warnings:
- placeholders críticos: `[NOME]`, `[CPF]`, `[ENDEREÇO]`, `[INSERIR VALOR]`, `NOME DO ADVOGADO`, `OAB/[UF]`, `[Número ...]`, `[INSERIR ...]`
- presença de seção `PEDIDOS`/`DOS PEDIDOS`
- `DADOS FUNCIONAIS` ausente quando o template o contém
- numeração romana predominante quando o template usa arábica
- bullets no rol final quando o template usa itens numerados

Marcadores gerenciados (`[COMPLETAR ...]`, `[ALERTA:]`, `[CALCULAR VALOR ...]`) ficam de fora — são controlados.

Resultados persistidos em `case_drafts.quality_report.light_audit` e refletidos em `warnings`. Não bloqueia geração.

## Logs enriquecidos em `ai_usage_log.metadata`
- `template_id`, `template_name`, `use_template`, `extracted_text_available`
- `template_excerpt_total_chars/opening_chars/style_chars/requests_chars/found_via`
- `template_uses_arabic_numbering`, `template_has_dados_funcionais`, `template_compatible`
- `light_audit_*` (placeholder count, has_pedidos, missing_dados_funcionais, roman_numerals, final_bullets)
- `cost_baseline_case`: última geração do mesmo `case_id` (`tokens_input/output`, `cost_estimated`, `created_at`) ou string `"sem baseline comparável"`
- `cost_delta_tokens_input`, `cost_delta_estimated_usd` quando há baseline
- `cost_estimated` agora usa `estimateCost(model, in, out)` real (antes era `0`)

## Fora de escopo (mantido)
Sem migração, sem alterar `case_drafts` antigos, sem tocar em `plan-draft-chapters`/`generate-draft-section`, sem `case_claim_maps` integrado, sem PR-6B, sem embedding/chunking, sem envio integral de `extracted_text`, sem nova chamada de IA para auditoria, sem alterar revisão sênior, sem alterar export.

## Riscos remanescentes
- Templates sem `extracted_text` (análise pendente) → degradação graciosa: só blueprint.
- Style guide forte só ativa quando `uses_arabic_numbering=true`; se o template real do escritório não passar nesse critério (menos de 3 marcadores `\d+\.\-`), o guide fica em modo leve.
- Bug pré-existente em `generate-draft-section` (`select("content,title")` de colunas inexistentes) permanece — mitigado por esconder o modo capítulos.

## Validação
- `bunx tsgo --noEmit` — limpo.
- Teste manual sugerido: gerar inicial trabalhista no modo rápido com template selecionado; conferir em `/settings/ai-usage` o metadata da última entrada `legal_draft_generation` (deve mostrar `template_excerpt_total_chars ≤ 6000`, `extracted_text_available=true`, `light_audit_*` e `cost_baseline_case`).
- Verificar visualmente: peça deve usar numeração arábica quando o modelo usa, ter `DADOS FUNCIONAIS` quando aplicável, pedido final numerado, sem `NOME DO ADVOGADO`/`OAB/[UF]` crus.
- Usuário não-admin não deve ver o card "Gerar por capítulos".
