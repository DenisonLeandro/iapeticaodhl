# Epic 1: Auth & Multi-tenant Foundation

**Goal:** Estabelecer a base de autenticação, sistema de roles, criação de organizações e layout principal da aplicação (sidebar, top bar, rotas protegidas). Ao final deste épico, usuários podem se registrar, fazer login, e navegar pelo shell do app autenticado.

**FRs:** FR1, FR2, FR3, FR22
**NFRs:** NFR2, NFR3, NFR4, NFR5

---

## Story 1.1: Database Schema & Migrations Setup

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

---

## Story 1.2: Authentication Flow

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

---

## Story 1.3: App Layout & Navigation

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

---

## Story 1.4: User Management & Invites

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
