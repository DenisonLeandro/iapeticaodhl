
# PR-4.4B.2B — Peça em primeiro lugar, cálculos como apoio e destaques pendentes garantidos

Objetivo: desacoplar cálculo automático da redação da peça, evitar valores inconsistentes na petição e garantir que TODOS os marcadores pendentes (colchetes) apareçam visualmente destacados em vermelho por padrão. Sem tocar em módulos protegidos (Chat IA, Ficha, prefill, RAG, embeddings, pipeline documental, analyze-case, analyze-legal-template, legal-intents, Biblioteca de Modelos, download de modelos). Sem migrations.

## 1. Bloquear injeção automática de valores na peça

`supabase/functions/_shared/calc-engine.ts`
- Novo helper `isItemConsistent(item)` — só retorna `true` quando:
  - `estimated_value != null`
  - `confidence === "high"`
  - `missing_fields.length === 0`
  - `assumptions._source ∈ { "documento", "ficha" }` (não aceitar "relato"/"derivado" como suficiente)
  - Regra específica: saldo de salário exige `input_data.worked_days` derivado da data de rescisão E confirmação de que não houve trabalho posterior; aviso-prévio exige `admission_date` e `termination_date` ambos com origem documental.
- Marcar itens que não passem no gate com `notes = "[CALCULAR VALOR — revisar memória de cálculo]"` e `assumptions._draft_injectable = false`.
- `runCalculations` continua rodando tudo (memória de cálculo mantém estimativas), mas define `_draft_injectable` por item.

`supabase/functions/generate-legal-draft/index.ts`
- `computedItems` passa a ser filtrado por `_draft_injectable === true` (o resto vira `pendingItems` para efeito do prompt).
- `calcSummaryForPrompt` reescrito:
  - Lista apenas itens injetáveis como "valores prontos para uso".
  - Todos os demais viram bloco "PEDIDOS SEM VALOR CONSISTENTE — usar OBRIGATORIAMENTE `[CALCULAR VALOR — revisar memória de cálculo]`".
  - Nova regra de valor da causa: se qualquer item relevante for não-injetável, instruir o modelo a escrever `Valor da causa: [CALCULAR VALOR — valor estimado, sujeito à revisão em liquidação]`.
- `DRAFT_SYSTEM` recebe reforço:
  - "É PROIBIDO transcrever no corpo da peça qualquer valor monetário que não esteja na lista de VALORES PRONTOS PARA USO."
  - "Quando o cálculo for parcial, incerto, inconsistente ou dependente de conferência, manter EXATAMENTE `[CALCULAR VALOR — revisar memória de cálculo]`."
  - "Nunca inserir número de dias, meses ou frações (ex.: '14 dias', '11/12 avos') que não venham dos VALORES PRONTOS PARA USO — usar `[CALCULAR VALOR — revisar memória de cálculo]`."

`supabase/functions/review-legal-draft/index.ts`
- No prompt do quality gate: severidade `risco_alto` obrigatória sempre que a peça citar dias/frações/valores monetários que não conferem com a memória de cálculo, com sugestão de troca por `[CALCULAR VALOR — revisar memória de cálculo]`.

## 2. Memória de cálculo continua mostrando estimativas com aviso

`src/components/cases/drafts/CalculationsPanel.tsx`
- Novo badge por item: "Pronto para peça" (verde) quando `_draft_injectable`; "Somente memória — revisar" (âmbar) caso contrário, com tooltip explicando por que não entra na peça.
- Cabeçalho passa a exibir: "Estas estimativas são ferramenta de apoio. Valores só entram na petição quando marcados como 'Pronto para peça'."

`src/lib/xlsx/export-calculations.ts`
- Nova coluna "Uso na peça" (`Pronto para peça` / `Somente memória`).

`src/types/caseCalculation.ts`
- Helper `isDraftInjectable(item)` lendo `assumptions._draft_injectable`.

## 3. Destaque visual dos marcadores pendentes — correção prioritária

Diagnóstico: highlights só aparecem no modo "Ver com destaques", que é opt-in — por isso o usuário não viu na última geração. Corrigir tornando o destaque padrão.

`src/pages/cases/drafts/DraftDetailPage.tsx`
- Inverter o padrão: `showPreview` inicia `true`. O texto abre em preview com highlights; o botão passa a ser "Editar texto" ↔ "Ver com destaques" (rótulo dinâmico).
- Ao entrar em modo editar, exibir uma faixa curta acima da textarea: "Editando texto bruto — clique em 'Ver com destaques' para revisar marcadores pendentes."
- `PendingCountBadge` promovido para o TOPO do card do conteúdo (acima do preview/textarea), não só na lateral. Continua também na lateral.

