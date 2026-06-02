# Auto-preenchimento Cliente → Processo (passos 1-3)

## Confirmações rápidas

**Arquivos alterados/criados:**
- **novo** `src/lib/ai/buildPetitionContext.ts` — helper + tipos (`FieldSource`, `ConsolidatedField`, `PetitionContext`, `buildPetitionContextFromClientCaseAndDocuments`).
- `src/lib/validators/document-generation.ts` — adicionar `representedParty?`, `assunto?` opcionais (não quebra forms existentes).
- `src/components/ai/steps/StepDocumentData.tsx` — integrar helper nos `onSelect` de cliente e processo, corrigir bug do `vara`, mapear `court→tribunal`, mostrar badge de origem.
- `src/types/case.ts` — sem alteração (campos já existem em `Case`).

**Migration:** nenhuma. Todos os campos já existem em `clients` e `cases`.

## Como evitar sobrescrever campos manuais

- Usar `form.formState.dirtyFields` do react-hook-form como fonte da verdade.
- Em cada `handleSelectClient` / `handleSelect` (case), iterar a lista de campos auto-preenchíveis e **só chamar `setValue` quando `dirtyFields[campo]` for falsy**.
- Sempre passar `setValue(name, value, { shouldDirty: false })` para que a aplicação automática não marque o campo como "tocado pelo usuário".
- Guardar em estado local `fieldSources: Record<string, FieldSource>` para renderizar o badge ("preenchido a partir do processo" / "do cliente"). Reset por campo quando o usuário digita (via `form.watch` + comparação) — se ficar dirty, source vira `"manual"` e badge some.

**Mapeamento `court → tribunal`:**
- Lista canônica dos enums (`STF`, `STJ`, `TST`, `TSE`, `STM`, `TJPE`, `TJSP`, `TJRJ`, `TJMG`, `TRF-1..5`).
- Normalizar `cases.court.toUpperCase().trim()`. Se bater com algum enum, usar; senão `"Outro"` + alert info ("Tribunal '{x}' definido como Outro").

**Alertas básicos nesta fase:**
- `tribunal-fallback` quando o mapeamento cai em "Outro".
- Conflitos com análise ficam para a fase futura (passo 5).

## Como testar

1. Cliente sem processo → seleção do cliente preenche autor (nome, CPF, endereço); badges aparecem.
2. Editar manualmente `autor.nome`, depois trocar de cliente → `autor.nome` permanece o digitado; demais campos atualizam.
3. Selecionar processo → `numeroProcesso`, `vara` (de `branch`, **não `court`**), `tribunal`, `reu.nome` (de `opposing_party`), `assunto`, `representedParty` preenchem; badges aparecem.
4. Editar `vara` manualmente, trocar processo → `vara` mantém valor manual.
5. Processo com `court="TJES"` (fora do enum) → `tribunal = "Outro"`, alerta info exibido discretamente.
6. Limpar processo (`__none__`) → campos auto-preenchidos do processo voltam ao default; os do cliente permanecem; os marcados como manuais permanecem.

## Contrato do helper (resumo)

```ts
type FieldSource = "manual" | "case" | "client" | "analysis" | "default";

interface ConsolidatedField<T> { value: T | undefined; source: FieldSource }

interface PetitionContextInput {
  client?: Client | null;
  caseRow?: Case | null;
  analyses?: ClientFile[]; // reservado para fase futura — aceito mas só lido se passar
  manual: Partial<DocumentGenerationFormData>; // campos com dirty=true
}

interface PetitionContext {
  values: Partial<DocumentGenerationFormData>;
  sources: Record<string, FieldSource>;
  alerts: Array<{ field: string; message: string; severity: "info" | "warn" }>;
}

function buildPetitionContextFromClientCaseAndDocuments(
  input: PetitionContextInput
): PetitionContext;
```

Hierarquia por campo: `manual > case > client > analysis > default`. Análise fica como hook preparado mas vazio nesta entrega.

Confirma para eu implementar?
