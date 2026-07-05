
# PR-4.4B.2C — Qualidade da peça: não limitação, sucessivo, exibição ampliada motorista, insalubridade, intrajornada pós-Reforma

Escopo restrito à redação da peça e prompts. Sem tocar em calc-engine, Chat IA, Ficha, prefill, RAG, embeddings, pipeline documental, analyze-case, analyze-legal-template, legal-intents, Biblioteca de Modelos, download de modelos. Sem migrations.

## 1. Tópico obrigatório de não limitação (reforço)

`supabase/functions/_shared/legal-blocks.ts`
- `NON_LIMITATION_TOPIC` já existe e cita a lista ampliada de documentos do motorista — manter, e ajustar a última linha para deixar explícita a orientação: "REVISAR jurisprudência atual do respectivo TRT e do TST sobre limitação/estimativa do art. 840, §1º, CLT após a Reforma Trabalhista".
- Introduzir `NON_LIMITATION_TOPIC_HEADER = "DA ESTIMATIVA DOS VALORES ATRIBUÍDOS AOS PEDIDOS E DA NÃO LIMITAÇÃO DA CONDENAÇÃO"` (constante isolada para o quality gate poder validar por título exato).

`supabase/functions/generate-legal-draft/index.ts`
- Na montagem do prompt do `DRAFT_SYSTEM` (e no bloco “TÓPICOS FIXOS OBRIGATÓRIOS” já injetado), reforçar:
  - "O tópico com o título EXATO 'DA ESTIMATIVA DOS VALORES ATRIBUÍDOS AOS PEDIDOS E DA NÃO LIMITAÇÃO DA CONDENAÇÃO' é OBRIGATÓRIO e deve ser inserido no corpo da peça, imediatamente antes do pedido final, usando o texto fornecido em NON_LIMITATION_TOPIC como base (podendo ser adaptado ao caso, mas sem remover a lista ampliada de documentos nem a menção ao art. 840, §1º, CLT)."
  - "É PROIBIDO omitir este tópico, mesmo que a peça já mencione estimativa em outro lugar."

`supabase/functions/review-legal-draft/index.ts`
- No quality gate: adicionar checagem `has_non_limitation_topic` — severidade `risco_alto` quando o texto não contiver o título `DA ESTIMATIVA DOS VALORES ATRIBUÍDOS AOS PEDIDOS E DA NÃO LIMITAÇÃO DA CONDENAÇÃO`. Sugestão de correção: colar `NON_LIMITATION_TOPIC`.

## 2. Pedido final específico de não limitação

`supabase/functions/_shared/final-requests/trabalhista-inicial.ts`
- Item 18 já existe; renumerar como obrigatório e substituir o texto para:
  "18. Reconhecimento expresso de que os VALORES atribuídos aos pedidos são MERAMENTE ESTIMATIVOS (art. 840, §1º, CLT), NÃO LIMITANDO A CONDENAÇÃO aos montantes indicados na inicial, devendo as parcelas deferidas ser apuradas INTEGRALMENTE em liquidação de sentença, observados os documentos juntados, os documentos cuja exibição se requer e a prova produzida."
- Na seção REGRAS, deixar explícito: "Item 18 é OBRIGATÓRIO e deve constar literalmente no pedido final, mesmo quando houver valores calculados."
- `review-legal-draft` valida presença de fragmento chave ("NÃO LIMITANDO A CONDENAÇÃO" ou "não limita a condenação") no pedido final; ausência = `risco_alto`.

## 3. Pedido sucessivo/alternativo em rescisão indireta (reforço)

`supabase/functions/_shared/legal-blocks.ts`
- Manter `SUCCESSIVE_RESCISAO_INDIRETA_TOPIC` e `SUCCESSIVE_RESCISAO_INDIRETA_REQUEST`.
- Ampliar o REQUEST para incluir explicitamente aviso-prévio indenizado, 13º proporcional, férias proporcionais + 1/3, saldo, FGTS + 40% e liberação de guias, quando compatíveis com a hipótese de dispensa sem justa causa reconhecida sucessivamente — mantendo `[CALCULAR VALOR — revisar memória de cálculo]` para os valores.

