# BUGFIX PR-4.5A — Estabilizar geração com/sem playbook

## Diagnóstico

Dois problemas coexistem:

1. **Runtime real observado** (`edge_function_logs`): a última tentativa em `/drafts/new` retornou **504 `draft_timeout`** — a chamada LLM da etapa "draft" estourou timeout. O prompt cresceu (playbook injetado + blocos obrigatórios) e o LLM não fechou dentro do limite. Não há stack trace de crash JS; a mensagem "The app encountered an error" veio provavelmente do toast/ErrorBoundary reagindo ao 504.
2. **Riscos defensivos do PR-4.5A**: `PlaybookCompliancePanel`, `DraftDetailPage` e as edge functions assumem em vários pontos que `playbook`, `config` e `compliance` existem. Hoje já há alguns `?? []`, mas há acessos que podem quebrar em cenários de dados parciais (ex.: `pb.config!.review_checklist!.map`, `compliance.sensitive_alerts.length` fora do bloco checado).

Migração `20260706001413_...sql` já adicionou `case_drafts.playbook_id/snapshot/compliance` e `legal_playbooks` — nenhuma nova migration necessária, apenas validar RLS via linter após ajustes.

## O que muda (escopo mínimo, sem tocar em `calc-engine` nem módulos protegidos)

### Frontend

- **`src/components/cases/drafts/PlaybookCompliancePanel.tsx`**
  - Tornar todo o render defensivo:
    - Aceitar `draft` possivelmente sem os três campos de playbook.
    - Se `!pb` → renderizar aviso discreto **"Nenhum playbook jurídico aplicado."** (texto exato) em vez do texto atual sobre "Configurações".
    - Se `pb` existe mas `!compliance` → renderizar **"Conformidade com Playbook ainda não disponível."**
    - Trocar `pb.config!.review_checklist!.map(...)` por leitura via `?? []` sem `!`.
    - Blindar `compliance.sensitive_alerts.length` com `?? 0` também dentro da Badge.
    - `status` só é indexado em `PLAYBOOK_STATUS_LABEL`/`STATUS_TONE` quando estiver na união conhecida; fallback para `revisar_antes`.

- **`src/pages/cases/drafts/DraftDetailPage.tsx`**
  - Manter o painel sempre montado (ele já lida com null), sem `as never`; usar cast tipado leve.
  - Nenhuma outra alteração de UI.

- **`src/pages/cases/drafts/DraftGeneratorPage.tsx`**
  - Não referencia playbook — deixar como está. Apenas confirmar que o toast de erro exibe mensagem do backend (já ok via `generateCaseDraft`).

### Edge functions

- **`supabase/functions/generate-legal-draft/index.ts`**
  - Envolver `loadApplicablePlaybook` em `try/catch` — se falhar, `playbook = null`, seguir fluxo antigo, logar `{stage:"playbook_load", playbook_found:false, error}`.
  - `checkPlaybookCompliance(content, playbook)` também em `try/catch`; erro → `playbook_compliance = null`.
  - `renderPlaybookForPrompt(playbook)` só chamado quando `playbook` existe (já é o caso) e agora com try/catch → string vazia em falha.
  - **Mitigação do 504**: truncar o bloco do playbook a ~4 KB antes de concatenar no `draftPrompt` (evita explodir contexto e reduz probabilidade de timeout). Sem mexer no modelo/latência do calc-engine.
  - Adicionar log estruturado no início da geração: `{case_id, organization_id, playbook_found, playbook_id, stage:"generate_start"}` — sem conteúdo da peça/ficha.

- **`supabase/functions/review-legal-draft/index.ts`**
  - `checkPlaybookCompliance` e `loadApplicablePlaybook` em `try/catch`; sem playbook, pular findings de compliance e manter fluxo de revisão anterior.
  - Log `{stage:"review_compliance", playbook_found}`.

### Sem alterações
- `calc-engine`, `legal-blocks.ts`, `final-requests/*`, migrations, RLS, seeds.

## Critérios de aceite

1. `/cases/:id/drafts/new` abre sem crash mesmo sem playbook instalado.
2. Geração conclui sem playbook (fluxo antigo) e com playbook.
3. `PlaybookCompliancePanel` nunca quebra com `null`/`undefined` — mostra os textos padronizados.
4. Se generate timeoutar de novo, o toast de erro do backend aparece e a UI segue navegável (não vai para ErrorBoundary).
5. `tsgo` limpo. Nenhum módulo protegido tocado.

## Fora de escopo
- Redesenho do painel de conformidade.
- Alterar prompts/estrutura de blocos obrigatórios do PR-4.5A.
- Investigar limites de timeout do gateway LLM (fica como próximo passo se o 504 persistir após truncar o bloco do playbook).
