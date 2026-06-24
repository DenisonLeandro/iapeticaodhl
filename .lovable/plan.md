## Diagnóstico resumido

O backend continua indicando que a IA responde e salva no banco: para o processo atual `9c035db9-faf4-40b4-9339-c0341c075e5f`, existem mensagens recentes de usuário e assistente em `case_chat_messages`, com conteúdo e citações. Também há registro em `ai_usage_log` com `operation='chat'`.

O sintoma descrito — aparece a pergunta em azul, a tela muda, depois “reinicia” para a tela inicial do chat sem resposta — aponta para falha de estado/renderização no frontend, não para falha da IA: o componente está deixando a lista visível depender do ciclo do React Query/refetch e do estado local efêmero do painel. Se a aba/painel remonta, se o refetch temporariamente devolve lista vazia/estado de loading, ou se a atualização direta não fica em uma fonte estável, a resposta some visualmente apesar de existir no banco.

## Objetivo do hotfix definitivo

Garantir a regra de produto:

```text
resposta salva/recebida da IA
↓
resposta imediatamente incorporada a uma fonte visual estável
↓
interface renderiza a resposta
↓
refetch apenas sincroniza, nunca apaga a resposta visível
```

## Plano de implementação

### 1. Corrigir a fonte de verdade visual do chat

No `src/hooks/useCaseChat.ts`:

- Trocar a dependência exclusiva de `messagesQuery.data` por um estado local estável de mensagens visíveis, por exemplo `visibleMessagesState`.
- Quando o query carregar/refetchar, mesclar o resultado do banco com o estado local existente, em vez de substituir cegamente.
- Quando `finalResp` chegar, inserir/atualizar a resposta nesse estado local imediatamente e também no cache do React Query com `queryClient.setQueryData`.
- Se o refetch vier atrasado, vazio, em loading, ou sem a nova resposta por latência/RLS/realtime, ele não poderá remover a resposta já visível.

### 2. Mostrar também a pergunta do usuário de forma otimista e persistente

No `src/hooks/useCaseChat.ts`:

- Ao enviar a pergunta, criar uma mensagem local temporária do usuário com `role='user'` antes da chamada da edge.
- Quando o banco retornar/refetchar a mensagem real do usuário, deduplicar por conteúdo + janela de tempo ou substituir a temporária.
- Isso evita o efeito “pergunta aparece em azul e depois reinicia/some”.

### 3. Deduplicação robusta

Implementar uma função única de merge/dedup para mensagens:

- Deduplicar assistente por `id === assistantMessageId`.
- Deduplicar usuário temporário com a mensagem persistida por `role='user'`, mesmo conteúdo normalizado e proximidade temporal.
- Ordenar sempre por `created_at ASC` com desempate por `id`.
- Preservar metadados, citações, `organization_id`, `is_pinned` e feedback quando existirem.

### 4. Garantir que o streaming não desapareça antes da resposta final

No envio:

- Manter `streamingText` até a resposta final ter sido promovida para o estado visual estável.
- Só limpar `streamingText` depois que `finalResp` foi inserido no estado local/cache ou fallback foi armado.
- Em caso de erro, manter a pergunta local e mostrar erro abaixo, sem reiniciar a conversa.

### 5. Simplificar o fallback temporário

O fallback deve ser apenas rede de segurança:

- Renderizar somente se a resposta final existe mas ainda não está no estado visual estável.
- Sumir automaticamente quando o estado visual contém a mensagem do assistente.
- Nunca substituir a lista principal nem gerar duplicidade.

### 6. Evitar “tela inicial” durante refetch

No `CaseChatPanel.tsx`:

- Renderizar a lista estável retornada pelo hook, não uma lista que pode zerar durante refetch.
- Mostrar skeleton apenas no carregamento inicial real, quando ainda não há mensagens locais/visíveis.
- Não mostrar o empty state (“Faça uma pergunta...”) se existe pergunta local, streaming, fallback, erro ou mensagem já recebida.

### 7. Revisar remounts e aba ampla

No `CaseDetailPage.tsx` e `CaseChatPanel.tsx`:

- Confirmar que o botão “Conversar com IA” continua apenas abrindo a aba ampla `chat-advanced`, sem drawer.
- Confirmar que a troca/atualização de estado não desmonta o chat durante a resposta.
- Se necessário, manter o painel de chat com `key` estável por `caseId`, não por estados transitórios.

### 8. Instrumentação segura para provar o fluxo

Manter/ajustar logs sanitizados com a flag `CASE_CHAT_DEBUG`:

- `send_start`
- `optimistic_user_added`
- `finalResp_received`
- `local_visible_upsert_done`
- `cache_setQueryData_done`
- `invalidate_done`
- `refetch_merged_preserved_local`

Sem logar conteúdo jurídico completo, tokens ou dados sensíveis.

### 9. Validação visual real

Depois de aprovado e implementado, executar Playwright em viewport `900×503` no processo atual do preview e validar:

- pergunta aparece em azul;
- estado “Pensando…”/streaming aparece;
- resposta aparece visualmente na aba Chat IA avançado;
- a tela não volta para o empty state;
- fallback não fica duplicado;
- após refetch a resposta continua visível;
- citações aparecem;
- botões de feedback aparecem;
- campo de pergunta continua acessível;
- `ai_usage_log` registra `operation='chat'`;
- nenhuma edge function, RAG, pipeline, migration, RLS ou telemetria é alterada.

## Arquivos a alterar

- `src/hooks/useCaseChat.ts` — correção principal: estado visual estável, merge/dedup, optimistic user, promoção de `finalResp`.
- `src/components/cases/CaseChatPanel.tsx` — renderização usando lista estável e empty/loading states seguros.

## Arquivos a não alterar

- `supabase/functions/case-chat/index.ts`
- RAG/embeddings/pipeline
- migrations/RLS
- telemetria
- geração de peças
- PR-4.1

## Resultado esperado

A resposta da IA não dependerá mais de `invalidateQueries`/refetch para aparecer e não será apagada por remount/refetch. Mesmo em viewport pequeno, a experiência deve permanecer: pergunta visível, resposta visível, citações e feedback visíveis, composer acessível.