`generate-legal-draft`
- No prompt, quando a peça sustentar rescisão indireta (detectado por keyword `rescisão indireta` no objective/analysis/claim_map), reforçar:
  - "Antes do pedido final, incluir tópico próprio com o título 'DO PEDIDO SUCESSIVO — HIPÓTESE DE NÃO RECONHECIMENTO DA RESCISÃO INDIRETA', usando o texto SUCCESSIVE_RESCISAO_INDIRETA_TOPIC como base."
  - "O pedido final deve conter item específico invocando esse pedido sucessivo, com verbas discriminadas e uso de `[CALCULAR VALOR — revisar memória de cálculo]` quando o valor não estiver disponível."

`review-legal-draft`
- Quando `rescisão indireta` for detectada e faltar o tópico sucessivo ou item correspondente no pedido final → `risco_alto` com sugestão de inserção.

## 4. Exibição ampliada de documentos para motorista

`supabase/functions/_shared/legal-blocks.ts`
- Nova constante `MOTORISTA_EXHIBITION_LIST` (lista canônica e completa):
  - controles de jornada; diário de bordo; papeletas; ficha de trabalho externo; relatórios de rastreador/GPS; discos e relatórios de tacógrafo; MDF-e; CT-e; relatórios de viagem; relatórios de km rodado; relatórios de produtividade; comprovantes de pagamento de produtividade/bônus; holerites; recibos de férias; extratos analíticos de FGTS; comprovantes de depósito do FGTS; fichas de EPI; PPRA/PGR; PCMSO; LTCAT; laudos ambientais; documentos referentes a produtos químicos transportados (fichas FISPQ, romaneios, MOPP, ANTT).
- Bloco motorista (`TRABALHISTA_MOTORISTA`) recebe novo item `exibicao_motorista` com `guidance` referenciando essa lista.
- `NON_LIMITATION_TOPIC` continua citando a lista (já cita) — atualizar para incluir "FISPQ / MOPP / ANTT" e "laudos ambientais".

`trabalhista-inicial.ts`
- Item 17 (exibição) reescrito para usar a lista canônica, incluindo os documentos adicionados (FISPQ, MOPP, ANTT, PGR, LTCAT, produtos químicos), com aviso: "requerer sob pena das consequências do art. 400 CPC e da Súmula 338, I, TST".

`generate-legal-draft`
- Quando `detectMotoristaProfile` = true, injetar no user prompt bloco "EXIBIÇÃO DE DOCUMENTOS — MOTORISTA (obrigatório)" com a lista canônica e instrução: "Redija este pedido no corpo da peça (tópico próprio) E no pedido final (item específico)."

`review-legal-draft`
- Se `motorista` detectado e a lista canônica não estiver presente no texto (checar pelo menos 10 itens da lista) → `atencao` com sugestão copiável do bloco completo.

## 5. Insalubridade — reforço em CLT/NR-15 e perícia; retirar apoio à Súmula 448/TST por analogia

`generate-legal-draft` (bloco FUNDAMENTAÇÃO JURÍDICA MÍNIMA do `DRAFT_SYSTEM`)
- Trocar a linha "Insalubridade/periculosidade" por:
  - "Insalubridade: arts. 189, 190, 191 e 192 CLT; NR-15 e seus anexos (agentes químicos, ruído, vibração, calor); necessidade de perícia técnica (art. 195 CLT); pedido de nomeação de perito. Base de cálculo: [REVISAR ENTENDIMENTO ATUAL — Súmula Vinculante 4/STF e jurisprudência corrente do TST]. NÃO invocar Súmula 448/TST por analogia — fundamentar diretamente na CLT, na NR-15 e na prova pericial; se houver hipótese específica de enquadramento por analogia, marcar `[REVISAR FUNDAMENTO — analogia com Súmula 448/TST pode ser frágil]`."
- Periculosidade permanece separada: arts. 193 CLT; NR-16.

`trabalhista-inicial.ts`
- Item 16 (insalubridade/periculosidade) reescrito removendo qualquer sugestão de analogia com Súmula 448/TST e passando a citar: "arts. 189-192 CLT; NR-15 (agentes químicos, ruído, vibração, calor); perícia (art. 195 CLT); pedido de nomeação de perito; base de cálculo — `[REVISAR SV 4/STF e entendimento atual do TST]`."

`review-legal-draft`
- Nova checagem `insalubridade_fundamentacao_fraca`: severidade `atencao` sempre que a peça citar "Súmula 448" em contexto de analogia sem também citar arts. 189/192 CLT e NR-15; sugestão: substituir pelo bloco reforçado.

