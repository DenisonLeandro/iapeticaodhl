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
