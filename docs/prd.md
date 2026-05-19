# JurisTech AI Legal — Product Requirements Document (PRD)

## Goals and Background Context

### Goals

- Automatizar a criação de documentos jurídicos (petições, recursos, contratos) com embasamento em legislação brasileira e jurisprudência dos tribunais superiores e estaduais
- Oferecer sistema completo de gestão para escritórios de advocacia (clientes, processos, tarefas, financeiro)
- Integrar com tribunais brasileiros (STF, STJ, TST, TSE, STM, TJPE) e DJEN para captação de publicações
- Suportar modelo whitelabel para parceiros estratégicos remixarem via Lovable Cloud
- Oferecer escolha de provedores de IA (OpenAI, Gemini, Claude) por organização

### Background Context

Escritórios de advocacia brasileiros enfrentam alto volume de trabalho repetitivo na elaboração de peças jurídicas e na gestão administrativa. Soluções existentes (Aurum/Astrea, ADVBOX, Juridiq, Datajuri, Jusfy) oferecem gestão processual mas não integram IA generativa para criação de documentos embasados em jurisprudência real. O JurisTech AI Legal preenche essa lacuna unindo IA jurídica com gestão completa de escritório em uma plataforma moderna, whitelabel-ready, construída sobre Supabase e React.

O projeto já possui uma landing page funcional criada pelo Lovable (React + Vite + TypeScript + Tailwind + shadcn/ui). A estratégia é construir sobre essa base, mantendo compatibilidade com o ecossistema Lovable para futura publicação no Lovable Cloud.

### Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2026-03-17 | 1.0 | Initial PRD creation | Morgan (PM Agent) |

---

## Requirements

### Functional

- **FR1**: O sistema deve permitir login/registro com email e senha, com suporte a convite por admin da organização
- **FR2**: O sistema deve suportar 4 roles: Admin, Advogado, Secretária, Estagiário — cada um com permissões específicas
- **FR3**: O sistema deve permitir criar organizações (multi-tenant) com isolamento completo de dados via RLS
- **FR4**: O módulo de IA deve gerar petições iniciais, réplicas, alegações finais e intermediárias com embasamento legal
- **FR5**: O módulo de IA deve gerar recursos: embargos declaratórios, apelação, agravo de instrumento, agravo interno, REsp, RExt
- **FR6**: O módulo de IA deve gerar minutas de contratos, notificações extrajudiciais, ofícios e requerimentos
- **FR7**: Documentos gerados devem citar legislação brasileira e jurisprudência dos tribunais (STF, STJ, TST, TSE, STM, TJPE)
- **FR8**: O sistema deve suportar múltiplos provedores de IA (OpenAI, Gemini, Claude) com seleção por organização
- **FR9**: O sistema deve permitir edição dos documentos gerados em editor rich text antes de exportar
- **FR10**: O sistema deve exportar documentos em PDF
- **FR11**: O sistema deve cadastrar clientes com dados pessoais, documentos, histórico de atendimento
- **FR12**: O sistema deve permitir upload de documentos e mídias com armazenamento em nuvem (Supabase Storage)
- **FR13**: O sistema deve cadastrar processos judiciais com número, tribunal, vara, partes e status
- **FR14**: O sistema deve captar publicações do DJEN direcionadas aos advogados cadastrados
- **FR15**: O sistema deve permitir delegação de tarefas para colaboradores com acompanhamento de execução
- **FR16**: O sistema deve oferecer controle financeiro: receitas, despesas, emissão de boletos e DRE mensal
- ~~**FR17**: Integração com pagamento brasileiro — EXCLUÍDO DO MVP~~
- ~~**FR18**: Assinatura digital ICP-Brasil — EXCLUÍDO DO MVP~~
- **FR19**: O sistema deve enviar notificações por email e WhatsApp (prazos, publicações, lembretes)
- **FR20**: O sistema deve possuir dashboard com visão geral: processos ativos, tarefas pendentes, prazos próximos, resumo financeiro
- ~~**FR21**: Branding configurável whitelabel — EXCLUÍDO DO MVP~~
- **FR22**: O admin deve poder gerenciar usuários (convidar, remover, alterar roles)
- **FR23**: O sistema deve registrar log de uso de IA (provider, tokens, custo estimado) por organização

### Non Functional