## 6. Intervalo intrajornada pós-Reforma

`generate-legal-draft` (`DRAFT_SYSTEM`)
- Substituir a instrução atual sobre art. 71 §4º CLT por:
  - "Intervalo intrajornada: art. 71 CLT. Para períodos contratuais posteriores a 11/11/2017 (Lei 13.467/17), o §4º impõe pagamento APENAS do tempo SUPRIMIDO, com natureza indenizatória — NÃO afirmar de forma absoluta o pagamento integral do período. Para períodos anteriores, aplicar Súmula 437/TST. Quando o contrato atravessar a Reforma, dividir o pedido em dois períodos, cada um com sua base legal, e marcar `[REVISAR APLICAÇÃO TEMPORAL — art. 71, §4º, CLT após 11/11/2017]`."
- Idem no bloco motorista (`TRABALHISTA_MOTORISTA.intra`): atualizar `guidance` para deixar explícita a necessidade de segmentação temporal e o alerta de revisão.

`trabalhista-inicial.ts`
- Item 11 (intrajornada) reescrito:
  - "Indenização pela supressão do INTERVALO INTRAJORNADA (art. 71, §4º, CLT). Para contratos posteriores a 11/11/2017: apenas o tempo suprimido, natureza indenizatória. Para períodos anteriores: aplicar Súmula 437/TST (pagamento integral com natureza salarial e reflexos). Segmentar por período — `[REVISAR APLICAÇÃO TEMPORAL — art. 71, §4º, CLT pós-Reforma]`."

`review-legal-draft`
- Nova checagem `intrajornada_pos_reforma`: severidade `atencao` quando a peça afirmar "pagamento integral do intervalo" para contratos iniciados/vigentes após 11/11/2017 sem o marcador de revisão; sugestão copiável com o texto acima.

## 7. Manter `[CALCULAR VALOR — revisar memória de cálculo]` (garantia)

- Sem mudanças no calc-engine. `generate-legal-draft` já filtra por `_draft_injectable`. Adicionar apenas nota reforçando: "Ao redigir os novos itens (não limitação, sucessivo, exibição motorista, insalubridade, intrajornada), continuar usando `[CALCULAR VALOR — revisar memória de cálculo]` sempre que não houver valor injetável correspondente."

## 8. Validação (caso Elvis/LB)

1. Regenerar a peça e confirmar:
   - Presença do tópico com título exato `DA ESTIMATIVA DOS VALORES ATRIBUÍDOS AOS PEDIDOS E DA NÃO LIMITAÇÃO DA CONDENAÇÃO`.
   - Item de pedido final com "NÃO LIMITANDO A CONDENAÇÃO".
   - Tópico sucessivo da rescisão indireta + item correspondente no pedido final.
   - Bloco de exibição de documentos com a lista ampliada (CT-e, MDF-e, GPS, tacógrafo, diário, papeleta, relatórios de viagem/km/produtividade, holerites, FGTS, EPI, PGR, PCMSO, LTCAT, produtos químicos).
   - Insalubridade fundamentada em CLT 189/192 + NR-15 + perícia, sem apoio na Súmula 448/TST por analogia.
   - Intrajornada segmentada por período contratual, com alerta de revisão do §4º pós-Reforma.
2. Confirmar que valores inseguros continuam saindo como `[CALCULAR VALOR — revisar memória de cálculo]` (sem regressão do PR-4.4B.2B).
3. Confirmar que highlights em vermelho no preview seguem funcionando (sem regressão).
4. Confirmar que copiar/salvar continua sem HTML (sem regressão).
5. Confirmar sem regressão em: gerar/salvar/copiar/arquivar/listar/exportar, aba Peças, Chat IA, Ficha, prefill, Biblioteca de Modelos, download de modelos, analyze-case, analyze-legal-template, legal-intents.

## 9. Arquivos

Editados:
- `supabase/functions/_shared/legal-blocks.ts`
- `supabase/functions/_shared/final-requests/trabalhista-inicial.ts`
- `supabase/functions/generate-legal-draft/index.ts`
- `supabase/functions/review-legal-draft/index.ts`

Sem novos arquivos. Sem migrations. Sem alteração de UI. Sem alteração de calc-engine.
