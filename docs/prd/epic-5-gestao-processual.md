# Epic 5: Gestão Processual

**Goal:** Permitir cadastro e acompanhamento de processos judiciais, com timeline de movimentações e captação automática de publicações do DJEN.

**FRs:** FR13, FR14
**NFRs:** NFR2, NFR5

---

## Story 5.1: Case Management CRUD

> Como advogado,
> quero cadastrar e acompanhar processos judiciais,
> para gerenciar todos os casos do escritório em um só lugar.

**Acceptance Criteria:**
1. Migration `00007_create_cases.sql` cria tabela `cases` com RLS
2. Página `/cases` com tabela: número do processo, cliente, tribunal, vara, status, advogado responsável
3. Formulário de cadastro: número, tribunal (select), vara, assunto, parte contrária, cliente (select), advogado responsável (select)
4. Status do processo: ativo, arquivado, encerrado
5. Filtros por status, tribunal, advogado
6. Busca por número do processo ou nome do cliente

---

## Story 5.2: Case Detail & Timeline

> Como advogado,
> quero ver a timeline de um processo com todas as movimentações,
> para acompanhar o andamento do caso.

**Acceptance Criteria:**
1. Página `/cases/:id` com informações completas do processo
2. Timeline vertical com movimentações (data, tipo, descrição)
3. Botão "Adicionar movimentação" para registro manual
4. Seção de documentos vinculados ao processo
5. Seção de tarefas vinculadas ao processo
6. Link rápido para gerar documento jurídico para este processo (abre wizard IA com dados pré-preenchidos)

---

## Story 5.3: DJEN Publication Capture

> Como advogado,
> quero receber automaticamente publicações do DJEN relevantes aos meus processos,
> para não perder prazos processuais.

**Acceptance Criteria:**
1. Migration `00008_create_publications.sql` cria tabela `publications` com RLS
2. Edge Function `djen-scraper` que busca publicações por nome do advogado
3. Cron job (Supabase pg_cron ou Edge Function schedulada) executando diariamente
4. Página `/cases/publications` com feed de publicações: data, conteúdo, processo vinculado, status lido/não lido
5. Notificação visual (badge no menu) quando há publicações não lidas
6. Vinculação automática publicação → processo quando número do processo é detectado
