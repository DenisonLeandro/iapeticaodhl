# Epic 4: Gestão de Clientes

**Goal:** Implementar CRUD completo de clientes com upload de documentos, histórico de atendimento e vínculo com processos.

**FRs:** FR11, FR12
**NFRs:** NFR5, NFR8, NFR9

---

## Story 4.1: Client Database & CRUD

> Como secretária,
> quero cadastrar e gerenciar clientes do escritório,
> para manter um registro organizado de todas as pessoas atendidas.

**Acceptance Criteria:**
1. Migration `00006_create_clients.sql` cria tabela `clients` com RLS
2. Página `/clients` com tabela: nome, CPF/CNPJ, email, telefone, data cadastro
3. Botão "Novo Cliente" abre formulário com campos: nome completo, tipo documento (CPF/CNPJ), número, email, telefone, endereço (jsonb), notas
4. Validação de CPF/CNPJ no frontend (Zod)
5. Edição inline ou em modal
6. Soft delete (campo `deleted_at`)
7. Busca por nome, CPF/CNPJ ou email
8. Paginação e ordenação

---

## Story 4.2: Client Detail & History

> Como advogado,
> quero ver o perfil completo do cliente com histórico de atendimento,
> para ter contexto ao trabalhar em seus casos.

**Acceptance Criteria:**
1. Página `/clients/:id` com perfil completo do cliente
2. Seção "Processos" listando processos vinculados ao cliente
3. Seção "Documentos" listando documentos gerados para o cliente
4. Seção "Histórico" com registro de atendimentos (data, assunto, notas)
5. Formulário para adicionar novo registro de atendimento
6. Seção "Arquivos" com upload de documentos pessoais (RG, CPF, procuração)
7. Upload via Supabase Storage com preview de imagens/PDFs