- **NFR1**: A aplicação deve ser uma SPA React compatível com deploy na Vercel e futuramente no Lovable Cloud
- **NFR2**: O backend deve ser Supabase-only (Auth, PostgreSQL, Storage, Edge Functions, Realtime) — sem servidor customizado
- **NFR3**: Migrations SQL devem ser sequenciais, legíveis e compatíveis com Lovable Cloud import
- **NFR4**: API keys de LLM nunca devem ser expostas no frontend — chamadas sempre via Edge Functions
- **NFR5**: Todas as tabelas devem ter RLS com isolamento por organization_id (multi-tenant)
- **NFR6**: O sistema deve responder em < 2s para operações CRUD e < 30s para geração de documentos por IA
- ~~**NFR7**: 50 usuários simultâneos por organização — EXCLUÍDO DO MVP~~
- **NFR8**: A interface deve ser responsiva (desktop + tablet + mobile)
- **NFR9**: O código deve seguir TypeScript strict, com validação Zod em todas as entradas
- **NFR10**: Cobertura de testes mínima: 70% unit tests em hooks/utils, testes E2E nos happy paths
- **NFR11**: A arquitetura deve suportar feature flags por plano (free, pro, enterprise)
- **NFR12**: CSS Variables para theming — facilitar whitelabel sem recompilação

---

## User Interface Design Goals

### Overall UX Vision

Interface moderna, dark-mode por padrão (já implementado na landing page), com design profissional e sóbrio adequado ao mercado jurídico. Glassmorphism sutil, tipografia clara (Space Grotesk para headings, Inter para body). Transição suave da landing page pública para o app autenticado com sidebar de navegação.

### Key Interaction Paradigms

- **Dashboard-centric**: após login, usuário vê visão geral com métricas e ações rápidas
- **Wizard-style para IA**: geração de documentos em etapas (selecionar tipo → preencher dados → gerar → revisar → exportar)
- **Kanban para tarefas**: visualização de tarefas por status com drag-and-drop
- **Timeline para processos**: histórico processual em formato timeline vertical
- **Formulários inteligentes**: autocomplete, validação em tempo real, campos condicionais

### Core Screens and Views

1. **Landing Page** (existente) — marketing, funcionalidades, CTA
2. **Login / Registro** — autenticação com suporte a convite
3. **Dashboard** — visão geral: processos, tarefas, prazos, financeiro
4. **IA Jurídica — Novo Documento** — wizard de geração com seleção de tipo, provider, dados do caso
5. **IA Jurídica — Meus Documentos** — lista de documentos gerados com filtros
6. **IA Jurídica — Editor** — editor rich text para revisar/editar documento gerado
7. **Clientes — Lista** — tabela com busca, filtros, paginação
8. **Clientes — Detalhe** — perfil completo, documentos, processos vinculados, histórico
9. **Processos — Lista** — tabela com status, tribunal, advogado responsável
10. **Processos — Detalhe** — timeline, publicações, documentos, tarefas vinculadas
11. **Publicações DJEN** — feed de publicações captadas, marcação lido/não lido
12. **Tarefas** — quadro kanban + calendário
13. **Financeiro** — dashboard com gráficos, lista de receitas/despesas, DRE
14. **Configurações** — perfil, organização, branding, integrações, usuários

### Accessibility

WCAG AA — contraste adequado, navegação por teclado, labels em formulários.

### Branding

Design system existente: dark theme com cores primary (blue) e accent (cyan), fontes Space Grotesk/Inter. CSS variables via shadcn/ui permitem customização whitelabel por organização.

### Target Device and Platforms

Web Responsive (desktop-first com adaptação para tablet e mobile).

---

## Technical Assumptions

### Repository Structure

Monorepo — frontend React + migrations Supabase + Edge Functions no mesmo repositório.

### Service Architecture

Serverless (Supabase Edge Functions) — sem servidor backend dedicado. Toda lógica de negócio sensível (chamadas LLM, webhooks de pagamento, scraping de tribunais) roda em Edge Functions. Frontend se comunica diretamente com Supabase via SDK.

### Testing Requirements

- **Unit tests**: Vitest para hooks, utils, validators, AI provider abstraction
- **Component tests**: Testing Library para componentes críticos (formulários, editor)
- **E2E tests**: Playwright para happy paths (login → gerar documento → exportar)
- **Integration**: Edge Functions testadas com Supabase local

### Additional Technical Assumptions

