## Diagnóstico

Na URL publicada (`https://iapeticaodhl.lovable.app/`), o console mostra um único erro fatal:

```
Uncaught Error: supabaseUrl is required.
   at new SupabaseClient ...
```

O que está acontecendo:

1. `src/integrations/supabase/client.ts` (arquivo auto-gerado) chama `createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {...})` no **top-level do módulo**.
2. No build publicado em produção, `import.meta.env.VITE_SUPABASE_URL` está chegando vazio → `createClient` lança a exceção imediatamente, durante o `import`.
3. Esse erro acontece **antes do React montar** (é um erro de avaliação de módulo, não de render). Portanto:
   - `ErrorBoundary` **não captura** (ele só pega erros em render/lifecycle de filhos).
   - Nenhum `<Navigate>` é executado → não há redirect para `/login` nem `/dashboard`.
   - O usuário só vê o `body { background: hsl(222 47% 6%) }` definido em `index.css` → **tela preta**.

A memória do projeto (`Resilience` / `Supabase Client`) já registra exatamente este aprendizado: *"Lazy load Supabase client in main.tsx to prevent blank screens"*. Essa proteção existia e foi perdida — hoje `main.tsx` importa `App` estaticamente, e `App.tsx` → `AuthContext` → `lib/backend/client.ts` → `integrations/supabase/client.ts` em cadeia síncrona no top-level.

Confirmação visual: screenshot da raiz publicada = tela 100% preta, sem fallback de erro, sem login.

## Correção

Restaurar o padrão de carregamento resiliente em `src/main.tsx` para que o erro de configuração seja capturado e a UI de fallback do `ErrorBoundary` apareça em vez da tela preta.

### Mudança única: `src/main.tsx`

Substituir o import estático de `App` por um carregamento dinâmico **depois** de validar as variáveis de ambiente. Estrutura:

```tsx
import { createRoot } from "react-dom/client";
import { Suspense, lazy } from "react";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { getBackendConfigStatus } from "./lib/backend/client";
import "./index.css";

const root = createRoot(document.getElementById("root")!);

function BootError() {
  // reaproveita ErrorBoundary em estado de erro forçado
  throw new Error("Backend não configurado");
}

if (getBackendConfigStatus() !== "ok") {
  root.render(
    <ErrorBoundary>
      <BootError />
    </ErrorBoundary>
  );
} else {
  const App = lazy(() => import("./App"));
  root.render(
    <ErrorBoundary>
      <Suspense fallback={null}>
        <App />
      </Suspense>
    </ErrorBoundary>
  );
}
```

Por que isso resolve:

- `getBackendConfigStatus()` lê `import.meta.env` sem instanciar o client Supabase — é seguro mesmo com env vazia.
- Quando a env está faltando, mostramos a tela de erro amigável do `ErrorBoundary` (já existente, com fundo claro e botão "Recarregar página") em vez de tela preta silenciosa.
- Quando a env está OK, o `import("./App")` dinâmico carrega `AuthContext`/`supabase` e o redirect `/` → `/login` ou `/dashboard` funciona normalmente.
- Qualquer erro que ainda escape em render/lifecycle continua coberto pelo `ErrorBoundary`.

### Fora de escopo

- Não vou tocar em `src/integrations/supabase/client.ts` (auto-gerado, proibido editar).
- Não vou alterar `App.tsx`, `AuthContext` ou rotas — a lógica deles já está correta; o problema é puramente de boot.
- Não vou mexer no `index.css` ou no tema escuro.

### Verificação após implementar

1. Abrir o preview e confirmar que `/` redireciona para `/login` (ou `/dashboard` se logado).
2. Conferir o console — nenhum erro `supabaseUrl is required`.
3. Após o usuário publicar a nova versão, abrir `https://iapeticaodhl.lovable.app/` e confirmar:
   - Se env estiver presente no build publicado → redirect funciona.
   - Se ainda estiver faltando → aparece o card de "Erro de Configuração" em vez de tela preta, deixando claro o problema (e permitindo investigar o pipeline de publish em seguida).
