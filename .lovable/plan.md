# Fechamento enxuto da PR-COMPLETUDE 1

## Minha posição

O que eu havia proposto era grande demais para o ganho. Da lista de 6 pontos da validação, **4 já estão resolvidos** e só **2 são falhas reais**. O resto é relatório, não código.

Já verificado no banco e no código (nada a fazer):
- Exportação DOCX/PDF usa o conteúdo atual do editor — sem dado "só visual". OK.
- Placeholders remanescentes do caso João Vitor correspondem a dado realmente ausente (data de admissão, extratos de FGTS) mais qualificação do advogado. OK.
- Os 3 valores calculados (saldo R$ 1.670,83, 13º R$ 1.002,50, multa 477 R$ 2.005,00) existem no banco; a minuta atual é **anterior** ao deploy da correção do gate, por isso ainda mostra `[CALCULAR VALOR]`. Basta regerar para comprovar.
- Testes do wizard `/ai/documents`: 2 falhas, ambas `ReferenceError: ResizeObserver is not defined` (Radix em jsdom) — preexistentes, alheias à PR.

Falhas reais, e só isso vale código:
1. `quality_report.completeness_audit` só é gravado na geração completa. Na minuta real o campo não existe.
2. O selo "apto para protocolo" usa hash só do texto — mudar/confirmar valor não invalida.

## O que fazer (escopo mínimo, ~1 sessão curta)

1. **Persistir a auditoria em um único ponto.** Uma função `persistCompletenessAudit(draftId)` em `src/services/caseDrafts.ts`, chamada em três lugares: ao salvar o conteúdo, ao mutar valores (`useCalculationItemMutation.onSuccess`) e ao confirmar/revogar o selo. Reaproveita o `runCompletenessAudit` que já existe. Sem migração, sem chamada de IA.
2. **Hash cobrindo o estado material.** Estender o hash já usado para incluir, além do conteúdo, os valores dos itens (sistema/manual e suas confirmações) e o somatório do valor da causa. Uma linha de assinatura, mesma função de hash. Minutas legadas continuam válidas até a primeira mudança.

## O que eu deixo de fora, deliberadamente

- **Botão "aplicar valor manual ao pedido"** — é o item que mais custa e mais arrisca (casamento texto↔pedido). Comportamento atual fica documentado: o valor manual entra no valor da causa e nos painéis; no texto, o advogado edita ou regera a seção. Se na prática incomodar, a gente reavalia depois com o uso real.
- Persistir auditoria também no `generate-draft-section` (modo por capítulos, hoje restrito a admin) — o passo 1 já cobre quando o conteúdo é salvo.
- Correção dos testes do wizard antigo.

## Fecho da PR

Depois desses dois ajustes: regerar a minuta do João Vitor e reportar em uma tabela — contagem de `[CALCULAR VALOR]` salvo, os três valores injetados, honorários como estimativa, pendentes por falta de admissão, valor da causa no corpo, o objeto `completeness_audit` real persistido e a contagem de placeholders no DOCX exportado.

## Detalhes técnicos
Arquivos tocados: `src/services/caseDrafts.ts`, `src/hooks/useCaseCalculations.ts`, `src/components/cases/drafts/CompletenessPanel.tsx`, `src/pages/cases/drafts/DraftDetailPage.tsx`, `supabase/functions/_shared/completeness.ts` (assinatura do hash). Sem migração de banco, sem novas chamadas de IA.