- Supabase CLI para desenvolvimento local com migrations
- Vite 8 como bundler (já configurado)
- React Router DOM 6 para roteamento client-side (já configurado)
- TanStack React Query para cache e server state (já configurado)
- React Hook Form + Zod para formulários (já configurado)
- Recharts para gráficos financeiros (já instalado)
- Path alias `@/` para imports (já configurado)
- Edge Functions em TypeScript (Deno runtime)
- Supabase Realtime para publicações DJEN e notificações live

---

## Epic List

| # | Epic | Goal |
|---|------|------|
| 1 | **Auth & Multi-tenant Foundation** | Estabelecer autenticação, roles, organizações e layout base da aplicação autenticada |
| 2 | **IA Jurídica — Core Engine** | Implementar geração de documentos jurídicos com abstração multi-LLM e editor integrado |
| 3 | **IA Jurídica — Templates & Jurisprudência** | Criar templates especializados por tipo de peça e integrar busca de jurisprudência |
| 4 | **Gestão de Clientes** | CRUD completo de clientes com upload de documentos e histórico de atendimento |
| 5 | **Gestão Processual** | Cadastro de processos, timeline, e integração com captação de publicações DJEN |
| 6 | **Gestão de Tarefas** | Delegação, acompanhamento e visualização kanban/calendário de tarefas |
| 7 | **Financeiro** | Controle de receitas/despesas e DRE mensal |
| 8 | **Integrações Externas** | WhatsApp, email e busca em tribunais |

---

## Epic 1: Auth & Multi-tenant Foundation

**Goal:** Estabelecer a base de autenticação, sistema de roles, criação de organizações e layout principal da aplicação (sidebar, top bar, rotas protegidas). Ao final deste épico, usuários podem se registrar, fazer login, e navegar pelo shell do app autenticado.

### Story 1.1: Database Schema & Migrations Setup

> Como desenvolvedor,
> quero ter o schema base do banco de dados criado com migrations Supabase,
> para que todas as tabelas core estejam prontas para uso.

**Acceptance Criteria:**
1. Supabase CLI inicializado no projeto (`supabase/config.toml`)
2. Migration `00001_create_organizations.sql` cria tabela `organizations` com campos: id, name, slug, branding (jsonb), plan (enum), features_enabled (jsonb), llm_config (jsonb), created_at, updated_at
3. Migration `00002_create_profiles.sql` cria tabela `profiles` com campos: id (FK auth.users), organization_id (FK), role (enum: admin, lawyer, secretary, intern), full_name, oab_number, phone, avatar_url
4. Migration `00003_create_rls_base.sql` habilita RLS em ambas as tabelas com policy de isolamento por organization_id
5. Trigger `on_auth_user_created` cria perfil automaticamente ao registrar
6. Migrations rodam com sucesso em `supabase start && supabase db push`
7. Arquivo `.env.example` criado com variáveis necessárias

### Story 1.2: Authentication Flow

> Como usuário,
> quero fazer login e registro na plataforma,
> para acessar as funcionalidades do sistema.

**Acceptance Criteria:**
1. Página de Login com email/senha usando Supabase Auth
2. Página de Registro com nome, email, senha e criação automática de organização
3. Supabase client configurado em `src/lib/supabase.ts`
4. `AuthContext` com estado do usuário, perfil e organização
5. Hook `useAuth()` expondo login, logout, register, user, profile, organization
6. Componente `ProtectedRoute` que redireciona para `/login` se não autenticado
7. Rota `/login` e `/register` funcionais
8. Após login, redireciona para `/dashboard`

### Story 1.3: App Layout & Navigation

> Como usuário autenticado,
> quero ver um layout com sidebar e navegação,
> para acessar os módulos do sistema.

**Acceptance Criteria:**
1. Componente `AppLayout` com sidebar colapsável, top bar com avatar/nome e área de conteúdo
2. Sidebar com links para: Dashboard, IA Jurídica, Clientes, Processos, Tarefas, Financeiro, Configurações
3. Ícones Lucide para cada item do menu
4. Top bar com nome do usuário, role badge e botão de logout
5. Layout responsivo: sidebar collapsa em mobile (hamburger menu)
6. Rotas protegidas: `/dashboard`, `/ai/*`, `/clients/*`, `/cases/*`, `/tasks`, `/finance`, `/settings`
7. Página Dashboard com placeholder "Em construção" e mensagem de boas-vindas
8. Breadcrumb navigation funcional

### Story 1.4: User Management & Invites

> Como admin da organização,
> quero convidar e gerenciar usuários,
> para que minha equipe acesse o sistema com as permissões corretas.

