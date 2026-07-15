## Diagnóstico

O banner "Revisão automática na fila…" fica ativo para sempre em toda minuta recém-gerada. Causa exata:

1. `supabase/functions/generate-legal-draft/index.ts` (linhas 923, 1061, 1098) grava `quality_status: "pending"` no `case_drafts` recém-criado.
2. `useGenerateDraft` (src/hooks/useCaseDrafts.ts) foi ajustado para **NÃO** disparar mais `review-legal-draft` automaticamente (comentário "Otimização de créditos: revisão sênior NÃO é mais disparada automaticamente").
3. Ninguém, portanto, promove `quality_status` de `pending` para `done`/`failed`.
4. `DraftDetailPage` (linhas 90–103, 300–301, 440–464) e `useCaseDraft` (linha 43) leem `quality_status`, mostram o banner com spinner "na fila…" e fazem polling a cada 5 s indefinidamente. Após 3 min o botão "Tentar novamente" aparece, mas o spinner e o refetch permanecem — o usuário vê como se estivesse eternamente processando.

Não é um job travado no worker — é apenas UI + status inicial desalinhado com a nova política de "revisão sob demanda".

## Correção proposta (2 arquivos, mudança mínima)

### 1. `supabase/functions/generate-legal-draft/index.ts`
Trocar as três ocorrências de `quality_status: "pending"` por `quality_status: "not_requested"`:
- linha 923 (insert do `case_drafts`)
- linha 1061 (metadata da telemetria)
- linha 1098 (response payload)

Com isso, minutas novas nascem em `not_requested`. O `ReviewStatusBanner` já trata esse valor (`if (!status || status === "not_requested") return null;` — linha 438) e não exibe nada até o usuário clicar em "Revisar como advogado sênior".

### 2. `supabase/functions/review-legal-draft/index.ts` (linhas 314–323)
Ampliar a guarda para aceitar `not_requested` além de `pending`/`failed`, para que o disparo manual continue funcionando:
- linha 314: `if (!["pending","failed","not_requested"].includes(draft.quality_status))`
- linha 323: `.in("quality_status", ["pending","failed","not_requested"])`

## Efeitos

- Minutas novas: sem banner falso, sem polling infinito, zero custo desnecessário.
- Botão manual de revisão continua funcionando (agora aceita `not_requested`).
- Minutas antigas travadas em `pending`: seguem exibindo o banner até que o usuário clique em "Tentar revisar novamente" — comportamento aceitável (podemos fazer um `UPDATE` de saneamento depois se desejar).
- Polling do `useCaseDraft` para automaticamente quando o status sai de `pending`/`running`.

## Fora do escopo

- Alterar UI/componentes React.
- Mexer em `senior-legal-review`, `apply-senior-review-to-draft`, worker de arquivos ou qualquer outro fluxo.
- Migrations SQL para "curar" minutas históricas (fica como opcional se você quiser depois).

## Verificação

- `bunx tsgo --noEmit` limpo.
- Testar gerando uma minuta nova: banner não aparece; ao clicar em "Revisar como advogado sênior" o fluxo dispara normalmente.
