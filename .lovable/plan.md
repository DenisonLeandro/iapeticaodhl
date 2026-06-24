Aprovado com condições. Vou implementar nesta ordem, com diagnóstico antes de cada correção, e só fechar depois do teste 900x503 no processo `0000777-55.2025.5.09.0673`.

## 1. Diagnosticar e corrigir o erro `Cannot read properties of null (reading 'destroy')`

Pistas atuais do stack trace (já capturado em runtime errors):
```
TypeError: Cannot read properties of null (reading 'destroy')
  at updateEffectImpl (react-dom)
  at useEffect (react)
  at useCaseChat (/src/hooks/useCaseChat.ts:107)
  at CaseChatPanel (/src/components/cases/CaseChatPanel.tsx:392)
```

Linha 107 do `useCaseChat.ts` cai no `useEffect` que reseta `visible` quando `caseId` muda (`initializedForCase.current`). Esse erro `destroy` é o React tentando rodar o cleanup do effect anterior depois que algo no estado interno do hook ficou null entre HMR/remount.

Ação:
- Auditar todos os `useEffect` de `useCaseChat` (reset por caseId, merge servidor→visible, limpeza de fallback, subscription realtime) e garantir que cada cleanup só toca refs/handles ainda não nulos (`channel?.unsubscribe?.()`, `if (ref.current) { ref.current = null }`).
- Estabilizar a ordem dos hooks: reduzir a quantidade de `useEffect` que escrevem em `setVisible` e mover a lógica de merge para `useMemo` derivado, eliminando o effect que mais provavelmente está sofrendo HMR (linha ~107 atual).
- Confirmar pelo console (após o fix) que o erro `destroy` não reaparece.

## 2. Unificar cliente backend e matar o alerta `Multiple GoTrueClient instances`

Encontrado por busca:
- `src/services/aiCosts.ts` ainda importa `@/integrations/supabase/client` (o cliente legado auto-gerado). Isso instancia um segundo `createClient` em paralelo ao wrapper `@/lib/backend/client`.
- Resto do código já usa `@/lib/backend/client`.

Ação:
- Trocar o import em `src/services/aiCosts.ts` para `@/lib/backend/client`.
- Reescrever `src/integrations/supabase/client.ts` para reexportar o mesmo singleton de `@/lib/backend/client` (mantendo o caminho legado funcional, mas sem instanciar outro cliente). Esse arquivo é “auto-gerado”, mas a reexportação não altera schema/tipos — só remove o segundo `createClient`.
- Rodar busca final e confirmar zero imports de `@/integrations/supabase/client` além do próprio arquivo de reexportação.
- Validar no console que `Multiple GoTrueClient instances` sumiu.

## 3. Fonte visual estável por `caseId` que sobrevive a remount

Hoje `visible` é `useState` dentro do hook — some no unmount do painel.

Ação:
- Criar um store de módulo simples (`src/hooks/caseChatStore.ts`) com um `Map<caseId, CaseChatMessage[]>` + `Set<listener>`, expondo `getSnapshot`, `setMessages`, `subscribe`.
- Usar `useSyncExternalStore` em `useCaseChat` para ler/escrever no store, sobrevivendo a remount do `CaseChatPanel`.
- Mesclar servidor → store via `useEffect` separado, sem nunca apagar locais (mesma função `mergeServerWithLocal`).
- Pergunta otimista (`temp-user-*`) e resposta `upsertAssistantFromFinal` escrevem direto no store + `queryClient.setQueryData`.

Regra garantida:
```
pergunta azul aparece → store persiste → remount/refetch não apagam
finalResp / mensagem do banco → store + cache atualizam → renderiza
```

## 4. Pergunta otimista persistente

- `sendMessage` adiciona `temp-user-*` no store imediatamente (já existe; agora sobrevive a remount).
- `mergeServerWithLocal` continua deduplicando por normalização de conteúdo + janela de 60s, e remove o `temp-user-*` quando a versão persistida aparece.
- Em caso de erro do stream, mantém a pergunta visível com o card de erro abaixo.

## 5. Resposta da IA imediatamente visível

- `finalResp` → `upsertAssistantFromFinal` no store → `queryClient.setQueryData` → `invalidateQueries`.
- `assistantFallback` continua, mas só é exibido quando o id ainda não está em `visible`; é limpo assim que a versão persistida aparece.
- `invalidateQueries` nunca apaga visível porque o merge preserva mensagens locais.

## 6. Empty state seguro no `CaseChatPanel`

Alterar a condição atual:
```ts
visibleMessages.length === 0 && !isSending && !showFallback
```
para também considerar `streamingText`, `chatError`, e qualquer item já em cache. Enquanto qualquer um desses existir, não renderiza o empty state.

## 7. Testes obrigatórios via Playwright

Viewport `900x503`, processo `0000777-55.2025.5.09.0673` (`/cases/9c035db9-faf4-40b4-9339-c0341c075e5f`):

1. Abrir Chat IA avançado.
2. Enviar pergunta real: “Qual o valor atualizado no processo e quais os próximos passos?”.
3. Conferir visualmente (screenshots): pergunta azul permanece, não volta para empty, resposta aparece, citações aparecem, feedback aparece, composer acessível, sem duplicidade.
4. Coletar console: sem `destroy`, sem `Multiple GoTrueClient instances`.
5. Conferir `ai_usage_log operation='chat'` para a pergunta recém-enviada.
6. Reload da página → reabrir Chat IA avançado → confirmar histórico carregado.

## 8. Não tocar no backend

Nada de: edge `case-chat`, RAG, embeddings, pipeline, migrations, RLS, telemetria, geração de peças, PR-4.1.

## Detalhes técnicos

Arquivos alterados:
- `src/services/aiCosts.ts` — troca de import.
- `src/integrations/supabase/client.ts` — reexporta singleton.
- `src/hooks/caseChatStore.ts` — novo store por `caseId`.
- `src/hooks/useCaseChat.ts` — store via `useSyncExternalStore`, cleanups defensivos, menos effects.
- `src/components/cases/CaseChatPanel.tsx` — empty state seguro.

Critério final de “concluído”:
```
✔ erro destroy ausente
✔ alerta GoTrue ausente
✔ pergunta azul persistente
✔ resposta visível
✔ resposta sobrevive a refetch
✔ histórico sobrevive a reload
✔ backend intocado
```

## Relatório final

Será entregue ao final com: origem exata do erro `destroy`, arquivo/linha corrigidos, imports antigos encontrados e migrados, status do alerta GoTrue, mecanismo de persistência da pergunta otimista, mecanismo de persistência da resposta, sobrevivência a remount, resultado pós-reload, evidências do teste 900x503, confirmação de backend intocado.