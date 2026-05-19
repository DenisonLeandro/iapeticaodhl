## Diagnóstico

A causa provável da tela preta não é o Lovable Cloud em si: o backend está ativo e saudável. O problema está no código de inicialização do frontend.

Pontos encontrados:

- `src/integrations/supabase/client.ts` é auto-gerado e lê apenas:
  - `import.meta.env.VITE_SUPABASE_URL`
  - `import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY`
- `src/lib/backend/client.ts` importa esse client auto-gerado no topo do arquivo.
- Por causa desse import estático, quando `VITE_SUPABASE_URL` não existe no build publicado, o erro `supabaseUrl is required` acontece antes da aplicação conseguir renderizar qualquer fallback ou redirecionamento.
- As variáveis públicas existem no ambiente local do preview, mas o build publicado ainda pode estar sem elas ou usando um artefato anterior.

## Plano de correção

1. **Não editar `.env` nem o client auto-gerado**
   - Lovable Cloud injeta essas variáveis automaticamente.
   - `.env`, `src/integrations/supabase/client.ts` e `src/integrations/supabase/types.ts` não devem ser editados manualmente.

2. **Refatorar `src/lib/backend/client.ts` para ser seguro no import**
   - Remover o import estático de `@/integrations/supabase/client`.
   - Criar funções puras para resolver a configuração pública:
     - usar `VITE_SUPABASE_URL` quando existir;
     - opcionalmente derivar a URL a partir de `VITE_SUPABASE_PROJECT_ID` como fallback;
     - aceitar `VITE_SUPABASE_PUBLISHABLE_KEY` e, se necessário, `VITE_SUPABASE_ANON_KEY`.
   - Só instanciar/importar o client quando a configuração estiver válida.

3. **Criar um client resiliente apontado para o Lovable Cloud do projeto**
   - Em vez de depender cegamente do auto-gerado durante o boot, o wrapper pode criar um único client com a URL/chave públicas resolvidas.
   - Isso mantém apenas uma instância do client no app e evita tela preta quando o arquivo auto-gerado recebe env incompleta.

4. **Ajustar `src/main.tsx` para checar a configuração sem carregar o client**
   - `getBackendConfigStatus()` deve funcionar sem importar/instanciar o client.
   - Se estiver tudo OK, carrega `App` normalmente.
   - Se estiver faltando configuração, renderiza uma tela de erro amigável em vez de tela preta.

5. **Atualizar os testes de env**
   - Corrigir o teste que hoje espera `mod.supabase` existir mesmo sem env, pois isso é justamente o que quebra a renderização.
   - Validar:
     - URL ausente + project ID ausente → `missing_url`;
     - URL ausente + project ID presente → `ok`;
     - chave ausente → `missing_key`;
     - import do wrapper sem env não deve lançar erro.

6. **Validação**
   - Rodar os testes relevantes de ambiente/boot.
   - Conferir que a rota `/` redireciona para `/login` sem sessão e para `/dashboard` com sessão.
   - Após a implementação, será necessário clicar em **Update** no Publish para a correção frontend ir para a versão publicada.