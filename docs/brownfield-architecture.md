# JurisTech AI Legal — Brownfield Architecture Document

## Introduction

Este documento captura o **estado atual** do codebase JurisTech AI Legal e define a **arquitetura alvo** para transformar a landing page existente (criada pelo Lovable) em um ecossistema digital completo para escritórios de advocacia.

### Document Scope

Focado na transformação completa: de landing page → plataforma SaaS jurídica com IA multi-provider, gestão de escritório e modelo whitelabel para parceiros.

### Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2026-03-17 | 1.0 | Initial brownfield analysis | Aria (Architect) |

---

## Quick Reference — Key Files and Entry Points

### Current Critical Files

- **Main Entry**: `src/main.tsx`
- **App Router**: `src/App.tsx` (React Router DOM)
- **Landing Page**: `src/pages/Index.tsx`
- **Components**: `src/components/` (Hero, Navbar, Features, CTA, Footer)
- **UI Library**: `src/components/ui/` (60+ shadcn/ui components)
- **Styles**: `src/index.css` (Tailwind + custom animations + CSS variables)
- **Design Tokens**: `tailwind.config.ts` (cores, fontes, animações)
- **Build**: `vite.config.ts` (dev server :8080)

### Enhancement Impact Areas

Todo o sistema precisa ser construído. O impacto é na **adição** de novos módulos, não na modificação dos existentes. A landing page permanece como está.

---

## High Level Architecture

### Technical Summary

| Aspecto | Decisão |
|---------|---------|
| **Frontend** | React 18 + TypeScript + Vite + Tailwind + shadcn/ui (já existe) |
| **Backend** | Supabase (PostgreSQL + Edge Functions + Auth + Storage + Realtime) |
| **IA** | Multi-provider: OpenAI, Google Gemini, Anthropic Claude (abstração de provider) |
| **Hospedagem** | Vercel (frontend) + Supabase Cloud (backend) → futuramente VPS |
| **Distribuição** | Lovable Cloud para parceiros (whitelabel/remix) |

### Actual Tech Stack (Existente)

| Category | Technology | Version | Notes |
|----------|------------|---------|-------|
| Runtime | Node.js | 18+ | Via Vite |
| Framework | React | 18.3.1 | SPA com React Router DOM 6.30 |
| Language | TypeScript | 5.8.3 | strict: false |
| Bundler | Vite | 8.0.0 | Dev server :8080 |
| CSS | Tailwind CSS | 3.4.17 | Dark mode class-based |
| Components | shadcn/ui + Radix UI | Latest | 60+ componentes |
| Forms | React Hook Form + Zod | 7.61 / 3.25 | Validação schema-based |
| State | TanStack React Query | 5.83.0 | Server state management |
| Charts | Recharts | 2.15.4 | Para dashboards futuros |
| Icons | Lucide React | 0.462.0 | — |
| Toasts | Sonner | 1.7.4 | — |
| Testing | Vitest + Playwright | 4.1 / 1.57 | Unit + E2E |
| Linting | ESLint + TS-ESLint | 9.32 / 8.38 | — |

### Tech Stack a Adicionar

| Category | Technology | Purpose |
|----------|------------|---------|
| Backend/BaaS | Supabase | Auth, DB, Storage, Edge Functions, Realtime |
| Supabase Client | @supabase/supabase-js | Client SDK |
| IA - OpenAI | openai | GPT-4o / GPT-4o-mini |
| IA - Google | @google/generative-ai | Gemini Pro / Flash |
| IA - Anthropic | @anthropic-ai/sdk | Claude Sonnet / Opus |
| PDF | @react-pdf/renderer ou jsPDF | Geração de documentos jurídicos |
| Editor | TipTap ou Lexical | Editor rich text para petições |
| WhatsApp | Evolution API ou Z-API | Integração WhatsApp Business |
| Pagamentos | Stripe ou Asaas | Boletos + cartão (Brasil) |
| Assinatura Digital | Clicksign ou D4Sign | Assinatura eletrônica ICP-Brasil |
| Email | Resend ou SendGrid | Notificações transacionais |
| Storage | Supabase Storage | Upload docs/mídias (alt: Google Drive/OneDrive API) |

---