**Acceptance Criteria:**
1. Página `/settings/users` listando membros da organização (nome, email, role, status)
2. Botão "Convidar" que envia email com magic link via Supabase Auth
3. Formulário de convite com campos: email, role (select)
4. Admin pode alterar role de qualquer membro (exceto ele próprio)
5. Admin pode remover membro da organização
6. Permissões: apenas role `admin` acessa esta página
7. RLS policy garante que listagem retorna apenas membros da mesma organização

---

## Epic 2: IA Jurídica — Core Engine

**Goal:** Implementar o módulo central de inteligência artificial jurídica com abstração multi-provider (OpenAI, Gemini, Claude), geração de documentos e editor integrado para revisão. Ao final, advogados podem gerar peças jurídicas básicas usando IA.

### Story 2.1: LLM Provider Abstraction Layer

> Como desenvolvedor,
> quero uma camada de abstração para provedores de LLM,
> para alternar entre OpenAI, Gemini e Claude sem alterar código de negócio.

**Acceptance Criteria:**
1. Interface TypeScript `LLMProvider` com métodos: `generateDocument()`, `chat()`, `getModels()`
2. Adaptadores implementados: `OpenAIProvider`, `GeminiProvider`, `ClaudeProvider`
3. Factory `createProvider(config)` que retorna o provider correto baseado na config da organização
4. Fallback automático: se provider principal falhar, tenta próximo na lista
5. Edge Function `ai-generate` que recebe prompt + provider config e retorna resposta
6. API keys armazenadas como Supabase Secrets (nunca no frontend)
7. Types exportados em `src/types/ai.ts`
8. Migration `00004_create_documents.sql` cria tabela `documents` (id, organization_id, case_id, client_id, type, title, content, llm_provider, llm_model, prompt_used, tokens_used, status, storage_path, created_at, created_by) com RLS
9. Migration `00005_create_ai_usage_log.sql` cria tabela `ai_usage_log` (id, organization_id, profile_id, provider, model, tokens_input, tokens_output, cost_estimated, document_id, prompt_summary, created_at) com RLS

### Story 2.2: Document Generation Flow

> Como advogado,
> quero gerar um documento jurídico informando tipo, dados do caso e fatos,
> para obter uma peça jurídica redigida pela IA.

**Acceptance Criteria:**
1. Página `/ai/new` com wizard de 3 etapas: Tipo → Dados → Resultado
2. Step 1: Seleção do tipo de documento (petição inicial, recurso, contrato, etc.)
3. Step 2: Formulário contextual com campos: partes envolvidas, fatos, fundamentação desejada, tribunal, vara
4. Step 3: Loading state → documento gerado exibido com formatação
5. Botão "Salvar rascunho" persiste no banco (tabela `documents`)
6. Botão "Editar" abre o editor (Story 2.3)
7. Registro de uso em `ai_usage_log` (provider, model, tokens, custo estimado)
8. Validação Zod em todos os inputs do formulário

### Story 2.3: Legal Document Editor

> Como advogado,
> quero editar o documento gerado em um editor rich text,
> para ajustar o conteúdo antes de finalizar.

**Acceptance Criteria:**
1. Editor rich text (TipTap ou Lexical) integrado na página `/ai/documents/:id/edit`
2. Toolbar com: negrito, itálico, sublinhado, listas, headings, alinhamento
3. Suporte a citações legais formatadas (blockquote estilizado)
4. Auto-save a cada 30s (salva no banco via React Query mutation)
5. Botão "Exportar PDF" gera PDF do documento
6. Status do documento: draft → review → approved
7. Versionamento simples: salva versão anterior antes de cada edição

### Story 2.4: My Documents List

> Como advogado,
> quero ver todos os documentos que gerei,
> para acessar, editar ou exportar qualquer peça jurídica.

**Acceptance Criteria:**
1. Página `/ai/documents` com tabela: título, tipo, status, data de criação, ações
2. Filtros por: tipo de documento, status, período
3. Busca por título ou conteúdo
4. Paginação (20 itens por página)
5. Ações: abrir, editar, exportar PDF, deletar
6. Badge de status com cores: draft (amarelo), review (azul), approved (verde)
7. Ordenação por data (mais recentes primeiro por padrão)

---

## Epic 3: IA Jurídica — Templates & Jurisprudência