`src/lib/drafts/pending-markers.ts`
- Ampliar regex para cobrir 100% dos marcadores citados no briefing (adicionar `LOCAL`, `E-MAIL`, `VARA`, `COMARCA`, `TRIBUNAL`, `NOME`, `ENDEREÇO`, `PROFISSÃO`, `ESTADO CIVIL`, `RG`, `CPF`, `CNPJ`, `DATA`, `VALOR`, `PERÍODO`, `HORÁRIO`, `JORNADA`, `TESTEMUNHA`, `PROVA`, `REVISAR ADPF`, `REVISAR ADI`, `REVISAR APLICAÇÃO`, além dos já existentes) mantendo a captura genérica atual.
- Adicionar variante `PENDING_MARKER_BRACKET_REGEX = /\[[^\]\n]{2,400}\]/g` como fallback (segundo passe) para pegar QUALQUER `[...]` remanescente e classificá-lo como `revisar`, garantindo que nenhum colchete passe sem highlight.
- `renderWithHighlights` faz duas passadas: primeiro a regex tipada (para classificação correta), depois a fallback para tudo o que sobrou.

`src/index.css`
- Redefinir `.pending-marker` para o padrão pedido pelo usuário (vermelho forte por default, mantendo apenas variantes discretas por categoria):
  ```css
  .pending-marker {
    color: #dc2626;
    background: #fef2f2;
    font-weight: 700;
    border-bottom: 1px dashed #dc2626;
    padding: 0 2px;
    border-radius: 2px;
  }
  .dark .pending-marker { color: #fca5a5; background: rgba(220,38,38,0.15); border-color: #fca5a5; }
  ```
  Variantes por categoria continuam apenas ajustando tonalidade da borda esquerda (`border-left: 3px solid`), sem sobrescrever cor/fundo — assim TODO marcador aparece vermelho, e a categoria vira acento lateral.

## 4. Copiar/salvar continuam limpos

Confirmar (sem código novo — já é o comportamento):
- `handleCopy` e `handleSave` leem `content` (string bruta).
- Preview é overlay React, jamais escreve no state `content`.
- `DraftContentPreview` nunca é usada como fonte — só como visualização.

## 5. Pedido final e blocos obrigatórios preservados

`supabase/functions/_shared/legal-blocks.ts` e `final-requests/trabalhista-inicial.ts` — sem mudanças (já contêm não limitação, sucessivo de rescisão indireta, exibição de documentos para motorista).

`generate-legal-draft/index.ts` — adiciona no `DRAFT_SYSTEM` instrução explícita:
- "Se o valor de um pedido não estiver nos VALORES PRONTOS PARA USO, manter o pedido completo (rubrica, base legal, reflexos, período) e usar `[CALCULAR VALOR — revisar memória de cálculo]` no lugar do valor. A ausência de valor não elimina o pedido."

## 6. Validação (caso Elvis/LB)

1. Regenerar peça; confirmar que saldo/aviso/férias/13º/FGTS que estavam inconsistentes NÃO aparecem com valor no corpo — aparecem como `[CALCULAR VALOR — revisar memória de cálculo]`.
2. Confirmar que a memória de cálculo continua mostrando as estimativas, cada uma com badge "Somente memória — revisar" quando não injetável.
3. Confirmar que o preview abre com highlights por padrão, todos em vermelho, incluindo `[INFORMAR VARA/COMARCA]`, `[INFORMAR E-MAIL]`, `[INFORMAR LOCAL]`, `[INFORMAR DATA]`, `[ANEXAR DOCUMENTO]`, `[CALCULAR VALOR]`, `[CALCULAR VALOR — revisar memória de cálculo]`, `[CONFIRMAR COM O CLIENTE]`, `[REVISAR FUNDAMENTO]`, `[REVISAR ADPF 501/STF ...]`, `[JURISPRUDÊNCIA A INSERIR — TEMA: ...]`.
4. Confirmar contador de pendências no topo do card + na lateral.
5. Confirmar copiar/salvar = texto puro, sem HTML.
6. Confirmar que valor da causa aparece como `[CALCULAR VALOR — valor estimado, sujeito à revisão em liquidação]` quando houver inconsistência relevante.
7. Confirmar preservação de: não limitação da condenação, pedido sucessivo de rescisão indireta, exibição ampliada para motorista, alertas Súmula 450/ADPF 501 e ADI 5.766, intrajornada pós-Reforma.
8. Sem regressão em gerar/salvar/copiar/arquivar/listar/exportar/aba Peças.

## 7. Arquivos

Editados:
- `supabase/functions/_shared/calc-engine.ts`
- `supabase/functions/generate-legal-draft/index.ts`
- `supabase/functions/review-legal-draft/index.ts`
- `src/components/cases/drafts/CalculationsPanel.tsx`
- `src/lib/xlsx/export-calculations.ts`
- `src/types/caseCalculation.ts`
- `src/pages/cases/drafts/DraftDetailPage.tsx`
- `src/lib/drafts/pending-markers.ts`
- `src/index.css`

Sem novos arquivos. Sem migrations.