## Architecture Overview

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                        FRONTEND (Vercel)                     │
│  React 18 + TypeScript + Tailwind + shadcn/ui                │
│                                                              │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌───────────────┐   │
│  │ Landing  │ │   Auth   │ │Dashboard │ │  IA Jurídica  │   │
│  │  Page    │ │  Pages   │ │  Layout  │ │   Module      │   │
│  └──────────┘ └──────────┘ └──────────┘ └───────────────┘   │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌───────────────┐   │
│  │ Clientes │ │Processos │ │ Tarefas  │ │  Financeiro   │   │
│  │  Module  │ │  Module  │ │  Module  │ │   Module      │   │
│  └──────────┘ └──────────┘ └──────────┘ └───────────────┘   │
└──────────────────────┬──────────────────────────────────────┘
                       │ Supabase Client SDK
┌──────────────────────┴──────────────────────────────────────┐
│                    SUPABASE CLOUD                             │
│                                                              │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌───────────────┐   │
│  │   Auth   │ │PostgreSQL│ │ Storage  │ │  Edge         │   │
│  │  (GoTrue)│ │   (DB)   │ │  (S3)    │ │  Functions    │   │
│  └──────────┘ └──────────┘ └──────────┘ └───────┬───────┘   │
│                                                  │           │
│  ┌──────────┐ ┌──────────┐ ┌──────────────────────────────┐ │
│  │ Realtime │ │   RLS    │ │    LLM Provider Abstraction  │ │
│  │(WebSocket)│ │(Security)│ │  ┌───────┐┌──────┐┌──────┐  │ │
│  └──────────┘ └──────────┘ │  │OpenAI ││Gemini││Claude│  │ │
│                            │  └───────┘└──────┘└──────┘  │ │
│                            └──────────────────────────────┘ │
└──────────────────────┬──────────────────────────────────────┘
                       │ External APIs
