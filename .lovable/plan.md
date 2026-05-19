## Objetivo

A rota `/` nunca deve renderizar conteúdo visível. Usuário deslogado → `/login`. Usuário logado → `/dashboard`.

## Situação atual

- `src/App.tsx` já mapeia `/` para `<HomeRedirect />`, que redireciona conforme o estado de auth.
- Porém, enquanto `loading` é `true`, `HomeRedirect` mostra um spinner com fundo `bg-background` (escuro). Esse é o "preto" que o usuário vê na raiz.
- `src/pages/Index.tsx` existe mas não está roteado — é código morto que pode confundir.

## Mudanças

1. **`src/App.tsx` → `HomeRedirect`**
   - Remover o estado de loading com spinner. Em vez de renderizar UI enquanto `loading`, retornar `null` (tela vazia instantânea) e deixar o `<Navigate>` disparar assim que o `AuthContext` resolver.
   - Resultado: nenhum flash de fundo escuro na raiz; o usuário vai direto para `/login` ou `/dashboard`.

2. **Remover import e arquivo não usados**
   - Remover `import Index from "./pages/Index.tsx"` em `src/App.tsx` (não é referenciado em nenhuma rota).
   - Deletar `src/pages/Index.tsx` e os componentes de landing que só ele usa, se não forem referenciados em outro lugar: `src/components/Navbar.tsx`, `Hero.tsx`, `Features.tsx`, `HowItWorks.tsx`, `CTA.tsx`, `Footer.tsx`. Verificar usos antes de remover cada um; manter os que forem usados em outros lugares.

3. **Sanidade**
   - Conferir que `AuthPanel` (usado em `/login` e `/register`) também redireciona para `/dashboard` se já houver usuário logado, para evitar que um usuário autenticado veja o formulário ao digitar `/login` manualmente. Se não fizer, adicionar o guard.

## Fora do escopo

- Mudanças visuais no `/login` ou `/dashboard`.
- Alterações em `ProtectedRoute` / `AuthContext`.
