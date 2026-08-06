# PR-COMPLETUDE 1 — Zero placeholder, pedidos com status e valor da causa

O prompt faz sentido e está bem calibrado: escopo fechado, sem nova IA, apoiado no que já existe. Confirmei no código que a base necessária já está no lugar — o motor determinístico (`_shared/calc-engine.ts`) já devolve `confidence` e `missing_fields` por item, a normalização (`_shared/calc-engine/normalize-context.ts`) já rastreia origem por campo (`sources_by_field`, `confidence_by_field`), e o front já sabe contar marcadores (`src/lib/drafts/pending-markers.ts`) e ler o gate `_draft_injectable`. Ou seja: a PR é majoritariamente de consolidação, não de arquitetura nova.

Três ajustes que recomendo sobre o texto original (o resto entra como escrito):

1. O status `estimated` não deve ser inventado: mapear a partir do que o motor já produz (`confidence` + `_draft_injectable`), evitando uma segunda taxonomia paralela.
2. `manual` exige um lugar para o advogado gravar o valor — hoje não existe esse campo por pedido. Sugiro entrar como campo simples em `case_calculation_items` (valor + confirmação), sem tela nova além de edição inline na lista de cálculos.
3. `ready_for_protocol` depende de confirmação humana; ele será um ato explícito do advogado, gravado na minuta, e não um cálculo automático.

## Etapa 1 — Diagnóstico (sem código)

Analisar um caso real com `[CALCULAR VALOR]`: dados salvos no caso/ficha, o que a normalização enxergou (`sources_by_field`), o retorno do motor item a item, o bloco "VALORES PRONTOS PARA USO" efetivamente injetado e o `quality_report` gravado. Para cada pedido pendente, classificar a causa: dado ausente, dado existente não reconhecido, formato incompatível, fórmula inexistente, regra de confiança bloqueando, ou falha de injeção/persistência. Nada é corrigido antes disso.

Saída do diagnóstico por pedido: `claim_key`, `status`, `value`, `missing_fields`, `input_sources`, `assumptions`, `formula_summary`, `failure_reason`.

## Etapa 2 — Corrigir só o comprovadamente falho

Ajustes pontuais em `calc-engine.ts` / `normalize-context.ts` apenas onde o dado existe e não é reconhecido. Sem defaults artificiais, sem normalização paralela, sem presumir jornada/salário/período. Dado inexistente permanece `pending` com `missing_fields` explícito.

## Etapa 3 — `_shared/completeness.ts` (determinístico, custo zero)

Módulo único reutilizado por `generate-legal-draft`, `generate-draft-section`, revisão e exibição. Verifica: placeholders textuais (com marcador, seção e trecho — nunca removidos em silêncio), status de cada pedido, valor da causa vs. somatório, e campos críticos aplicáveis. Resultado gravado em `quality_report.completeness_audit` na estrutura definida no prompt, incluindo `protocol_readiness`.

Para não duplicar regra, a detecção de marcadores passa a ter uma fonte única compartilhada com a lógica já usada no front.

## Etapa 4 — Valor da causa

Somatório determinístico de `calculated + estimated + manual`; `pending` nunca recebe valor arbitrário. Havendo pendência, o valor da causa é `partial`. O total já vai pronto no bloco de valores injetado no prompt, com status e premissas por item — a IA nunca soma.

## Etapa 5 — Selo de completude

Indicador simples na página da minuta, reaproveitando o componente de contagem já existente: "Rascunho — não apto para protocolo", "Apto para revisão final" e "Apto para protocolo" (este só com auditoria limpa **e** confirmação do advogado).

## Etapa 6 — Lista curta de pendências

Tipo, seção, dado faltante e ação recomendada; clique navega até o trecho quando trivial. Sem editor novo.

## Fora do escopo

Checagem jurídica fatos × pedidos, fragilidade de dano moral, sócios, jurisprudência, prescrição, reescrita automática, novo agente de IA, memória de cálculo visual, automação de protocolo.

## Detalhes técnicos

- Alterados: `_shared/calc-engine.ts`, `_shared/calc-engine/normalize-context.ts`, `generate-legal-draft/index.ts`, `generate-draft-section/index.ts`, `src/lib/drafts/pending-markers.ts` (fonte única), página da minuta e componente de pendências.
- Novo: `_shared/completeness.ts` + testes dos 6 cenários do prompt.
- Migração pequena para o valor manual confirmado por pedido (Etapa 2/4).
- Nenhuma chamada de IA adicionada; toda verificação é determinística.

## Riscos de regressão

Mudança no bloco de valores injetado pode alterar o texto gerado (mitigado por comparação antes/depois em um caso real); unificar a regex de marcadores pode mudar contagens exibidas; travar `ready_for_protocol` pode ser percebido como bloqueio novo — por isso o rascunho continua gerável e exportável.

## Entrega

Antes de codar: diagnóstico do caso, causa exata das pendências, arquivos a alterar e riscos. Depois: arquivos, correções, estrutura da auditoria, resultado dos testes e confirmação de escopo/zero IA.
