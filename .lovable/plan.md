# PR-4.4B.2A — Ajuste Fino da Geração de Peças

Escopo restrito, sem tocar em módulos protegidos (Chat IA, Ficha, prefill, RAG, embeddings, pipeline documental, analyze-case, analyze-legal-template, legal-intents, Biblioteca de Modelos, download de modelos). Sem migrações — os campos necessários (`assumptions`, `notes`, `confidence`, `input_data`) já existem em `case_calculation_items`.

## 1. Normalização de contexto de cálculo

Novo módulo `supabase/functions/_shared/calc-engine/normalize-context.ts` exportando `buildCalculationContext({ caseData, client, intake, analysis, documents, chunks, additionalInstructions, generatedDraftContext })` que retorna:

- `monthly_salary`, `admission_date`, `termination_date`, `termination_day_count` (derivado do dia da rescisão), `role`
- `work_schedule` (start/end/interval/days_per_week/days_off)
- `variable_pay` (km_rate, average_km_per_month, monthly_variable_estimate = km_rate × km/mês)
- `confidence_by_field` e `sources_by_field`

Extratores por regex + parsers PT-BR:
- Salário: `R$ 3.190,00` → `3190.00`; padrões "salário base/mensal/último de R$ …".
- Datas: `dd/mm/aaaa`, `dd de mês de aaaa`, ISO.
- Jornada: `das 05h às 22h`, `intervalo de 30 minutos`, `2 folgas por mês`.
- Produtividade: `R$ 0,15 por km`, `11.000 km/mês`.

Ordem de fontes e confiança:
- documento processado → alta
- ficha/análise/minuta gerada → média
- instruções do advogado → média
- relato → baixa
- derivado (ex.: saldo do dia da rescisão) → média

## 2. Integração com o calc-engine

`supabase/functions/_shared/calc-engine.ts`: `extractCalcContext` passa a receber o `CalculationContext` normalizado e mapeia para o `CalcContext` interno, derivando também `weekly_extra_hours` (quando jornada + intervalo + dias/semana estiverem preenchidos) e `intrajornada_minutes_suppressed_per_day` = `max(0, 60 - interval_minutes)` para jornadas > 6h. Cada `CalcItem` passa a incluir dentro de `assumptions` os campos `_source` e `_confidence_source` para exibição/exportação.

`generate-legal-draft/index.ts`: chama `buildCalculationContext(...)` antes de `runCalculations(...)`; injeta no prompt uma tabela com **valor + fonte + confiança + premissa** e instrui o modelo a substituir `[CALCULAR VALOR]` pelo valor calculado, mantendo o marcador apenas quando faltar dado essencial (com a lista de faltantes).

## 3. Petição usa valores calculados

Prompt do DRAFT reforçado:
- Se o item tem `estimated_value`, escrever o valor formatado + "conforme memória de cálculo estimativa anexa, sujeito à revisão em liquidação".
- Se estimativa parcial, mesma frase.
- Só manter `[CALCULAR VALOR — faltam: ...]` quando o item vier sem valor.

## 4. Tópico "Não limitação" robusto + pedido final + pedido sucessivo

`supabase/functions/_shared/legal-blocks.ts`:
- `NON_LIMITATION_TOPIC` substituído pelo texto robusto do briefing (art. 840 §1º CLT, documentos em poder da Reclamada, tacógrafo/MDF-e/CT-e/rastreador etc., não renúncia).
- `NON_LIMITATION_REQUEST` no formato pedido final expandido.
- Novo `SUCCESSIVE_RESCISAO_INDIRETA_TOPIC` + `SUCCESSIVE_RESCISAO_INDIRETA_REQUEST` (textos do briefing).

Novo `supabase/functions/_shared/final-requests/trabalhista-inicial.ts` com `TRABALHISTA_INICIAL_FINAL_REQUESTS_GUIDANCE` (24 itens: gratuidade, rescisão indireta, sucessivo, verbas rescisórias discriminadas, multas 477/467, FGTS, 40%, guias, reflexos, horas extras + sucessivo alternativo, intra/inter, DSR/feriados, noturno, produtividade, insalubridade, exibição de documentos com lista ampliada para motorista, não limitação, juros/correção, honorários, abatimento, protesto por provas, citação, valor da causa).

## 5. Exibição de documentos ampliada para motorista

Injetada no guia do pedido final: tacógrafo, GPS, MDF-e, CT-e, diário de bordo, papeletas, ficha de trabalho externo, relatórios de viagem/km/produtividade, holerites, recibos, extratos analíticos de FGTS, EPIs, PPRA/PGR, PCMSO, LTCAT, laudos, produtos químicos.

## 6. Destaque visual dos marcadores pendentes (abordagem segura)

