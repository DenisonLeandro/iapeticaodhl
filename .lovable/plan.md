# Resolver tela em branco em Publicações Judiciais

## Diagnóstico

Auditando o código:

- **Backend OK**: tabela `publications` existe com RLS, edge function `djen-scraper` está deployada, e DJEN/DataJud configurados em `organizations.publication_config`.
- **Frontend AUSENTE**: não existe rota `/publications` em `src/App.tsx`, nem página, nem item de menu em `src/config/navigation.ts`, nem hook/serviço para consumir a tabela.
- **Resultado**: qualquer tentativa de acessar publicações (URL digitada, link de outra parte do app, etc.) cai em rota não mapeada → tela em branco / NotFound.

A Story 5.3 do PRD descreve exatamente esta página (`/cases/publications`) com feed, badge de não lidas e vinculação a processos — mas ela nunca foi implementada na UI.

## O que será construído

### 1. Serviço e hook
- `src/services/publications.ts`: `listPublications({ filter, page })`, `markAsRead(id)`, `markAllAsRead()`, `getUnreadCount()`, `triggerScraper()`.
- `src/hooks/usePublications.ts`: React Query — lista paginada, contagem de não-lidas, mutations de marcar como lida.

### 2. Página de Publicações
- `src/pages/publications/PublicationsPage.tsx` em `/publications`:
  - Feed em cards: data, fonte (DJEN/DataJud), trecho do conteúdo, processo vinculado (link para `/cases/:id`), badge "não lida".
  - Filtros: status (todas / não lidas / lidas), fonte, busca textual, intervalo de datas.
  - Ações: marcar como lida (individual e em massa), abrir processo vinculado, executar scraper manualmente (admin).
  - Renderização segura do `content` (texto puro com `whitespace-pre-wrap`, sem `dangerouslySetInnerHTML`) — evita o problema reportado de "HTML não renderiza".
  - Estado vazio amigável quando não há publicações + botão "Buscar publicações agora".

### 3. Detalhe de publicação
- Modal/Sheet ao clicar em uma publicação: conteúdo completo, metadata, botões "Marcar como lida", "Abrir processo", "Gerar petição com IA" (atalho ao wizard pré-preenchido).

### 4. Navegação e badge
- Adicionar item "Publicações" em `src/config/navigation.ts` (ícone `Bell`) com `showUnreadBadge: true`.
- Sidebar já suporta `showUnreadBadge` — alimentar com `useUnreadPublicationsCount`.
- Adicionar rota `/publications` em `src/App.tsx` dentro de `ProtectedRoute` + `AppLayout`.
- Manter compatibilidade com `/cases/publications` redirecionando para `/publications`.

### 5. Realtime (opcional, baixo custo)
- Subscription Supabase Realtime na tabela `publications` filtrada por `organization_id` para atualizar feed e badge ao vivo.

### 6. Robustez (causa-raiz da tela em branco)
- Wrap da página em `ErrorBoundary` local com fallback amigável.
- Catch-all route `*` já existe (`NotFound`) — garantir que qualquer link antigo para publicações não fique em branco.
- Validação defensiva: se `content` vier vazio/null, exibir placeholder em vez de quebrar render.

## Arquivos a criar/editar

```text
src/
  services/publications.ts                  (novo)
  hooks/usePublications.ts                  (novo)
  pages/publications/
    PublicationsPage.tsx                    (novo)
    PublicationDetailDialog.tsx             (novo)
  components/publications/
    PublicationCard.tsx                     (novo)
    PublicationFilters.tsx                  (novo)
  config/navigation.ts                      (editar — adicionar item)
  App.tsx                                   (editar — adicionar rota)
  types/publication.ts                      (novo)
```

## Critérios de aceite

1. Acessar `/publications` carrega a página sem tela em branco, mesmo sem dados.
2. Item "Publicações" aparece no sidebar com badge de não lidas.
3. Conteúdo da publicação é exibido corretamente (texto preservando quebras de linha) sem renderização perigosa de HTML.
4. Marcar como lida atualiza UI e badge instantaneamente.
5. Click em publicação com `case_id` navega para o processo correspondente.
6. Botão "Buscar publicações" chama edge function `djen-scraper` e atualiza feed.
7. Estado vazio e estados de erro têm fallback visual claro.

## Observações

- Não vou usar `dangerouslySetInnerHTML` para o `content` — o DJEN devolve texto cru, e foi exatamente esse tipo de tentativa que costuma gerar telas em branco quando o HTML está malformado. Se no futuro quisermos formatação rica, sanitizamos com DOMPurify.
- Story 5.3 será marcada como implementada após este passo.
