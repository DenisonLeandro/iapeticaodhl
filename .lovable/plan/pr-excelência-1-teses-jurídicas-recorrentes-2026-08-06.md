# PR-EXCELÊNCIA 1 — Teses jurídicas recorrentes

Objetivo único: a petição não deve mais mandar o advogado pesquisar matéria que o sistema já conhece. Cálculo permanece fora de escopo e não será tocado.

## 1. Arquivo de teses

Novo `supabase/functions/_shared/legal-theses.ts`, com dez teses no formato exato pedido (`key`, `title`, `guidance`, `legal_basis`, `reviewed_at`):

justiça gratuita; honorários sucumbenciais do beneficiário da gratuidade; ADI 5.766; correção monetária e juros (ADC 58); trabalho externo e controle de jornada; Súmula 338 do TST; intervalo intrajornada; rescisão indireta; integração da remuneração variável; honorários sucumbenciais.

O `guidance` de cada tese diz o que sustentar e como amarrar aos fatos do caso — não é texto pronto para colar. O `legal_basis` traz só artigo, súmula, orientação jurisprudencial ou decisão vinculante. Nenhuma tese carrega número de processo, relator ou data de julgamento de acórdão comum.

Sem tabela, sem tela, sem versionamento.

## 2. Seleção da tese aplicável

Função determinística `selectApplicableTheses(...)` no mesmo arquivo. Ela recebe o que já existe no fluxo de geração — blocos obrigatórios da peça, playbook carregado, subtipo do caso e o texto do contexto/pedidos — e devolve só as teses acionadas por correspondência de palavras-chave. Sem chamada de IA, sem heurística por cliente ou por processo.

Em `generate-legal-draft`, o bloco renderizado das teses selecionadas entra no prompt junto do playbook, com instrução expressa de aplicar cada tese aos fatos concretos e de nunca reproduzir texto genérico.

## 3. Fim dos marcadores de revisão nas matérias cobertas

Duas frentes:
- Retirar de `_shared/legal-blocks.ts` as instruções que mandam marcar revisão nas matérias agora cobertas (o `guidance` de honorários hoje pede explicitamente marcar ADI 5.766; o de intrajornada também manda marcar revisão temporal).
- Instrução no prompt: matérias listadas nas teses fornecidas devem ser afirmadas com a fundamentação recebida, sem `[REVISAR ...]`, `[ATUALIZAR ...]` ou `[CONFERIR JURISPRUDÊNCIA ...]`. Matérias fora da lista continuam podendo receber alerta de revisão.

## 4. Classificação das pendências no painel

Em `_shared/completeness.ts`, as categorias passam de três para cinco: revisão jurídica, qualificação, instrução, cálculo, outros. `[ANEXAR ...]` vira instrução, `[REVISAR ...]`/`[CONFERIR ...]`/`[ATUALIZAR ...]` viram revisão jurídica, `[CALCULAR ...]` continua cálculo, `[INFORMAR NOME/DATA/...]` continua qualificação.

Numeração estrutural de pedidos (`[I]`, `[II]`, `[III]`, `[IV]`, romanos em geral) deixa de ser contada como pendência.

`CompletenessPanel.tsx` apenas passa a exibir as cinco categorias. Nenhum painel novo.

## Fora de escopo

Cálculo, valor da causa, tamanho mínimo da peça, jurisprudência obrigatória por tese, conferência fatos ↔ pedidos, novo agente, nova tela, migração de banco, atualização automática das teses.

## Detalhes técnicos

Novo: `supabase/functions/_shared/legal-theses.ts`. Alterados: `supabase/functions/generate-legal-draft/index.ts` (seleção + bloco no prompt + instrução anti-marcador), `supabase/functions/_shared/legal-blocks.ts` (retirar as ordens de marcar revisão nas matérias cobertas), `supabase/functions/_shared/completeness.ts` (cinco categorias e filtro de numeração romana), `src/components/cases/drafts/CompletenessPanel.tsx` (rótulos). Sem migração, sem chamada de IA adicional, nada tocado em `calc-engine.ts`. Testes novos em `src/test/completeness/` para a classificação e para a seleção de teses.

## Validação

Regerar Anderson Luis x JTI e reportar: marcadores de ADI 5.766 zerados, quais teses foram selecionadas, trechos mostrando a tese ligada aos fatos do caso, e a contagem de pendências por categoria. Repetir em uma segunda petição de fatos distintos para confirmar que a seleção varia com a matéria e não com o cliente. Confirmar que o objeto de cálculo persistido não mudou.