┌──────────────────────┴──────────────────────────────────────┐
│                   EXTERNAL INTEGRATIONS                       │
│                                                              │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌───────────────┐   │
│  │Tribunais │ │  DJEN    │ │Pagamento │ │  Assinatura   │   │
│  │  APIs    │ │  Scraper │ │  (Asaas) │ │  Digital      │   │
│  └──────────┘ └──────────┘ └──────────┘ └───────────────┘   │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐                     │
│  │ WhatsApp │ │  Email   │ │  Nuvem   │                     │
│  │  (Z-API) │ │ (Resend) │ │(GDrive)  │                     │
│  └──────────┘ └──────────┘ └──────────┘                     │
└─────────────────────────────────────────────────────────────┘
```

### Whitelabel Architecture

```
┌─────────────────────────────────────────┐
│         LOVABLE CLOUD (Remix)            │
│                                          │
│  ┌────────────┐  ┌────────────────────┐  │
│  │  Parceiro  │  │  Configuração      │  │
│  │  Fork/Remix│  │  ┌──────────────┐  │  │
│  │            │  │  │ Branding     │  │  │
│  │  Mantém    │  │  │ (logo,cores) │  │  │
│  │  estrutura │  │  ├──────────────┤  │  │
│  │  base      │  │  │ Planos/Preço │  │  │
│  │            │  │  ├──────────────┤  │  │
│  │            │  │  │ LLM Provider │  │  │
│  │            │  │  ├──────────────┤  │  │
│  │            │  │  │ Integrações  │  │  │
│  └────────────┘  │  └──────────────┘  │  │
│                  └────────────────────┘  │
└─────────────────────────────────────────┘
```

Para suportar whitelabel, a arquitetura precisa de:
- **Config por tenant**: `app_config` table com branding, features, limites
- **CSS Variables**: já usado pelo shadcn/ui (fácil trocar tema)
- **Feature Flags**: habilitar/desabilitar módulos por plano
- **Multi-tenant**: RLS no Supabase por `organization_id`

---

## Source Tree — Target Structure

```text
juristech-ai-legal/
├── public/                          # Assets estáticos
├── src/
│   ├── components/
│   │   ├── ui/                      # shadcn/ui (existente, 60+)
│   │   ├── landing/                 # Landing page components (mover existentes)
│   │   │   ├── Hero.tsx
│   │   │   ├── Navbar.tsx
│   │   │   ├── Features.tsx
│   │   │   ├── CTA.tsx
│   │   │   ├── Footer.tsx
│   │   │   └── NavLink.tsx
│   │   ├── layout/                  # Layout components (app area)
│   │   │   ├── AppLayout.tsx        # Layout com sidebar
│   │   │   ├── Sidebar.tsx
│   │   │   ├── TopBar.tsx
│   │   │   └── BreadcrumbNav.tsx
│   │   ├── auth/                    # Auth components
│   │   │   ├── LoginForm.tsx
│   │   │   ├── RegisterForm.tsx
│   │   │   ├── ForgotPassword.tsx
│   │   │   └── ProtectedRoute.tsx
│   │   ├── ai/                      # IA Jurídica components
│   │   │   ├── DocumentGenerator.tsx
│   │   │   ├── TemplateSelector.tsx
│   │   │   ├── LegalEditor.tsx
│   │   │   ├── ProviderSelector.tsx
│   │   │   ├── JurisprudenceSearch.tsx
│   │   │   └── DocumentPreview.tsx
│   │   ├── clients/                 # Gestão de clientes
│   │   │   ├── ClientList.tsx
│   │   │   ├── ClientForm.tsx
│   │   │   ├── ClientDetail.tsx
│   │   │   └── ClientHistory.tsx
│   │   ├── cases/                   # Gestão processual
│   │   │   ├── CaseList.tsx
│   │   │   ├── CaseForm.tsx
│   │   │   ├── CaseTimeline.tsx
│   │   │   └── PublicationFeed.tsx
│   │   ├── tasks/                   # Gestão de tarefas
│   │   │   ├── TaskBoard.tsx
│   │   │   ├── TaskForm.tsx
│   │   │   └── TaskCalendar.tsx
│   │   ├── finance/                 # Financeiro
│   │   │   ├── Dashboard.tsx
│   │   │   ├── InvoiceList.tsx
│   │   │   ├── ExpenseTracker.tsx
│   │   │   └── DREReport.tsx
│   │   └── settings/                # Configurações / Whitelabel
│   │       ├── OrganizationSettings.tsx
│   │       ├── BrandingSettings.tsx
│   │       ├── UserManagement.tsx
│   │       └── IntegrationSettings.tsx
│   ├── pages/                       # Rotas/páginas
│   │   ├── Index.tsx                # Landing (existente)
│   │   ├── NotFound.tsx             # 404 (existente)
│   │   ├── Login.tsx
│   │   ├── Register.tsx
│   │   ├── Dashboard.tsx
│   │   ├── ai/
│   │   │   ├── NewDocument.tsx
│   │   │   ├── Documents.tsx
│   │   │   └── Templates.tsx
│   │   ├── clients/
│   │   │   ├── ClientsPage.tsx
│   │   │   └── ClientDetailPage.tsx
│   │   ├── cases/
│   │   │   ├── CasesPage.tsx
│   │   │   └── CaseDetailPage.tsx
│   │   ├── tasks/
│   │   │   └── TasksPage.tsx
│   │   ├── finance/
│   │   │   └── FinancePage.tsx
│   │   └── settings/
│   │       └── SettingsPage.tsx
│   ├── hooks/                       # React hooks
│   │   ├── use-mobile.tsx           # (existente)
│   │   ├── use-toast.ts             # (existente)
│   │   ├── useAuth.ts               # Auth state
│   │   ├── useOrganization.ts       # Org/tenant context
│   │   └── useAI.ts                 # AI provider abstraction
│   ├── lib/                         # Utilities e configs
│   │   ├── utils.ts                 # (existente)
│   │   ├── supabase.ts              # Supabase client
│   │   ├── ai/                      # AI provider abstraction
│   │   │   ├── provider.ts          # Interface base
│   │   │   ├── openai.ts            # OpenAI adapter
│   │   │   ├── gemini.ts            # Gemini adapter
│   │   │   ├── claude.ts            # Claude adapter
│   │   │   └── templates/           # Templates de documentos jurídicos
│   │   │       ├── peticao-inicial.ts
│   │   │       ├── recurso-apelacao.ts
│   │   │       ├── contrato.ts
│   │   │       └── ...
│   │   ├── constants.ts             # Constantes da aplicação
│   │   └── validators.ts            # Schemas Zod compartilhados
│   ├── types/                       # TypeScript types
│   │   ├── database.ts              # Types gerados do Supabase
│   │   ├── ai.ts                    # Types do módulo IA
│   │   ├── client.ts
│   │   ├── case.ts
│   │   ├── task.ts
│   │   └── finance.ts
│   ├── contexts/                    # React contexts
│   │   ├── AuthContext.tsx
│   │   └── OrganizationContext.tsx
│   ├── test/                        # Tests (existente)
│   ├── App.tsx                      # Router principal
│   ├── main.tsx                     # Entry point
│   └── index.css                    # Global styles
├── supabase/                        # Supabase config (NOVO)
│   ├── config.toml                  # Supabase project config
│   ├── migrations/                  # SQL migrations (ordenadas)
│   │   ├── 00001_create_organizations.sql
│   │   ├── 00002_create_profiles.sql
│   │   ├── 00003_create_clients.sql
│   │   ├── 00004_create_cases.sql
│   │   ├── 00005_create_documents.sql
│   │   ├── 00006_create_tasks.sql
│   │   ├── 00007_create_finances.sql
│   │   ├── 00008_create_ai_usage.sql
│   │   └── 00009_create_rls_policies.sql
│   ├── functions/                   # Edge Functions
│   │   ├── ai-generate/             # Geração de docs com IA
│   │   ├── tribunal-search/         # Busca em tribunais
│   │   ├── djen-scraper/            # Captação de publicações
│   │   ├── webhook-payment/         # Webhook de pagamento
│   │   └── whatsapp-notify/         # Notificações WhatsApp
│   └── seed.sql                     # Dados iniciais
├── docs/                            # Documentação do projeto
│   ├── brownfield-architecture.md   # Este documento
│   ├── prd.md                       # PRD (a ser criado)
│   ├── framework/                   # Framework docs
│   │   ├── coding-standards.md
│   │   ├── tech-stack.md
│   │   └── source-tree.md
│   └── stories/                     # Stories de desenvolvimento
└── Configuration files (existentes)
```

---

## Database Schema — High Level

### Multi-tenant Model

Todas as tabelas possuem `organization_id` com RLS para isolamento de dados.

### Core Tables

```
organizations
├── id (uuid, PK)
├── name
├── slug (unique)
├── branding (jsonb: logo_url, primary_color, accent_color)
├── plan (enum: free, pro, enterprise)
├── features_enabled (jsonb)
├── llm_config (jsonb: provider, api_key_encrypted, model)
└── created_at, updated_at

