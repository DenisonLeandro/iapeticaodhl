
## Diagnóstico do que existe hoje

**1. No cadastro/edição de Processo (`CaseForm.tsx`)**
- O schema já tem `client_id` opcional e o serviço `createCase/updateCase` já persiste o campo.
- **Mas o formulário NÃO renderiza nenhum campo "Cliente"** — só existe no `defaultValues`. Por isso o processo `0000777-…` ficou com `client_id = NULL`: não há como escolher cliente ao criar/editar.

**2. Na página de detalhe do Processo (`CaseDetailPage.tsx`)**
- Existe um card "Cliente" que mostra "Não vinculado" quando nulo, mas **sem CTA** para vincular.

**3. Na página do Cliente (`ClientDetailPage.tsx`)**
- Existe aba "Processos" (`ClientCasesSection.tsx`) que lista `cases` por `client_id`.
- **Mas não há botão para vincular processo existente nem para criar processo já vinculado.** O link "abrir" também vai para `/cases` (lista) em vez de `/cases/{id}`.

**4. No upload de arquivo (`FileUploadDialog.tsx`)**
- Já lista processos do cliente; quando não há, mostra CTA "Cadastrar processo". OK — só precisa garantir que o novo fluxo apareça.

**Conclusão:** o vínculo existe no banco e no serviço, mas a UI não expõe. Nenhuma migration é necessária.

## Arquivos a alterar

- `src/components/cases/CaseForm.tsx` — adicionar campo **Cliente vinculado** (combobox pesquisável com opção "Sem cliente"), reusando `useClients`.
- `src/pages/cases/CaseDetailPage.tsx` — quando `client_id` for null, exibir alerta destacado "Este processo ainda não está vinculado a nenhum cliente…" com botão **Vincular cliente** que abre o `CaseForm` em modo edição. Quando vinculado, transformar o nome do cliente em link para `/clients/{id}`.
- `src/components/clients/ClientCasesSection.tsx` — cabeçalho com dois botões: **Cadastrar novo processo** (abre `CaseForm` com `client_id` pré-preenchido) e **Vincular processo existente** (abre novo diálogo). Empty state com mensagem amigável. Itens da lista linkam para `/cases/{id}`.
- `src/components/cases/CaseForm.tsx` — aceitar prop opcional `defaultClientId` para pré-vincular ao abrir pela página do cliente.
- **Novo:** `src/components/clients/LinkExistingCaseDialog.tsx` — diálogo que lista processos da organização **sem `client_id`** (combobox pesquisável por número/assunto) e faz `updateCase({ client_id })`.
- `src/services/cases.ts` — adicionar `fetchUnlinkedCases(organizationId)` para alimentar o diálogo acima.
- `src/hooks/useCases.ts` — pequeno hook `useUnlinkedCases()` + invalidação adequada de `client-cases` e `cases` após link/unlink.

## Detalhes técnicos

- **Combobox de cliente** no `CaseForm`: usar `Command` + `Popover` do shadcn (já presentes via `cmdk`). Itens carregados via `useClients({ pageSize: 50, search })` com busca server-side (já suportado). Incluir item fixo "— Sem cliente —" que envia `client_id = ""`.
- **Botão "Vincular cliente"** no `CaseDetailPage`: usa o `CaseForm` já existente em modo edição (não precisa criar mini-form separado).
- **`LinkExistingCaseDialog`**: SELECT em `cases` com `organization_id = X AND client_id IS NULL`, ordenado por `created_at desc`, com busca por `case_number`. Confirmação → `updateCase(caseId, { client_id: clientId })` → invalidar `["client-cases", clientId]` e `["cases"]`.
- **Avisos (Alert do shadcn)**:
  - Processo sem cliente (detalhe): variante destrutiva/aviso no topo, com CTA.
  - Cliente sem processos (aba Processos): empty state já existente, atualizado com os 2 CTAs.
- **Links**:
  - `ClientCasesSection` → trocar `<Link to="/cases">` por `<Link to={\`/cases/${c.id}\`}>`.
  - `CaseDetailPage` → cliente vira `<Link to={\`/clients/${client_id}\`}>` quando vinculado.

Nenhuma alteração de RLS, schema, edge functions, wizard ou `ai-generate`.

## Fluxo recomendado para o usuário

```
Pelo PROCESSO
  /cases → abrir processo → card "Cliente"
    sem cliente: Alert + botão "Vincular cliente" → CaseForm (edit) → escolhe no combobox → salvar
    com cliente: nome clicável → vai para /clients/{id}

Pelo CLIENTE
  /clients/{id} → aba Processos
    botão "Cadastrar novo processo"   → CaseForm com client_id pré-preenchido
    botão "Vincular processo existente" → LinkExistingCaseDialog → escolhe processo órfão → confirma
    lista de processos vinculados → cada item linka /cases/{id}

Pelo UPLOAD de arquivo (já existe)
  aba Arquivos → "Anexar arquivo" → select de processos do cliente
    se vazio: CTA "Cadastrar processo para este cliente" (já funciona)
```

## Como testar depois

1. Abrir o processo órfão `0000777-…` → ver alerta + botão "Vincular cliente" → vincular a um cliente existente → recarregar e conferir nome no card e link funcionando.
2. Em `/clients/{id}` → aba Processos → o processo recém-vinculado aparece e o link abre o detalhe correto.
3. Criar novo processo pelo botão dentro do cliente → confirmar que `client_id` já vem preenchido (não editável ou pré-selecionado).
4. Em outro cliente, usar "Vincular processo existente" para anexar outro processo órfão; confirmar que ele some da lista de órfãos.
5. Editar processo já vinculado e trocar para outro cliente; confirmar que sai do cliente A e aparece no cliente B.
6. Cliente novo (sem processo) → ver mensagem amigável com os 2 CTAs.
7. Subir PDF na aba Arquivos do cliente que agora tem processo → o select "Vincular a um processo" lista o processo corretamente.
