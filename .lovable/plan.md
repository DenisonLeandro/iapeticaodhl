# PR-1 — Relatório de Infraestrutura · Fase 1 (Processo Inteligente)

> Aprovação solicitada antes do PR-2.

## ✅ O que foi implementado

PR exclusivamente de **infraestrutura**. Nenhuma UI nova, nenhum chat, nenhum resumo executivo gerado. Apenas a fundação para os próximos PRs.

---

## 1. Extensão habilitada

- `pgvector` (versão atual do projeto). Habilitada via `CREATE EXTENSION IF NOT EXISTS vector` no schema `public` (warning conhecido — manteremos por compatibilidade com o padrão Supabase).

## 2. Tabelas criadas (2)

### `public.case_chat_messages` — Chat Jurídico por Processo
| Coluna | Tipo | Observação |
|---|---|---|
| `id` | uuid PK | |
| `organization_id` | uuid FK→organizations | isolamento multi-tenant |
| `case_id` | uuid FK→cases | |
| `role` | text | `user` / `assistant` / `system` |
| `content` | text | corpo da mensagem |
| `message_kind` | text | `general` / `thesis` / `strategy` / `risk` / `missing_document` / `lawyer_note` / `citation` |
| `is_pinned` | bool default false | **mensagens fixadas sobrevivem a resumos de contexto** |
| `metadata` | jsonb | citações, tokens, modelo usado, etc. |
| `created_by` | uuid FK→auth.users | autor |
| `created_at` | timestamptz | |

### `public.document_embeddings` — RAG
| Coluna | Tipo | Observação |
|---|---|---|
| `id` | uuid PK | |
| `organization_id` | uuid FK | |
| `case_id` | uuid FK→cases | |
| `file_id` | uuid FK→client_files | |
| `source_kind` | text | `pdf` (default) · `audio_transcript` (futuro) · `library` (futuro) · `note` · `other` |
| `chunk_index` | int | ordem do chunk no documento |
| `page_from`, `page_to` | int | referência exata para citações |
| `content` | text | trecho original |
| `content_hash` | text | dedupe de embeddings |
| `embedding` | **vector(1536)** | ver §“Limitação técnica do HNSW” |
| `token_count` | int | custo |
| `model_version` | text | suporta troca de modelo no futuro |
| `metadata` | jsonb | |
| `created_at` | timestamptz | |

## 3. Colunas adicionadas (reaproveitamento — sem tabelas paralelas)

### `client_files`
- `parent_file_id` — chunks de PDFs grandes
- `page_count`, `page_from`, `page_to`
- `classification`, `classification_confidence`, `classification_source` (`auto`|`manual`)
- `media_type` (`pdf` default; aceita `audio`, `audio_transcript`, `image`, `text`, `other`)
- `content_hash` — dedupe
- **Status granular** (CHECK constraint atualizada, mantém os antigos): `pending`, `processing`, `analyzed`, `error`, `uploaded`, `extracting`, `classifying`, `analyzing`, `embedding`, `completed`, `failed`

### `cases`
- `executive_summary jsonb`
- `executive_summary_updated_at timestamptz`
- `executive_summary_version int default 0`

### `documents` (preparação futura — sem efeito hoje)
- `is_approved_template bool default false`
- `approved_at timestamptz`
- `approved_by uuid FK→profiles`
- `approval_notes text`

## 4. Índices criados

- `idx_client_files_parent_file`
- `idx_client_files_processing_status` (org + status)
- `idx_client_files_content_hash` (parcial)
- `idx_documents_approved_template` (parcial)
- `idx_case_chat_messages_case` (case + tempo)
- `idx_case_chat_messages_pinned` (parcial — só fixadas)
- `idx_case_chat_messages_org`
- `idx_document_embeddings_case` / `_file` / `_org`
- `idx_document_embeddings_hash` (parcial)
- `idx_document_embeddings_vec` — **HNSW cosine** para busca semântica

## 5. Função SQL criada

`match_case_chunks(p_case_id uuid, p_query_embedding vector(1536), p_match_count int default 8)` — retorna top-K trechos mais similares, **restritos ao processo informado e à organização do usuário autenticado** (SECURITY DEFINER + filtro por `get_my_organization_id()`).

## 6. Políticas RLS criadas

Padrão idêntico ao já usado em `client_files` / `cases`:

- `case_chat_messages`: SELECT/INSERT/UPDATE/DELETE → `organization_id = get_my_organization_id()`
- `document_embeddings`: SELECT/INSERT/UPDATE/DELETE → mesma regra
- GRANTs concedidos a `authenticated` e `service_role` (PostgREST exige).

## 7. Helper de feature flags (SaaS modular)

Arquivo `src/lib/features.ts`:

- `hasFeature(organizationId, key)` — hoje retorna `true` para tudo.
- Keys já reservadas: `module.case_chat`, `module.rag`, `module.executive_summary`, `module.huge_files`, `module.senior_review`, `module.firm_library`, `module.audio_ingestion`.
- `getUploadLimitBytes(orgId)` — devolve 200 MB ou 500 MB conforme `module.huge_files`.

Na Fase 8 basta substituir o stub pela consulta à tabela `entitlements`.

---

## ⚠️ Bucket de Storage — ação pendente