profiles (extends auth.users)
├── id (uuid, PK, FK → auth.users)
├── organization_id (FK → organizations)
├── role (enum: admin, lawyer, secretary, intern)
├── full_name
├── oab_number (nullable)
├── phone
└── avatar_url

clients
├── id (uuid, PK)
├── organization_id (FK)
├── full_name
├── document_type (enum: cpf, cnpj)
├── document_number
├── email, phone, address (jsonb)
├── notes
└── created_at, created_by (FK → profiles)

cases (processos judiciais)
├── id (uuid, PK)
├── organization_id (FK)
├── client_id (FK → clients)
├── case_number (número do processo)
├── court (tribunal)
├── branch (vara)
├── subject
├── status (enum: active, archived, closed)
├── opposing_party
├── assigned_to (FK → profiles)
└── created_at, updated_at

documents (documentos gerados pela IA)
├── id (uuid, PK)
├── organization_id (FK)
├── case_id (FK → cases, nullable)
├── client_id (FK → clients, nullable)
├── type (enum: petition, appeal, contract, notification, etc.)
├── title
├── content (text — conteúdo gerado)
├── llm_provider (enum: openai, gemini, claude)
├── llm_model
├── prompt_used (text)
├── tokens_used (integer)
├── status (enum: draft, review, approved, signed)
├── storage_path (path no Supabase Storage)
└── created_at, created_by (FK → profiles)

tasks
├── id (uuid, PK)
├── organization_id (FK)
├── case_id (FK → cases, nullable)
├── title
├── description
├── priority (enum: low, medium, high, urgent)
├── status (enum: pending, in_progress, completed, cancelled)
├── due_date
├── assigned_to (FK → profiles)
├── assigned_by (FK → profiles)
└── created_at, completed_at

finances
├── id (uuid, PK)
├── organization_id (FK)
├── case_id (FK → cases, nullable)
├── client_id (FK → clients, nullable)
├── type (enum: income, expense)
├── category
├── amount (decimal)
├── due_date
├── paid_at (nullable)
├── payment_method
├── invoice_url (nullable)
├── notes
└── created_at, created_by (FK → profiles)

publications (captação DJEN)
├── id (uuid, PK)
├── organization_id (FK)
├── case_id (FK → cases, nullable)
├── lawyer_name
├── publication_date
├── content (text)
├── source (enum: djen, dje_pe, etc.)
├── read (boolean)
└── captured_at

ai_usage_log
├── id (uuid, PK)
├── organization_id (FK)
├── profile_id (FK → profiles)
├── provider (enum: openai, gemini, claude)
├── model
├── tokens_input, tokens_output
├── cost_estimated (decimal)
├── document_id (FK → documents, nullable)
├── prompt_summary
└── created_at
```

### RLS Strategy

```sql
-- Padrão para todas as tabelas:
ALTER TABLE {table} ENABLE ROW LEVEL SECURITY;

