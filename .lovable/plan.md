## Diagnóstico

O backend hospedado está saudável, mas o frontend publicado ainda pode quebrar porque parte do código continua importando o cliente auto-gerado diretamente de `@/integrations/supabase/client`. Esse arquivo depende exclusivamente de `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY` no momento do import; quando alguma variável não chega no bundle publicado, o app cai antes de montar React.

Também há um segundo erro visível: `useAuth deve ser usado dentro de um AuthProvider`, indicando que a ordem dos providers/rotas precisa ser endurecida para evitar renderização fora do contexto durante falhas de boot.

## Plano de correção

1. **Centralizar todo acesso ao backend**
   - Trocar os imports restantes de `@/integrations/supabase/client` para `@/lib/backend/client` nos arquivos que ainda usam o cliente frágil.
   - Manter `src/integrations/supabase/client.ts` intocado, pois é auto-gerado.

2. **Fixar fallback do Lovable Cloud atual no frontend**
   - Atualizar `src/lib/backend/client.ts` para resolver a URL do backend nesta ordem:
     1. `VITE_SUPABASE_URL`
     2. `VITE_SUPABASE_PROJECT_ID`
     3. fallback explícito para o backend Lovable Cloud deste projeto
   - Resolver a chave pública nesta ordem:
     1. `VITE_SUPABASE_PUBLISHABLE_KEY`
     2. `VITE_SUPABASE_ANON_KEY`
     3. fallback público do projeto atual
   - Isso não envolve segredo privado; é configuração pública necessária para o frontend conectar ao backend.

3. **Remover tela de erro indevida quando o Cloud existe**
   - Ajustar `getBackendConfigStatus()` para retornar `ok` usando os fallbacks acima.
   - Assim a raiz `/` volta a renderizar o app e redirecionar para `/login` ou `/dashboard`.

4. **Endurecer o boot/AuthProvider**
   - Garantir que `HomeRedirect`, `ProtectedRoute` e rotas protegidas só renderizem dentro de `AuthProvider`.
   - Se necessário, revisar a composição em `App.tsx` para eliminar o erro `useAuth deve ser usado dentro de um AuthProvider`.

5. **Atualizar os testes de ambiente**
   - Cobrir os cenários:
     - sem URL mas com fallback do projeto atual → `ok`
     - sem chave mas com fallback público do projeto atual → `ok`
     - import do client sem env não deve derrubar o app

6. **Validar**
   - Conferir que não resta nenhum import direto do cliente auto-gerado em código de runtime.
   - Validar em preview que `/` não mostra mais erro de configuração e segue para `/login` sem sessão.
   - Depois da aprovação e implementação, será necessário clicar em **Update** na publicação para levar a correção ao domínio publicado.