A tentativa de elevar `storage.buckets.file_size_limit` para 200 MB foi **bloqueada pela política do Lovable Cloud** (`bucket_sql_blocked`). Ferramentas atuais (`storage_update_bucket`) só alternam público/privado; não expõem `file_size_limit`.

**Limite atual do bucket: 50 MB** (configurado no PR anterior).

**Como resolver:**
- Abrir solicitação ao suporte do Lovable Cloud pedindo elevar `file_size_limit` do bucket `client-documents` para `209715200` (200 MB).
- Após a elevação, a flag `module.huge_files` na aplicação destrava até 500 MB no front, mas o bucket também precisará chegar a `524288000` (500 MB) para aceitar upload direto.

Até essa ação, os limites efetivos serão:
| Limite teórico (aplicação) | Limite real (bucket) |
|---|---|
| 200 MB default | **50 MB** — bloqueia |
| 500 MB com flag | **50 MB** — bloqueia |

Já temos o helper `getUploadLimitBytes()` no código pronto para subir automaticamente assim que o bucket for elevado.

---

## Como funcionará o limite de 200 MB (após elevação do bucket)

1. Upload feito **direto Browser → Storage** via SDK Supabase (resumable nativo); binário **nunca passa pela edge function**.
2. Front valida tamanho com `getUploadLimitBytes(organizationId)` antes de iniciar.
3. Bucket rejeita acima de 200 MB (camada definitiva de segurança).
4. Após upload, INSERT em `client_files` com `processing_status = 'uploaded'` dispara a pipeline assíncrona (a ser implementada no PR-2).

## Como funcionará o limite de 500 MB (após elevação do bucket)

1. Habilitar `module.huge_files` para a organização (na Fase 8 será uma row em `entitlements`; hoje basta editar o stub em `src/lib/features.ts`).
2. `getUploadLimitBytes()` retornará 500 MB automaticamente.
3. Bucket precisa estar em 500 MB também.

## Como ativar/desativar `module.huge_files`

Hoje (stub): editar `src/lib/features.ts` e devolver `key === "module.huge_files" ? false : true` para a organização desejada.
Fase 8: `INSERT INTO entitlements (organization_id, feature_key, enabled) VALUES (...)`.

---

## Como testar uploads (após elevação do bucket)

| Tamanho | Cenário esperado |
|---|---|
| 100 MB | ✅ Aceito sem flag. Sobe direto ao Storage. Status `uploaded` em `client_files`. |
| 200 MB | ✅ Aceito sem flag. Mesmo fluxo. |
| 500 MB | ⚠️ Requer (a) bucket elevado a 500 MB e (b) `module.huge_files = true`. |

Hoje, sem a elevação: qualquer arquivo > 50 MB será rejeitado pelo Storage com `payload too large`.

---

## Riscos encontrados

| Risco | Mitigação |
|---|---|
| **Limite 3072→1536 do HNSW** | O índice HNSW do pgvector aceita no máx **2000 dims**. Usaremos `gemini-embedding-001` com parâmetro `dimensions: 1536` (suportado nativamente; perda de qualidade desprezível em RAG de PDFs). Coluna criada como `vector(1536)`. |
| **`UPDATE storage.buckets` bloqueado** | Documentado acima — aguarda intervenção do suporte. |
| **Warnings do linter (SECURITY DEFINER)** | A função `match_case_chunks` precisa ser SECURITY DEFINER para chamar `get_my_organization_id()`. Padrão já adotado por outras funções do projeto. |
| **Pre-existing warning "Extension in Public"** | Padrão do Supabase para `vector`. Não-blocante. |

## Limitações conhecidas

- Bucket `client-documents` ainda em **50 MB** até suporte agir.
- Embeddings de 1536 dims (vs 3072 que era o default). Suficiente para RAG jurídico.
- Nenhuma UI nova entregue — esperado, é PR de infra.

---

## ✅ Reaproveitamento confirmado

- **Reaproveitadas (sem duplicar):** `clients`, `cases`, `client_files`, `documents`, `document_versions`, `document_chat_messages`, `organizations`, `profiles`, `case_movements`, `ai_usage_log`.
- **Tabelas paralelas evitadas:** `process_files`, `file_extractions`, `file_analyses`, `legal_documents`.
- **Edge functions criadas/alteradas:** **nenhuma** neste PR.

---

## ▶️ Próximo PR recomendado — PR-2

**Pipeline assíncrono de extração + chunking por página em `client_files`.**

Escopo do PR-2:
1. Evoluir edge `process-pdf-analyze` para:
   - aceitar `file_id` (binário nunca passa);
   - quebrar PDF em chunks por página (10 páginas por chunk), persistindo cada chunk como `client_files` filho (`parent_file_id`, `page_from/to`);
   - mover status: `uploaded → splitting → extracting → completed`/`failed`;
   - usar `EdgeRuntime.waitUntil` para não bloquear o request.
2. Polling no front (`useCaseDocuments`) com `refetchInterval` enquanto houver arquivo fora de `completed`/`failed`.
3. Component `FileProcessingStatusBadge` mostrando o estado granular.

Sem chat, sem embedding ainda — isso vem nos PR-3 / PR-5.

---

**Aguardando aprovação para iniciar o PR-2.**
