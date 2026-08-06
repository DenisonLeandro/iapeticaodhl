# Excelência na petição inicial (sem foco em cálculo)

Cálculo sai do centro. O objetivo passa a ser um só: a peça sair pronta para o advogado ler, ajustar pouco e protocolar. Os valores continuam como estão hoje — "a apurar em liquidação" é redação aceita no foro trabalhista e não impede a excelência do texto.

## O que falta, olhando a peça do Anderson x JTI

**1. A peça pede que o advogado pesquise o que o sistema já deveria saber.**
Aparece `[REVISAR ENTENDIMENTO ATUAL SOBRE ADI 5.766/STF]` duas vezes. Essa ADI foi julgada e o entendimento está consolidado. Uma peça de excelência afirma a tese com a fundamentação atual — não delega a checagem ao advogado. O mesmo vale para outras teses recorrentes na Justiça do Trabalho (ADPF 501, honorários de sucumbência do beneficiário da gratuidade, ADC 58).

**2. Densidade abaixo do modelo.**
A minuta tem cerca de 12,7 mil caracteres; a inicial real do escritório fica na faixa de 20 a 30 mil. As teses estão certas, mas curtas: o item de rescisão indireta e o de integração da remuneração variável têm poucos parágrafos, sem desdobramento fático nem jurisprudência de apoio.

**3. Não há jurisprudência citada por tese.**
Há súmulas (264, 340, 172) e artigos, mas nenhum acórdão do TST ou do TRT da 9ª Região no corpo. Numa inicial trabalhista de banca, cada tese controvertida vem com pelo menos um julgado.

**4. Nenhuma checagem de fato narrado sem pedido correspondente.**
Nada garante hoje que todo fato relevante levantado na entrada virou pedido, nem que todo pedido tenha fato que o sustente. É a falha que mais custa caro.

**5. Marcadores de instrução misturados com defeitos.**
`[ANEXAR DOCUMENTO]`, `[INFORMAR DATA]`, `[INFORMAR NOME DA MÃE]` são tarefas do escritório, não erro da IA — mas hoje entram na mesma contagem e poluem a leitura de qualidade.

## O que fazer

**Fase A — Banco de teses consolidadas (maior ganho por esforço)**
Criar um conjunto curto de teses trabalhistas recorrentes com redação pronta, fundamento e status atual (ADI 5.766, ADPF 501, ADC 58, art. 62 I com controle por rastreador, Súmula 338, rescisão indireta art. 483). Quando a tese for acionada no caso, o texto consolidado entra na peça em vez de um marcador de revisão. Sem chamada de IA extra — é conteúdo curado, injetado no prompt.

**Fase B — Densidade e jurisprudência por tese**
Elevar a exigência de desenvolvimento por seção no prompt (mínimo de parágrafos e obrigatoriedade de um julgado por tese controvertida), calibrado pela extensão do modelo do escritório: a minuta passa a mirar uma faixa proporcional ao modelo anexado, não um tamanho fixo. A busca de jurisprudência já existe no sistema e passa a ser acionada por tese.

**Fase C — Conferência fato ↔ pedido**
Verificação determinística ao fim da geração: cada tese desenvolvida no corpo tem pedido correspondente na lista, e cada pedido tem seção que o fundamenta. Divergência vira alerta objetivo no painel ("fato narrado sem pedido: intervalo intrajornada").

**Fase D — Limpeza do painel de pendências**
Separar "pendência de instrução" (anexar documento, informar dado do cliente) de "defeito da peça". O selo passa a mostrar só o que compromete a qualidade do texto.

## Fora de escopo

Injeção automática de valores nos pedidos, estimativa de horas extras e valor da causa numérico — congelados até a excelência textual estar validada.

## Detalhes técnicos

Novos: `supabase/functions/_shared/legal-theses.ts` (teses curadas). Alterados: `generate-legal-draft/index.ts` (injeção das teses, exigência de densidade e de julgado por tese), `_shared/legal-blocks.ts` (guidance por bloco), `_shared/completeness.ts` (categoria "instrução" e conferência fato ↔ pedido), `src/components/cases/drafts/CompletenessPanel.tsx` (leitura do painel). Sem migração de banco. Custo adicional por geração próximo de zero na Fase A; a Fase B aumenta os tokens de saída.

## Validação

Regerar a peça do Anderson x JTI após a Fase A e comparar: marcadores de revisão de tese devem ir a zero. Após a Fase B, comparar a extensão e a presença de julgado por tese contra o modelo do escritório.
