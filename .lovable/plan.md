## Objetivo
Tornar o Chat IA mais limpo: ocultar a lista de citações por padrão e exibir apenas um botão discreto "Ver fontes utilizadas (N)" que expande/recolhe a lista sob demanda.

## Escopo
Apenas alteração visual em `src/components/cases/CaseChatPanel.tsx`. Nenhuma alteração em hooks, services, edge functions, RAG, pipeline, telemetria, RLS ou migrations.

## Mudanças

### 1. `CitationsBlock` — tornar recolhível
- Adicionar estado local `expanded` (default `false`), independente por instância (logo, independente por resposta).
- Quando `citations.length === 0`, retorna `null` (sem botão).
- Recolhido: botão `ghost` discreto com `FileText` + `ChevronDown` e label `Ver fontes utilizadas (N)`.
- Expandido: label vira `Ocultar fontes (N)` com `ChevronUp` e a grid atual de citações é renderizada abaixo.

### 2. Ordem visual dentro do `MessageBubble` (assistant) — já compatível
1. Texto da resposta
2. Botão "Ver fontes utilizadas (N)" (recolhido por padrão)
3. FeedbackBar (Útil / Não ajudou / Comentar)
4. Botão Fixar/Desfixar

### 3. Streaming
Reaproveita o mesmo `CitationsBlock`; citações em streaming também ficam recolhidas.

### 4. Sem mudanças em
- `useCaseChat`, `caseChatStore`, `services/caseChat.ts`
- Estrutura de `metadata.citations`, persistência, edge function `case-chat`, RAG, telemetria, RLS, migrations
- Feedback, pinagem, composer, fallback, scroll

## Validação
1. Build/typecheck via harness.
2. Playwright 900×503 no processo `e12334e2-aad0-4c69-8b40-cc7dbe94c372`:
   - Enviar pergunta com citações → resposta limpa, botão "Ver fontes utilizadas (N)" visível, lista recolhida.
   - Expandir → lista aparece (file_name + páginas). Recolher → some.
   - Feedback (Útil / Não ajudou / Comentar) e Fixar funcionando.
   - Resposta sem citações → botão não aparece.
   - Campo de pergunta acessível.
   - Screenshots antes/depois da expansão.

## Arquivos alterados
- `src/components/cases/CaseChatPanel.tsx` (apenas `CitationsBlock` + ícones importados).
