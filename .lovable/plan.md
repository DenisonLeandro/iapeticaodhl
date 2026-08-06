# Validação integrada final — PR-COMPLETUDE 1 (caso João Vitor Correia)

## 1. Estado real verificado no banco (antes das correções)

Minuta única do caso (`case_drafts` 4b214d40…, 13.260 caracteres, atualizada 06/08 17:19 UTC — **gerada antes do deploy da PR**).

Placeholders no conteúdo **salvo**:

| Marcador | Ocorrências |
|---|---|
| `[CALCULAR VALOR]` | 7 |
| `[CALCULAR VALOR — valor estimado…]` | 1 |
| `[INFORMAR VALOR, sugestão de R$ 5.000,00]` | 2 |
| `[NOME DO ADVOGADO]`, `[NÚMERO DA OAB]`, `[INFORMAR VARA/COMARCA]`, `[INFORMAR DATA]` | 4 |
| `[REVISAR …]` (ADI 5.766, seguro-desemprego) | 2 |

Não há valor da causa nem subtotal no corpo da minuta (nenhuma ocorrência de "valor da causa" / "R$" de liquidação).

Itens de cálculo persistidos (`case_calculation_items`):

| Pedido | Sistema | Manual | Confirmado | `_draft_injectable` |
|---|---|---|---|---|
| Saldo de salário | R$ 1.670,83 | — | não | **false** |
| 13º proporcional | R$ 1.002,50 | — | não | **false** |
| Multa art. 477 | R$ 2.005,00 | — | não | **false** |
| Honorários (estimativa) | R$ 701,75 | — | não | false (medium) |
| Aviso-prévio, férias+1/3, FGTS, multa 40% | nulo | — | não | false (falta data de admissão) |

Leitura: os três pedidos de alta confiança já têm valor calculado, mas continuam como `[CALCULAR VALOR]` no texto porque a minuta é **anterior** à correção do gate. Os quatro pedidos sem valor são ausência real de dado (data de admissão / extratos FGTS) — placeholder legítimo.

## 2. Lacunas confirmadas (o que ainda impede o encerramento)

1. **Auditoria não persistida.** `quality_report.completeness_audit` só é gravado em `generate-legal-draft`. Na minuta real o campo **não existe** (`has_audit = false`). Não há gravação em `generate-draft-section`, na edição manual, na alteração/confirmação de valores nem em reexecução — hoje a auditoria é recalculada só em memória no `CompletenessPanel`.
2. **Hash da confirmação é apenas textual.** `setLawyerReviewConfirmation` grava `lawyer_review_confirmed_hash = contentHash(content)`. Alterar valor manual, confirmar valor, recalcular ou mudar o valor da causa **não invalida** o selo.
3. **Valor manual não tem ponte com o texto.** Não existe ação de aplicar o valor ao pedido correspondente; o advogado precisa editar o texto à mão, e nada sinaliza a divergência.
4. **Exportação** (DOCX/PDF) usa o estado atual do editor (`content`) — correto, sem dados só-visuais. Placeholders exportados hoje = os 17 acima, pois o conteúdo não foi regenerado.
5. **Testes preexistentes**: `src/test/ai/document-wizard.test.tsx` — "navigates to step 2 when clicking next after type selection" e "goes back to step 1 when clicking back on step 2" — falham com `ReferenceError: ResizeObserver is not defined` (Radix `use-size` no jsdom). Falha de ambiente de teste, independente desta PR (o terceiro caso citado antes pertence ao mesmo arquivo/erro).

## 3. Correções estritamente necessárias

### 3.1 Persistir a auditoria (`quality_report.completeness_audit`)
- `src/services/caseDrafts.ts`: nova função `persistCompletenessAudit(draftId, report, audit)` que grava `quality_report.completeness_audit` + `completeness_audit_at`.
- Chamada nos pontos de estado material:
  - salvamento manual do conteúdo (`updateCaseDraft` em `DraftDetailPage`);
  - qualquer mutação de valores (`useCalculationItemMutation` → `onSuccess`);
  - botão "reexecutar verificação" no `CompletenessPanel`;
  - `generate-draft-section` (após montagem/atualização do conteúdo, mesma chamada de `runCompletenessAudit` já usada em `generate-legal-draft`).
- Objeto persistido (formato já produzido por `runCompletenessAudit`), exemplo esperado para o caso João Vitor após regeneração:

```json
{
  "version": 1,
  "content_hash": "…",
  "placeholder_count": 6,
  "calculation_placeholder_count": 4,
  "qualification_placeholder_count": 4,
  "other_placeholder_count": 2,
  "claim_value_sum": 4678.33,
  "case_value_status": "partial",
  "case_value_pending_claims": ["Aviso-prévio indenizado", "Férias proporcionais + 1/3", "FGTS", "Multa de 40%"],
  "protocol_readiness": "pending_completion"
}
```

### 3.2 `reviewed_state_hash` (estado material, não só texto)
- Em `_shared/completeness.ts`: `reviewedStateHash({ content, items, case_value, audit_version })` — assinatura estável sobre `id + estimated_value + manual_value + manual_value_confirmed + system_value_confirmed` de cada item, somatório do valor da causa e versão da auditoria.
- `setLawyerReviewConfirmation` passa a gravar `lawyer_review_confirmed_state_hash`; `CompletenessPanel` compara com o hash recalculado. Hash textual antigo continua aceito para minutas legadas (mantém compatibilidade e é tratado como inválido na primeira mudança material).

### 3.3 Valor manual × texto da minuta (comportamento documentado, sem substituição genérica)
- Sem substituição automática por ordem de ocorrência.
- Quando um pedido tem valor efetivo (sistema confirmado ou manual confirmado) e o texto ainda contém marcador de valor **na seção de pedidos vinculada àquele `claim_key`/`request_label`**, o painel exibe o aviso "valor definido não refletido na minuta" com ação **"Aplicar ao pedido"**, que substitui apenas o marcador localizado dentro do trecho do pedido correspondente (casamento por rótulo do pedido; se não houver casamento inequívoco, a ação fica desabilitada e o sistema orienta regenerar a seção).
- Nenhuma regeneração automática é disparada.

### 3.4 Reexecução da validação no caso real
- Após as correções, regerar a minuta do caso João Vitor e reportar: contagem de `[CALCULAR VALOR]` no conteúdo salvo, presença de saldo salarial / 13º / multa 477 com valor, honorários como estimativa, pedidos ainda pendentes por falta de data de admissão, subtotal e valor da causa no corpo, objeto real de `completeness_audit` persistido, e contagem de placeholders no arquivo DOCX exportado.

## 4. Fora de escopo
Correção dos testes do wizard `/ai/documents`, novos modelos de IA, mudanças de prompt além do já entregue, e qualquer substituição textual automática não vinculada ao pedido.

## Detalhes técnicos
- Arquivos: `supabase/functions/_shared/completeness.ts` (hash de estado), `supabase/functions/generate-draft-section/index.ts` (persistir auditoria), `src/services/caseDrafts.ts`, `src/hooks/useCaseCalculations.ts`, `src/components/cases/drafts/CompletenessPanel.tsx`, `src/components/cases/drafts/CalculationsPanel.tsx`, `src/pages/cases/drafts/DraftDetailPage.tsx`.
- Sem migração de banco: tudo cabe em `case_drafts.quality_report` (jsonb).
- Sem novas chamadas de IA.