Novo `src/lib/drafts/pending-markers.ts`:
- `PENDING_MARKER_REGEX = /\[(INFORMAR|CALCULAR|ANEXAR|CONFIRMAR|REVISAR|JURISPRUDÊNCIA A INSERIR|PREENCHER|INSERIR|ATUALIZAR|VERIFICAR|DEFINIR)[^\]]*\]/gi`
- `classifyMarker`, `countPendingMarkers`, `renderWithHighlights` (retorna React nodes com `<mark className="pending-marker pending-marker--<cat>">`).

Novo `src/components/cases/drafts/DraftContentPreview.tsx` — camada read-only que renderiza o texto bruto com highlights. Não altera o texto salvo.

Novo `src/components/cases/drafts/PendingCountBadge.tsx` — contador com totais por categoria (Informar / Calcular / Anexar / Confirmar / Revisar / Jurisprudência).

`src/pages/cases/drafts/DraftDetailPage.tsx`:
- Textarea continua sendo a única superfície de edição — texto sempre bruto, sem HTML.
- Botão "Ver com destaques" alterna entre editar (Textarea) e visualizar (Preview).
- `PendingCountBadge` no painel lateral, acima de `DraftWarningsList`.
- Copiar/salvar/arquivar/listar mantêm exatamente o texto bruto.

`src/index.css` — estilo `.pending-marker` (fundo vermelho claro, texto vermelho, negrito, borda tracejada) + variantes por categoria (nuances de cor).

## 7. Memória de cálculo enriquecida

`src/components/cases/drafts/CalculationsPanel.tsx`: exibir explicitamente **Fonte**, **Premissas** e **Observações jurídicas** por item, além de fórmula/dados/faltantes já existentes.

`src/lib/xlsx/export-calculations.ts`: adicionar colunas **Fonte dos dados**, **Confiança**, **Premissas**, **Observações jurídicas** (fonte lida de `assumptions._source`).

`src/types/caseCalculation.ts`: nenhum novo campo obrigatório — helpers leem `assumptions._source` / `assumptions._confidence_source`.

## 8. Revisão automática — severidade e sugestão copiável

`supabase/functions/review-legal-draft/index.ts`:
- `QUALITY_GATE_SYSTEM` passa a exigir, além do schema atual, o array `findings: [{ severidade: "risco_alto"|"atencao"|"pendencia_documental"|"sugestao_estrategica", topico, motivo, sugestao }]`.
- Prompt: "não dizer apenas 'tópico frouxo' — explicar o motivo e apresentar sugestão pronta para copiar".

`src/components/cases/drafts/SeniorReviewPanel.tsx`: agrupar `findings` (se presentes) por severidade e adicionar botão **Copiar sugestão** por item.

`src/types/caseDraft.ts`: adicionar tipo opcional `findings` em `CaseDraftQualityReport`.

## 9. Validação no caso Elvis/LB (36 itens do critério de aceite)

- Cálculos preenchidos: salário R$ 3.190,00, admissão 15/07/2024, rescisão 14/05/2026, saldo 14 dias → R$ 1.488,67; aviso, 13º, férias+1/3, FGTS, 40%, multa 477, honorários.
- Horas extras/intra apenas com premissa explícita (jornada 05h-22h, intervalo 30 min, folgas 2/mês) — memória de cálculo destaca origem "relato/ficha", confiança baixa/média, sujeito a controles da Reclamada.
- Petição substitui `[CALCULAR VALOR]` pelos valores; mantém marcador só onde faltar dado.
- Tópico da não limitação robusto; item de não limitação no pedido final; sucessivo/alternativo presente; pedido final expandido.
- Marcadores destacados em vermelho no preview; contador visível.
- Copiar/salvar mantêm texto limpo sem HTML.
- Alertas sensíveis (Súmula 450/ADPF 501, ADI 5.766, intrajornada pós-Reforma) preservados; nada de jurisprudência inventada.
- Nenhuma regressão em gerar/salvar/copiar/arquivar/listar/exportar; nenhum módulo protegido tocado.

## 10. Arquivos

Novos:
- `supabase/functions/_shared/calc-engine/normalize-context.ts`
- `supabase/functions/_shared/final-requests/trabalhista-inicial.ts`
- `src/lib/drafts/pending-markers.ts`
- `src/components/cases/drafts/DraftContentPreview.tsx`
- `src/components/cases/drafts/PendingCountBadge.tsx`

Editados:
- `supabase/functions/_shared/calc-engine.ts`
- `supabase/functions/_shared/legal-blocks.ts`
- `supabase/functions/generate-legal-draft/index.ts`
- `supabase/functions/review-legal-draft/index.ts`
- `src/components/cases/drafts/CalculationsPanel.tsx`
- `src/components/cases/drafts/SeniorReviewPanel.tsx`
- `src/lib/xlsx/export-calculations.ts`
- `src/pages/cases/drafts/DraftDetailPage.tsx`
- `src/index.css`
- `src/types/caseDraft.ts`

Sem migrations.
