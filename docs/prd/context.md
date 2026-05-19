# JurisTech AI Legal — PRD Context (Shared)

## Goals

- Automatizar criação de documentos jurídicos com embasamento em legislação brasileira e jurisprudência
- Sistema completo de gestão para escritórios de advocacia
- Integração com tribunais brasileiros (STF, STJ, TST, TSE, STM, TJPE) e DJEN
- Multi-provider de IA (OpenAI, Gemini, Claude) por organização

## Tech Stack

- **Frontend:** React 18 + TypeScript + Vite 8 + Tailwind + shadcn/ui (existente)
- **Backend:** Supabase (Auth, PostgreSQL, Storage, Edge Functions, Realtime)
- **Deploy:** Vercel (frontend) + Supabase Cloud (backend)
- **Testes:** Vitest + Testing Library + Playwright

## Key NFRs

- SPA React compatível com Vercel e Lovable Cloud (NFR1)
- Backend Supabase-only, sem servidor customizado (NFR2)
- Migrations SQL sequenciais compatíveis com Lovable Cloud (NFR3)
- API keys nunca no frontend — sempre Edge Functions (NFR4)
- RLS com isolamento por organization_id em todas as tabelas (NFR5)
- < 2s para CRUD, < 30s para geração IA (NFR6)
- Interface responsiva (NFR8)
- TypeScript strict + validação Zod (NFR9)

## Roles

Admin, Advogado (lawyer), Secretária (secretary), Estagiário (intern)

## Architecture Reference

See `docs/brownfield-architecture.md` for full system architecture, database schema, and integration details.
