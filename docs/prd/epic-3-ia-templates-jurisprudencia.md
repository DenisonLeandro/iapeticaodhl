# Epic 3: IA Jurídica — Templates & Jurisprudência

**Goal:** Criar templates especializados para cada tipo de peça jurídica e integrar busca de jurisprudência nos tribunais brasileiros para embasar os documentos gerados.

**FRs:** FR4, FR5, FR6, FR7, FR8
**NFRs:** NFR4, NFR6

---

## Story 3.1: Legal Document Templates

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

---

## Story 3.2: Jurisprudence Search Integration

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

---

## Story 3.3: AI Provider Settings

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