**Goal:** Criar templates especializados para cada tipo de peça jurídica e integrar busca de jurisprudência nos tribunais brasileiros para embasar os documentos gerados.

### Story 3.1: Legal Document Templates

> Como advogado,
> quero que cada tipo de peça jurídica use um template especializado,
> para que os documentos gerados sigam a estrutura correta.

**Acceptance Criteria:**
1. Templates de prompt definidos em `src/lib/ai/templates/` para: petição inicial, réplica, alegações finais, embargos declaratórios, apelação, agravo de instrumento, agravo interno, REsp, RExt
2. Cada template inclui: estrutura do documento, seções obrigatórias, linguagem jurídica padrão
3. Templates incluem placeholder para jurisprudência e legislação
4. Seletor de template no wizard de geração (Story 2.2 step 1) com descrição de cada tipo
5. Template de contrato com cláusulas padrão configuráveis
6. Template de notificação extrajudicial com formato adequado

### Story 3.2: Jurisprudence Search Integration

> Como advogado,
> quero que a IA busque jurisprudência relevante nos tribunais brasileiros,
> para que meus documentos tenham embasamento em decisões reais.

**Acceptance Criteria:**
1. Edge Function `tribunal-search` que consulta APIs/sites dos tribunais (STF e STJ possuem APIs públicas REST; TJPE via web scraping como fallback)
2. Busca por palavras-chave em: STF, STJ e TJPE (prioridade alta). Começar por STF/STJ (APIs documentadas), TJPE como segunda fase
3. Resultados retornam: número do processo, ementa, data, tribunal, link
4. IA incorpora jurisprudência relevante no documento gerado automaticamente
5. Usuário pode adicionar/remover jurisprudências antes de finalizar
6. Cache de resultados por 24h para economia de requisições
7. Fallback graceful se tribunal estiver indisponível

### Story 3.3: AI Provider Settings

> Como admin,
> quero configurar qual provedor de IA minha organização usa,
> para controlar custos e escolher o modelo mais adequado.

**Acceptance Criteria:**
1. Seção em `/settings/integrations` para configuração de IA
2. Seletor de provider padrão: OpenAI, Gemini, Claude
3. Campo para API key do provider (salva encriptada no banco)
4. Seletor de modelo por provider (ex: gpt-4o, gpt-4o-mini, gemini-pro, claude-sonnet)
5. Teste de conexão: botão "Testar" que faz chamada simples e confirma
6. Exibição de uso mensal (tokens consumidos, custo estimado)
7. Limite de uso configurável por plano

---

## Epic 4: Gestão de Clientes

**Goal:** Implementar CRUD completo de clientes com upload de documentos, histórico de atendimento e vínculo com processos.

### Story 4.1: Client Database & CRUD

> Como secretária,
> quero cadastrar e gerenciar clientes do escritório,
> para manter um registro organizado de todas as pessoas atendidas.

**Acceptance Criteria:**
1. Migration `00004_create_clients.sql` cria tabela `clients` com RLS
2. Página `/clients` com tabela: nome, CPF/CNPJ, email, telefone, data cadastro
3. Botão "Novo Cliente" abre formulário com campos: nome completo, tipo documento (CPF/CNPJ), número, email, telefone, endereço (jsonb), notas
4. Validação de CPF/CNPJ no frontend (Zod)
5. Edição inline ou em modal
6. Soft delete (campo `deleted_at`)
7. Busca por nome, CPF/CNPJ ou email
8. Paginação e ordenação

### Story 4.2: Client Detail & History

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

---

## Epic 5: Gestão Processual

**Goal:** Permitir cadastro e acompanhamento de processos judiciais, com timeline de movimentações e captação automática de publicações do DJEN.

### Story 5.1: Case Management CRUD

> Como advogado,
> quero cadastrar e acompanhar processos judiciais,
> para gerenciar todos os casos do escritório em um só lugar.

**Acceptance Criteria:**
1. Migration `00005_create_cases.sql` cria tabela `cases` com RLS
2. Página `/cases` com tabela: número do processo, cliente, tribunal, vara, status, advogado responsável
3. Formulário de cadastro: número, tribunal (select), vara, assunto, parte contrária, cliente (select), advogado responsável (select)
4. Status do processo: ativo, arquivado, encerrado
5. Filtros por status, tribunal, advogado
6. Busca por número do processo ou nome do cliente

### Story 5.2: Case Detail & Timeline

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

### Story 5.3: DJEN Publication Capture

