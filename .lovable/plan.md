# Corrigir limite de upload de arquivos para 50 MB

## Causa raiz
- A validação client-side em `src/schemas/client.schema.ts` permite até **50 MB**.
- Porém o bucket `client-documents` no Storage está configurado com `file_size_limit = 10 MB`.
- Quando um arquivo entre 10 MB e 50 MB é enviado, o frontend aceita, mas o Storage rejeita com `The object exceeded the maximum allowed size` — exatamente o que aconteceu no PDF de 25,5 MB.

## Passos

1. **Migração no Storage**: atualizar o bucket `client-documents` elevando `file_size_limit` para **52428800** (50 MB), via migração SQL:
   ```sql
   update storage.buckets
   set file_size_limit = 52428800
   where id = 'client-documents';
   ```
2. **Validar** com nova query que o limite ficou em 50 MB.
3. **Sem alterações de código frontend** — o limite no schema já está correto em 50 MB e a mensagem ao usuário continua coerente.

## Observação sobre arquivos muito grandes (>50 MB)
Se no futuro vocês precisarem subir PDFs de processo acima de 50 MB (algo comum em autos integrais), o caminho recomendado é:
- Usar **upload resumable** (TUS) do Supabase Storage diretamente, que ignora o limite padrão de payload por requisição.
- Ou dividir o PDF em volumes.

Isso pode ser tratado em uma melhoria futura — não é necessário agora para resolver o erro reportado.
