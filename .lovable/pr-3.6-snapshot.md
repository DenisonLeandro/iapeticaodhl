# PR-3.6 — Snapshot pré-implementação (Onda 1)

Data: 2026-06-23

## Última migration antes da Onda 1
- `20260622201311_b9fb01ef-f422-4900-bab9-bf6fafe180a5.sql` (split + parent_file_id + aggregate trigger)

## Arquivos que serão modificados (hashes atuais)

```
cad5761adfbea3195a3e7cb3eadfdfe791a94120d8a83a48b48e2a1d5f0ff22a  supabase/functions/process-document-worker/index.ts
1549e61246bffc5e73244322456a305796eeec4a4386ddf6c583aff0afbbac3c  supabase/functions/embed-document-chunks/index.ts
```

(Onda 2, se aprovada, modificará também: extract-document-text, chunk-document, classify-document, enqueue-file-processing — hashes registrados no checkpoint.)

## Estado da fila no momento do snapshot — PDF THAURUS (38.175.928 bytes, 7 partes)

| Parte | Tamanho | pipeline_stage | chunks | embeddings | Job status | Erro |
|---|---|---|---|---|---|---|
| 1 | 11.5 MB | failed | 0 | 0 | failed 3/3 | 504 IDLE_TIMEOUT (extract) |
| 2 | 2.6 MB  | done   | 441 | 441 | done | — |
| 3 | 7.1 MB  | done   | 401 | 401 | done | — |
| 4 | 4.6 MB  | done   | 383 | 383 | done | — |
| 5 | 2.8 MB  | failed | 0 | 0 | failed 3/3 | 546 WORKER_RESOURCE_LIMIT (extract) |
| 6 | 6.5 MB  | done   | 362 | 362 | done | — |
| 7 | 10.7 MB | extracting | 0 | 0 | **running 2/3 (órfão desde 20:35)** | — |

Pai (`aedd009c…`): `pipeline_stage=extracting` (preso porque parte 7 nunca finalizou).

## Rollback documentado

### Onda 1
1. Reverter `supabase/functions/process-document-worker/index.ts` ao hash `cad5761a…` (Git history / chat history).
2. Reverter `supabase/functions/embed-document-chunks/index.ts` ao hash `1549e612…`.
3. Desabilitar cron:
   ```sql
   select cron.unschedule('pipeline-reaper');
   ```
4. Migration de reversão (idempotente):
   ```sql
   drop function if exists public.reap_orphan_processing_jobs(int);
   drop function if exists public.reconcile_pipeline_stages();
   alter table public.processing_jobs drop column if exists heartbeat_at;
   ```

Nenhuma alteração em RLS, em `client_files`, em `document_chunks`, em `document_embeddings`, em `case_chat*`, em `match_case_chunks`. Reversão não corrompe dados.

### Onda 2 (se executada)
Reverter as 4 edge functions adicionais aos hashes registrados no checkpoint pós-Onda 1. Handler `full` continua suportado no worker durante toda a Onda 2 → jobs em voo nunca quebram.

---

# Onda 2 — Implementada (2026-06-23)

## Mudanças aplicadas

### Split (cliente — `src/lib/pdf/split-large-pdf.ts`)
- `SPLIT_THRESHOLD_BYTES`: 7 MB → **5 MB**
- `PART_TARGET_BYTES`: 6 MB → **4 MB**
- Resultado esperado: 100% das partes ≤ 5 MB → todas processadas via pdfjs (limite 8 MB),
  multimodal fallback nunca acionado em uploads novos.

### Idempotência por etapa (edge functions)
- `extract-document-text`: skip se já existe `extracted_text` na versão corrente.
- `chunk-document`: skip se já existem chunks na `chunking_version`.
- `classify-document`: skip se já existe `classification` na `classification_version`.
- `embed-document-chunks`: já tinha early-return na Onda 1.

### Jobs encadeados (`process-document-worker` + `enqueue-file-processing`)
- Default de `enqueue-file-processing` mudou de `full` → `extract`.
- Worker agora encadeia: `extract` → enfileira `chunk` → enfileira `classify` → enfileira `embed`.
- Cada etapa = job independente → CPU/memória isolados → fim do `WORKER_RESOURCE_LIMIT` em pipelines longos.
- Handler `full` preservado para jobs em voo da Onda 1 — zero quebra.

## Hashes pós-Onda 2

```
7462e95694adb34b19f2aeb5a712d33e003f1775d69da2a1df7744747ebb4d34  supabase/functions/extract-document-text/index.ts
b46c398425f66de2c74f9202d1a33a5e6c98631e5016d5fd7742bf8910114624  supabase/functions/chunk-document/index.ts
41d23b757c96d59d916fb54c4a2daaeb250a4273a17887c5d97193a6f75427d9  supabase/functions/classify-document/index.ts
af908255ae1c2d98aa439321dc4dd2a87fd0f197c2de811290296af441eef0bf  supabase/functions/process-document-worker/index.ts
d00a086c2a2e540f0b06c03a498eeed60542c96729314d1804eae0d7cff05a0e  supabase/functions/enqueue-file-processing/index.ts
96b249c4fc7628ffe4057a734dbba16beb5394e3f5f6fe38cf7b5a3d9aa317fd  src/lib/pdf/split-large-pdf.ts
```

## Rollback Onda 2
1. Reverter os 6 arquivos acima aos hashes pós-Onda 1 (Git history).
2. Nenhuma migration nova, nenhuma alteração de schema/RLS — rollback é puramente de código.
3. Jobs em voo continuam funcionando: handler `full` segue suportado no worker.

## Status PR-3.6
**Implementado. Aguardando validação funcional final** (regra 3 das ressalvas):
- O THAURUS atual foi gerado com o split antigo (partes de 11.5 MB / 10.7 MB) — essas continuarão falhando.
- Para validar end-to-end é necessário **re-upload do PDF THAURUS** pela UI, que então usará o novo split de 4 MB.