CREATE POLICY "{table}_org_isolation" ON {table}
  USING (organization_id = (
    SELECT organization_id FROM profiles WHERE id = auth.uid()
  ));
```

**Nota**: Migrations devem ser escritas em SQL puro, ordenadas numericamente, para o Lovable Cloud conseguir ler e aplicar.

---

## LLM Provider Abstraction

### Interface

```typescript
interface LLMProvider {
  id: 'openai' | 'gemini' | 'claude';
  name: string;
  generateDocument(params: DocumentGenerationParams): Promise<GeneratedDocument>;
  searchJurisprudence(query: string, courts: Court[]): Promise<JurisprudenceResult[]>;
  chat(messages: ChatMessage[]): Promise<ChatResponse>;
}

interface DocumentGenerationParams {
  type: DocumentType;
  context: {
    client: ClientInfo;
    case?: CaseInfo;
    facts: string;
    legal_basis?: string[];
    court: Court;
    additional_instructions?: string;
  };
  template: string;
  language: 'pt-BR';
}
```

### Provider Selection Strategy

1. **Configurável por organização**: admin escolhe provider padrão
2. **Fallback automático**: se provider principal falhar, tenta próximo
3. **Cost tracking**: registra tokens/custo por uso em `ai_usage_log`
4. **Rate limiting**: limites por plano (free: 10 docs/mês, pro: 100, enterprise: ilimitado)

---

## Authentication & Authorization

### Auth Flow (Supabase Auth)

1. **Login**: email/password ou magic link
2. **Registro**: convite por admin da organização
3. **Roles**: admin, lawyer (advogado), secretary (secretária), intern (estagiário)
4. **Permissions Matrix**:

| Permissão | Admin | Advogado | Secretária | Estagiário |
|-----------|-------|----------|------------|------------|
| IA - Gerar documentos | ✅ | ✅ | ❌ | ❌ |
| IA - Editar documentos | ✅ | ✅ | ✅ | ❌ |
| Clientes - CRUD | ✅ | ✅ | ✅ | 👁️ |
| Processos - CRUD | ✅ | ✅ | ✅ | 👁️ |
| Tarefas - Criar/Atribuir | ✅ | ✅ | ❌ | ❌ |
| Tarefas - Executar | ✅ | ✅ | ✅ | ✅ |
| Financeiro | ✅ | 👁️ | ❌ | ❌ |
| Configurações | ✅ | ❌ | ❌ | ❌ |
| Usuários - Gerenciar | ✅ | ❌ | ❌ | ❌ |

---

## External Integrations

### Tribunais & DJEN

| Integração | Método | Prioridade |
|------------|--------|-----------|
| TJPE | Web scraping / API (se disponível) | Alta |
| STF | API pública jurisprudência | Alta |
| STJ | API pública jurisprudência | Alta |
| TST | API pública jurisprudência | Média |
| TSE | API pública jurisprudência | Baixa |
| STM | API pública jurisprudência | Baixa |
| DJEN | Scraping de publicações | Alta |

### Pagamentos (Brasil)

| Opção | Boleto | PIX | Cartão | Nota Fiscal |
|-------|--------|-----|--------|-------------|
| Asaas | ✅ | ✅ | ✅ | ✅ |
| Stripe | ❌ | ✅ | ✅ | ❌ |

**Recomendação**: Asaas para mercado brasileiro (boleto + NF integrada).

### Comunicação

| Canal | Solução | Uso |
|-------|---------|-----|
| WhatsApp | Evolution API (self-hosted) ou Z-API | Notificações, lembretes de prazo |
| Email | Resend | Transacionais, convites, relatórios |

### Assinatura Digital

| Solução | ICP-Brasil | API | Custo |
|---------|------------|-----|-------|
| Clicksign | ✅ | REST | Por documento |
| D4Sign | ✅ | REST | Por documento |

---

## Development & Deployment

### Local Development Setup

```bash
# 1. Clone e instale
git clone https://github.com/MindOpsTeam/juristech-ai-legal.git
cd juristech-ai-legal
npm install

# 2. Supabase local
npx supabase init
npx supabase start
npx supabase db push

# 3. Environment variables
cp .env.example .env.local
# Preencher: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, etc.

