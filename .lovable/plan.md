# Análise da peça Anderson Luis x JTI e próximos ajustes

## O que ficou bom

A peça está estruturalmente fiel ao modelo da banca: timbre, blocos de endereço, endereçamento, qualificação, preliminares (gratuidade + inversão do ônus), teses (art. 62, I com fiscalização por rastreador, intrajornada, rescisão indireta, integração da remuneração variável), pedidos numerados em romanos remetendo aos itens, e o fecho. A técnica jurídica está correta e citada com precisão (Súmulas 264, 340 e 172 do TST, art. 71 §4º, ADC 58, art. 400 do CPC). Isso era exatamente a dor anterior — está resolvido.

A auditoria de completude foi persistida corretamente desta vez: 23 marcadores no total, 5 de cálculo, soma de pedidos de R$ 17.198,79 com 8 rubricas.

## O problema central que sobrou

**Os valores existem no sistema, mas não entraram no texto.** O painel calculou R$ 17.198,79 e marcou o valor da causa como "completo"; o corpo da peça continua com `[CALCULAR VALOR]` em 5 lugares, inclusive no valor da causa. O advogado vê dois estados diferentes da mesma minuta.

A causa é o portão de injeção: só entra no texto item com confiança alta, zero campos faltantes e origem em documento/intake para salário, admissão e rescisão. Nesta peça só o saldo de salário passou (R$ 181,80); todo o resto ficou como "estimado" e, por regra, virou placeholder. Honorários nunca são injetáveis por regra fixa.

Outros pontos menores, mas visíveis:
- A contagem de 23 marcadores é inflada. `[II]`, `[III]`, `[IV]`, `[VI]` são a própria numeração dos pedidos e estão contados como pendência; `[ANEXAR DOCUMENTO]` e `[REVISAR ENTENDIMENTO ATUAL SOBRE ADI 5.766/STF]` são tarefas de instrução, não defeito de geração. Sobram 5 pendências reais de cálculo e 2 de qualificação (data de nascimento, nome da mãe).
- O saldo de salário de R$ 181,80 sobre salário fixo de R$ 2.727,00 corresponde a 2 dias — precisa conferir a data efetiva de rescisão (02/02/2026) contra o que o motor usou.
- A peça pede horas extras e intrajornada sem estimativa alguma, o que é o pedido de maior expressão econômica da ação.

## O que proponho fazer (escopo curto)

1. **Injetar valor estimado no texto, com rótulo.** Em vez de `[CALCULAR VALOR]`, o pedido recebe "valor estimado de R$ X (sujeito a apuração em liquidação)" sempre que houver base matemática — mesmo com confiança média. O portão atual continua existindo, mas passa a diferenciar três estados no texto: valor apurado, valor estimado e valor a apurar. Só o terceiro mantém o marcador.
2. **Valor da causa sempre numérico.** Somatório das rubricas escrito no corpo, com a ressalva "estimado, sujeito a revisão em liquidação" quando houver rubrica pendente. Nunca `[CALCULAR VALOR]` no fecho.
3. **Limpar a contagem de pendências.** Ignorar numeração romana de pedidos e criar a categoria "instrução" para `[ANEXAR ...]` e `[REVISAR ...]`, separada de "cálculo" e "qualificação". O selo passa a refletir pendência real.
4. **Conferir o saldo de salário.** Verificar o dia da rescisão usado pelo motor e o divisor, para descartar erro de 2 dias versus mês proporcional.

## Fora de escopo agora

Estimativa automática de horas extras e intrajornada (depende de arbitrar jornada e divisor — decisão do advogado, não do sistema) e substituição automática de valor manual dentro do texto já gerado.

## Detalhes técnicos

Arquivos afetados: `supabase/functions/_shared/calc-engine.ts` (estados do portão e rótulo do valor), `supabase/functions/_shared/completeness.ts` (categoria "instrução" e filtro de numeração romana), `supabase/functions/generate-legal-draft/index.ts` (bloco de instruções de valor e valor da causa no fecho), `src/components/cases/drafts/CompletenessPanel.tsx` (contagem por categoria). Sem migração de banco e sem novas chamadas de IA.
