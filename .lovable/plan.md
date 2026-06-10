## Causa

O Supabase Storage rejeita chaves (paths) com caracteres não-ASCII (acentos como "Ordinário") e, em alguns casos, espaços/caracteres especiais — daí o erro `Invalid key`. O arquivo enviado tem nome `Recurso Ordinário - Amadelli X Luzia Oliveira Caetano.pdf`, e em `src/services/client-file.service.ts` o `storagePath` é montado concatenando o `file.name` cru:

```ts
const storagePath = `${organizationId}/${clientId}/${Date.now()}_${file.name}`;
```

Sem sanitização, o "í" e os espaços quebram o upload. O mesmo padrão é usado em outros lugares (ex.: análise de PDF, OCR), então a correção precisa ser centralizada.

## Solução

1. **Criar utilitário `src/lib/utils/sanitize-filename.ts`** com função `sanitizeStorageKey(name)` que:
   - Normaliza Unicode (`NFKD`) e remove diacríticos (acentos).
   - Substitui qualquer caractere fora de `[A-Za-z0-9._-]` por `_`.
   - Colapsa underscores repetidos e remove os de borda.
   - Garante extensão preservada e tamanho máximo razoável (ex.: 120 chars no nome base).
   - Se o resultado ficar vazio, usa fallback `file`.

2. **Aplicar em `src/services/client-file.service.ts`** dentro de `uploadFile`:
   - Usar o nome sanitizado apenas para o `storagePath`.
   - Manter o `file.name` original no campo `file_name` da tabela (para exibição ao usuário).

3. **Verificar outros uploads** que usam `client-documents` (ex.: `supabase/functions/process-pdf-analyze`, `ocr-extract`) — se gerarem chaves a partir de nomes de usuário, aplicar a mesma sanitização (provavelmente já recebem o path do front, então basta a correção no front).

4. **Sem alterações em DB/RLS.** Nenhuma migração necessária.

## Resultado esperado

- Upload do PDF `Recurso Ordinário - Amadelli X Luzia Oliveira Caetano.pdf` passa a funcionar.
- No banco continua aparecendo o nome original (com acentos) na listagem; apenas o caminho interno no Storage fica sanitizado (`Recurso_Ordinario_-_Amadelli_X_Luzia_Oliveira_Caetano.pdf`).
- Correção retroativa não é necessária — arquivos novos já entram corretos.
