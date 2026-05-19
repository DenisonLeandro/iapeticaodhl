# Epic 2: IA Jurídica — Core Engine

**Goal:** Implementar o módulo central de inteligência artificial jurídica com abstração multi-provider (OpenAI, Gemini, Claude), geração de documentos e editor integrado para revisão. Ao final, advogados podem gerar peças jurídicas básicas usando IA.

**FRs:** FR4, FR5, FR6, FR8, FR9, FR10, FR23
**NFRs:** NFR4, NFR6

---

## Story 2.1: LLM Provider Abstraction Layer

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

---

## Story 2.2: Document Generation Flow

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

---

## Story 2.3: Legal Document Editor

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

---

## Story 2.4: My Documents List

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
