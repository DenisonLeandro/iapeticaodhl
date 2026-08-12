# Correção: "Resposta inválida da IA ao gerar a minuta"

## O que realmente aconteceu

Os logs da função `generate-legal-draft` mostram, no mesmo instante da falha:

```text
callLlm:error 503 {"error":{"message":"Service temporarily unavailable","type":"upstream_error"}}
generate-legal-draft:draft { code: "invalid_llm_json", status: 500 }
```

Ou seja: o provedor de IA ficou temporariamente indisponível (503). A função não trata
esse status — ela só trata 429, 402 e timeout (599). Como a resposta veio vazia, o código
caiu na verificação genérica "não consegui interpretar o JSON" e devolveu
`invalid_llm_json` / 500.

Portanto **não houve erro de conteúdo nem de prompt**: foi indisponibilidade momentânea
do provedor, reportada com a mensagem errada e sem nenhuma tentativa de repetição.

## O que será feito

1. **Retry automático em falhas transitórias**
   Em `callLlm`, repetir a chamada até 2 vezes (backoff ~2s e ~5s) quando o status for
   503, 502, 500 ou erro de rede. A maioria dos 503 se resolve na segunda tentativa.

2. **Mensagem correta para indisponibilidade**
   Novo tratamento antes do check de JSON: se `http_status >= 500` (ou 0/rede), retornar
   código `llm_unavailable` com a mensagem "O serviço de IA está temporariamente
   indisponível. Tente novamente em alguns instantes." em vez de "Resposta inválida".

3. **Salvamento de resposta truncada**
   Se a resposta vier com JSON incompleto (corte por tamanho), tentar recuperar o campo
   `content` por extração tolerante antes de falhar. Só falha como `invalid_llm_json`
   quando realmente não houver texto aproveitável.

4. **UI: retry amigável**
   Na tela de geração da minuta, quando o código for `llm_unavailable` ou `draft_timeout`,
   exibir mensagem clara com botão "Tentar novamente" em vez do overlay genérico de erro.

## Detalhes técnicos

- `supabase/functions/generate-legal-draft/index.ts`: retry com backoff em `callLlm`;
  novo ramo de erro por `http_status >= 500`; extração tolerante em `extractJson`
  (fechamento de JSON truncado / captura do campo `content` por regex).
- `src/services/caseDrafts.ts` + tela `DraftGeneratorPage.tsx`: propagar `code` do erro e
  mostrar mensagem específica com ação de repetir.
- Sem mudança de schema, de prompt ou de custo por geração (o retry só ocorre quando a
  chamada anterior falhou sem consumir tokens).
