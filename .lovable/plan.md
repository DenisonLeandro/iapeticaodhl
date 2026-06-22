# Plano — Encerrar PR-2 deste arquivo e preparar upload correto para PR-3

## Parte 1 — Aguardar pipeline do arquivo atual (PR-2 apenas)

**Arquivo em andamento:** `bd8c021a-fd5e-474e-ae71-1b366fcb2126` — `CÓPIA INTEGRAL - 0087002-71.2025.8.16.0014.pdf` (9,27 MB, `case_id=NULL`)

Vou apenas observar até `pipeline_stage` ficar `done` ou `failed` e devolver relatório resumido:

- `pipeline_stage` final + `pipeline_last_error`
- `extraction_model`, `page_count`
- Contagem `document_chunks` × `document_embeddings` (devem ser iguais)
- `classification`, `classification_confidence`, `classification_source`, `classification_version`, `classification_model`, `classification_at`
- Tempo total e por etapa via `processing_jobs`

Sem usar este arquivo para validar PR-3 (case_id NULL).

---

## Parte 2 — Como subir o próximo PDF garantindo `case_id`

Você está em `/clients/c976d064-…` (cliente **"teste pipeline"**).

### Caminho recomendado (mais seguro)

1. No menu lateral, clique em **Processos** (ou abra `/cases`).
2. Clique no processo desejado, por exemplo **`00010497420255090018`** (vara "Outro", trabalhista) — `id e4a578c0-d2cd-479b-916b-6121feaefe27`.
   - Os outros processos do mesmo cliente também servem (`74158d88…`, `e12334e2…`, `f70a1ba0…`).
3. Na página do processo, vá até a aba **Documentos**.
4. Clique em **Adicionar arquivo / Upload**. O `case_id` já vai pré-preenchido pelo contexto do processo.
5. Selecione o PDF (≤ 12 MB, texto nativo) e confirme.

### Caminho alternativo (pela tela do cliente)

1. Continue em `/clients/c976d064-…` na aba **Arquivos**.
2. Clique em **Enviar arquivo** para abrir o `FileUploadDialog`.
3. **Atenção obrigatória:** no campo **"Vincular todos a um processo (opcional)"** abra o `Select` e escolha um processo da lista (ex.: `00010497420255090018`). Não deixe em "Sem processo".
4. Selecione o PDF e confirme.

### Como confirmar que deu certo (eu faço)

Após o upload, eu executo:

```sql
SELECT id, file_name, case_id, pipeline_stage
FROM client_files
ORDER BY created_at DESC LIMIT 1;
```

`case_id` precisa estar **preenchido**. Se vier NULL de novo, abortamos e refazemos pelo caminho 1.

---

## Parte 3 — Após confirmação do `case_id`

Sigo o plano PR-3 aprovado (Etapas 1–7 + relatório consolidado), sem alterações de código/schema/RLS, sem backfill, sem fallback por `client_id`.

## Fora do escopo
- Sem UPDATE manual no arquivo atual.
- Sem alteração de código, schema, RLS, grants.
- Sem novo módulo.
- Sem mexer no PR-2 nem em PDFs > 15 MB.

## Próximo passo
Aprovar este plano → eu monitoro o arquivo atual até concluir e devolvo o relatório PR-2 → você faz o novo upload pelo caminho indicado → eu disparo a validação PR-3.