# 4. Dev server
npm run dev  # http://localhost:8080
```

### Environment Variables

```env
# Supabase
VITE_SUPABASE_URL=http://localhost:54321
VITE_SUPABASE_ANON_KEY=your-anon-key

# LLM Providers (Edge Functions)
OPENAI_API_KEY=sk-...
GOOGLE_AI_API_KEY=AI...
ANTHROPIC_API_KEY=sk-ant-...

# Integrations (Edge Functions)
ASAAS_API_KEY=...
WHATSAPP_API_URL=...
WHATSAPP_API_KEY=...
CLICKSIGN_API_KEY=...
RESEND_API_KEY=...
```

### Build & Deploy

```bash
npm run build     # Build para Vercel
npm run preview   # Preview local do build
npm run lint      # Linting
npm run test      # Testes unitários
```

### Deployment Pipeline

1. **Push to GitHub** → Vercel auto-deploy (frontend)
2. **Supabase migrations** → `npx supabase db push` (manual ou CI)
3. **Edge Functions** → `npx supabase functions deploy` (manual ou CI)

---

## Testing Strategy

### Current State

- Vitest configurado com jsdom
- Playwright configurado para E2E
- 1 test de exemplo apenas
- 0% coverage real

### Target State

| Tipo | Ferramenta | Cobertura Target |
|------|-----------|-----------------|
| Unit | Vitest | 70%+ (hooks, utils, validators) |
| Component | Testing Library | Componentes críticos |
| Integration | Vitest + Supabase local | Edge Functions |
| E2E | Playwright | Happy paths dos módulos principais |

---

## Épicos — High Level Roadmap

| # | Épico | Prioridade | Dependências |
|---|-------|-----------|-------------|
| 1 | **Auth & Multi-tenant** | P0 - Crítico | — |
| 2 | **App Layout & Navigation** | P0 - Crítico | Epic 1 |
| 3 | **IA Jurídica — Core** | P0 - Crítico | Epic 1, 2 |
| 4 | **IA Jurídica — Templates & Jurisprudência** | P1 - Alto | Epic 3 |
| 5 | **Gestão de Clientes** | P1 - Alto | Epic 1, 2 |
| 6 | **Gestão Processual** | P1 - Alto | Epic 5 |
| 7 | **Gestão de Tarefas** | P2 - Médio | Epic 1, 2 |
| 8 | **Financeiro** | P2 - Médio | Epic 5 |
| 9 | **Integrações — Tribunais & DJEN** | P2 - Médio | Epic 6 |
| 10 | **Integrações — Comunicação** | P3 - Baixo | Epic 5 |
| 11 | **Integrações — Pagamento & Assinatura** | P3 - Baixo | Epic 8 |
| 12 | **Whitelabel & Config** | P3 - Baixo | Todos |

### Wave Analysis (para Dev Swarm)

```
Wave 1 (paralelo): Epic 1 (Auth) + Landing page refinements
Wave 2 (paralelo): Epic 2 (Layout) + Epic 3 (IA Core)
Wave 3 (paralelo): Epic 4 (Templates) + Epic 5 (Clientes) + Epic 7 (Tarefas)
Wave 4 (paralelo): Epic 6 (Processos) + Epic 8 (Financeiro)
Wave 5 (paralelo): Epic 9 (Tribunais) + Epic 10 (Comunicação) + Epic 11 (Pagamento)
Wave 6: Epic 12 (Whitelabel)
```

---

## Constraints & Considerations

### Lovable Compatibility

- **Migrations SQL puras**: Lovable Cloud lê migrations sequenciais
- **Supabase-first**: Lovable nativamente suporta Supabase
- **No custom server**: sem Express/Fastify — usar Edge Functions
- **React SPA**: manter como SPA (não migrar para Next.js/Remix)

### Whitelabel Readiness

- CSS Variables para theming (já em uso pelo shadcn/ui)
- `organization.branding` JSONB para logo, cores, nome
- Feature flags por plano em `organization.features_enabled`
- RLS multi-tenant em todas as tabelas

### Performance

- Lazy loading de módulos (React.lazy + Suspense)
- React Query para cache de dados
- Supabase Realtime para atualizações live (publicações, tarefas)
- Edge Functions para chamadas de IA (evitar expor API keys no client)

### Security

- API keys de LLM NUNCA no frontend — sempre via Edge Functions
- RLS em todas as tabelas
- Validação Zod em todas as entradas
- Rate limiting nas Edge Functions
- Audit log para ações sensíveis

---

*Documento gerado por Aria (Architect Agent) — AIOX v2.1*