> Como advogado,
> quero receber automaticamente publicações do DJEN relevantes aos meus processos,
> para não perder prazos processuais.

**Acceptance Criteria:**
1. Migration `00006_create_publications.sql` cria tabela `publications` com RLS
2. Edge Function `djen-scraper` que busca publicações por nome do advogado
3. Cron job (Supabase pg_cron ou Edge Function schedulada) executando diariamente
4. Página `/cases/publications` com feed de publicações: data, conteúdo, processo vinculado, status lido/não lido
5. Notificação visual (badge no menu) quando há publicações não lidas
6. Vinculação automática publicação → processo quando número do processo é detectado

---

## Epic 6: Gestão de Tarefas

**Goal:** Implementar sistema de delegação e acompanhamento de tarefas para colaboradores do escritório.

### Story 6.1: Task Management System

> Como advogado,
> quero criar e delegar tarefas para minha equipe,
> para organizar o trabalho do escritório.

**Acceptance Criteria:**
1. Migration `00007_create_tasks.sql` cria tabela `tasks` com RLS
2. Página `/tasks` com visualização kanban (colunas: pendente, em andamento, concluída)
3. Criação de tarefa: título, descrição, prioridade (baixa/média/alta/urgente), prazo, responsável, processo vinculado (opcional)
4. Drag-and-drop entre colunas do kanban
5. Filtros por responsável, prioridade, prazo
6. Visualização alternativa: calendário (date-picker com tarefas por dia)
7. Notificação por Supabase Realtime quando tarefa é atribuída

---

## Epic 7: Financeiro

**Goal:** Implementar controle financeiro do escritório com receitas, despesas, DRE mensal e integração com gateway de pagamento.

### Story 7.1: Financial Management Core

> Como admin,
> quero controlar receitas e despesas do escritório,
> para ter visão clara da saúde financeira.

**Acceptance Criteria:**
1. Migration `00008_create_finances.sql` cria tabela `finances` com RLS
2. Página `/finance` com dashboard: receita total, despesa total, saldo, gráfico mensal (Recharts)
3. Abas: Receitas, Despesas, DRE
4. Formulário de lançamento: tipo (receita/despesa), categoria, valor, data vencimento, cliente (opcional), processo (opcional), notas
5. Marcação de pagamento recebido/efetuado com data
6. Filtros por período, categoria, status (pago/pendente)

### Story 7.2: DRE Report

> Como admin,
> quero gerar DRE mensal do escritório,
> para ter controle contábil.

**Acceptance Criteria:**
1. Seção DRE com tabela: receitas por categoria, despesas por categoria, resultado do período
2. Filtro por mês/ano
3. Exportação do DRE em PDF

---

## Epic 8: Integrações Externas

**Goal:** Integrar comunicação (WhatsApp, email), assinatura digital e busca avançada em tribunais.

### Story 8.1: Email & WhatsApp Notifications

> Como advogado,
> quero receber notificações por email e WhatsApp sobre prazos e publicações,
> para não perder compromissos importantes.

**Acceptance Criteria:**
1. Edge Function `email-notify` usando Resend para emails transacionais
2. Templates de email: publicação nova, prazo próximo, tarefa atribuída
3. Integração WhatsApp via Z-API ou Evolution API
4. Edge Function `whatsapp-notify` para envio de mensagens
5. Configuração de preferências de notificação por usuário (email, WhatsApp, ambos, nenhum)
6. Seção em `/settings/notifications` para configurar preferências

~~### Story 8.2: Digital Signature Integration — EXCLUÍDO DO MVP~~

---

## Checklist Results Report

*A ser executado após aprovação do PRD pelo @po.*

---

## Next Steps

### UX Expert Prompt

> @ux-design-expert: Revise o PRD em `docs/prd.md` e crie as especificações de UI/UX para os core screens definidos, focando no wizard de IA Jurídica (geração de documentos) e no layout do dashboard. O design system existente usa dark theme com glassmorphism, fontes Space Grotesk/Inter e components shadcn/ui.

### Architect Prompt

> @architect: O documento de arquitetura já foi criado em `docs/brownfield-architecture.md`. Revise o PRD em `docs/prd.md` para garantir que a arquitetura proposta atende todos os requisitos funcionais e não-funcionais. Foque na integração Supabase Edge Functions ↔ LLM providers e na estratégia de scraping de tribunais.

---

*Documento gerado por Morgan (PM Agent) — AIOX v2.1*
