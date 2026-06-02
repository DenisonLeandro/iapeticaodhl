# Correção: "Processo não encontrado ou erro ao carregar dados"

## Diagnóstico

Investiguei o processo informado e o problema é **um bug na query do detalhe do processo**, não permissão/RLS nem rota errada.

### Fatos confirmados

- **Processo existe** na tabela `public.cases`:
  - `id` (UUID): `9c035db9-faf4-40b4-9339-c0341c075e5f`
  - `case_number`: `0000777-55.2025.5.09.0673`
  - `organization_id`: `2a4a4b01-a471-4bb4-a7a7-65048db8983c` (mesma do usuário logado)
  - `client_id`: **NULL** (processo não foi vinculado a nenhum cliente no cadastro)
- **Rota está correta**: `CasesPage` navega para `/cases/{caseItem.id}` usando o UUID, e `CaseDetailPage` lê `:id` e chama `fetchCaseById(id)`. Não há mistura entre UUID e número CNJ.
- **RLS está OK**: a política `cases_org_isolation` permite SELECT para perfis da mesma `organization_id`, e a listagem em `/cases` funciona (o processo aparece na tabela).

### Causa raiz

`src/services/caseDetail.ts → fetchCaseById` usa join embutido do PostgREST com nomes de FKs **inexistentes / errados**:

```ts
.select(`
  *,
  client:profiles!cases_client_id_fkey(full_name),     // ❌ FK não existe; e client_id aponta para clients, não profiles
  lawyer:profiles!cases_assigned_to_fkey(full_name)    // ✅ FK existe, mas o join falha junto pelo erro acima
`)
```

Conferindo no banco, as únicas FKs em `cases` são `cases_assigned_to_fkey` (→ profiles) e `cases_organization_id_fkey` (→ organizations). **Não existe `cases_client_id_fkey`**, e `client_id` referencia conceitualmente a tabela `clients` (não `profiles`). Resultado: o PostgREST retorna erro de relacionamento, `fetchCaseById` joga exception, e a página cai no branch `caseError → "Processo não encontrado ou erro ao carregar dados."`.

A listagem (`src/services/cases.ts → fetchCases`) já evita o problema usando **split queries** contra `clients` e `profiles` — por isso a lista funciona e só o detalhe quebra. Esta é, inclusive, a convenção do projeto registrada em memória ("split-queries em vez de JOINs").

## Correção

Refatorar `fetchCaseById` para o mesmo padrão split-query usado em `fetchCases`:

1. Buscar a row de `cases` por `id` (sem joins embutidos).
2. Em paralelo, se `client_id` não for nulo, buscar `full_name` em `public.clients`.
3. Em paralelo, se `assigned_to` não for nulo, buscar `full_name` em `public.profiles`.
4. Montar o `CaseWithRelations` com `client_name` e `lawyer_name` preenchidos (ou `null` quando não houver vínculo).

Sem mudança de tipos, sem mudança de rota, sem migration, sem mexer em RLS.

### Arquivo alterado

- `src/services/caseDetail.ts` — apenas a função `fetchCaseById`. As demais funções (`fetchCaseMovements`, `fetchCaseDocuments`, `createMovement`) permanecem inalteradas.

## Checagens dos demais itens pedidos

- **Vínculo cliente / org**: o processo `0000777-...` está com `client_id = NULL`. Não é bug — foi cadastrado sem cliente. Após a correção, abrirá normalmente e mostrará "Não vinculado" no card de Cliente (comportamento já previsto em `CaseDetailPage`). Se você quiser vincular, basta editar o processo.
- **Select "Vincular a um processo" no upload**: continua filtrando por `client_id` do cliente atual. Como este processo está sem cliente, ele **não aparece** no select de nenhum cliente — comportamento correto. Para que apareça, edite o processo e vincule ao cliente desejado.
- **Botão "Cadastrar processo"** (vindo da aba Arquivos quando o cliente não tem processos): leva para `/cases` com modal aberto — fluxo correto, já validado na Fase 3.
- **Normalização CNJ**: a rota usa UUID, então não há necessidade de normalizar máscara.

## Não incluído nesta correção

- Fase 4 (integração com DocumentWizard / `ai-generate`) — segue bloqueada até este fix passar nos testes.
- Qualquer alteração em migrations, RLS, edge functions ou outros serviços.

## Como testar após implementação

1. Em `/cases`, clicar no processo `0000777-55.2025.5.09.0673` → deve abrir o detalhe sem erro, mostrando "Não vinculado" no card de Cliente.
2. Editar esse processo e vincular a um cliente → reabrir o detalhe → cliente deve aparecer.
3. Abrir um cliente que já tenha processos vinculados e confirmar que o select "Vincular a um processo" no upload continua listando-os.
4. Conferir console do navegador: sem erro de relationship/PGRST.
