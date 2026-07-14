# Diagnóstico

O botão "Abrir" em `/ai/documents` (DocumentsPage.tsx, linha 460) navega para:

```
/ai/documents/:id
```

Mas em `src/App.tsx` só existe a rota:

```
/ai/documents/:id/edit   → DocumentEditPage
```

Não há nenhuma rota registrada para `/ai/documents/:id` (sem `/edit`). Por isso o React Router cai no catch-all `*` e mostra o 404 "Page not found" — exatamente o erro registrado no console:

```
404 Error: User attempted to access non-existent route: /ai/documents/<uuid>
```

Ou seja: não é bug de backend, nem de dados, nem de permissão. É rota faltando no cliente.

O botão "Editar" (linha 468) funciona porque já aponta para `/edit`.

# Correção proposta (mínima, reversível, sem mexer em arquitetura)

Adicionar em `src/App.tsx` uma rota alias que renderiza o mesmo `DocumentEditPage` (que hoje já é a tela de visualização + edição do documento):

```tsx
<Route path="/ai/documents/:id" element={<DocumentEditPage />} />
<Route path="/ai/documents/:id/edit" element={<DocumentEditPage />} />
```

Assim:
- "Abrir" volta a funcionar e cai na mesma tela que "Editar" (comportamento esperado — o editor é a própria visualização do documento gerado).
- Nenhuma funcionalidade é removida.
- Nenhum fluxo de IA é alterado (mudança puramente de roteamento no frontend).
- Reversível em 1 linha.

# Validação

- Typecheck (`bunx tsgo --noEmit`).
- Abrir `/ai/documents`, clicar em "Abrir" em uma petição existente → deve carregar o editor sem 404.
- Clicar em "Editar" → continua funcionando (mesma tela).
- Nenhuma chamada de IA é disparada por essa navegação (a tela de edição não gera automaticamente).

# Fora de escopo

- Não criar uma nova página só-leitura separada.
- Não alterar `DocumentEditPage` nem hooks de documentos.
- Não mexer em nada relacionado às Fases 1/2 de otimização de IA.
