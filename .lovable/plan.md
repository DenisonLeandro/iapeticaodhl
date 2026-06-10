## Diagnóstico

Dois erros distintos aparecem na mesma tela:

### 1) `Salvamento automático falhou: invalid input syntax for type uuid: ""`

Em `src/components/ai/DocumentWizard.tsx` (linhas 189–190) o documento é salvo assim:

```ts
client_id: formData.clienteVinculadoId ?? null,
case_id:   formData.caseId           ?? null,
```

O operador `??` só converte `undefined`/`null` para `null`. Quando o campo vem como string vazia `""` (estado inicial do formulário / campo apagado), o `""` é enviado ao banco como UUID e o Postgres rejeita.

O mesmo problema existe em qualquer outro campo opcional de UUID enviado para o `documents` (ex.: `parent_document_id`, `template_id`) e potencialmente em `source_file_ids` se houver string vazia dentro do array.

### 2) `Invalid enum value. Expected 'STF' | ... | 'Outro', received 'TRT9'`

O schema em `src/lib/validators/document-generation.ts` (`ALL_TRIBUNAIS`) só aceita: STF, STJ, TST, TSE, STM, TJPE, TJSP, TJRJ, TJMG, TRF-1..5, Outro.

Faltam todos os **TRTs (Justiça do Trabalho)**, **TREs (Eleitoral)**, **TJMs (Militar)** e os demais **TJs estaduais**. Quando o `cases` vinculado tem `tribunal = "TRT9"`, o auto-fill injeta esse valor no form, o Zod rejeita e a select cai para "Outro" mas o erro continua exibido.

## Solução proposta (Fase E — Hardening de formulário & persistência)

### A. Sanitização de UUIDs antes de persistir
Criar um helper único e usá-lo no Wizard (e em qualquer outro insert/update de `documents`):

```ts
// src/lib/utils/uuid.ts
export const cleanUuid = (v: unknown): string | null => {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t.length === 0 ? null : t;
};
```

Aplicar em `DocumentWizard.tsx` linhas 189–190 (`client_id`, `case_id`) e revisar `parent_document_id`, `template_id`, e `source_file_ids` (filtrar entradas vazias) antes do `createDocument`.

Bônus defensivo: ajustar `createDocument` em `src/services/documents.ts` para normalizar esses campos também — assim qualquer outro caller fica protegido.

### B. Expandir lista de tribunais
Em `src/lib/validators/document-generation.ts` e em `src/components/ai/steps/StepDocumentData.tsx` (lista visual), adicionar:

- **Trabalho:** TRT1 a TRT24
- **Eleitoral (TREs):** TRE-AC ... TRE-TO (27 unidades)
- **Militares estaduais:** TJM-SP, TJM-MG, TJM-RS
- **TJs faltantes:** TJAC, TJAL, TJAP, TJAM, TJBA, TJCE, TJDFT, TJES, TJGO, TJMA, TJMT, TJMS, TJPA, TJPB, TJPR, TJPI, TJRN, TJRS, TJRO, TJRR, TJSC, TJSE, TJTO

Para manter manutenível, centralizar em `src/lib/legal/tribunais.ts` exportando `TRIBUNAIS` (com `value`/`label`/`grupo`) e derivar tanto o `z.enum` quanto as `<SelectItem>` agrupadas a partir desse array.

Auto-fill robusto: ao receber `tribunal` de `cases`, se não bater na lista, cair para `"Outro"` e preencher o campo `vara` com o valor original, em vez de quebrar o Zod.

### C. Verificação
1. Abrir o wizard sem cliente/processo → salvar petição → deve persistir sem erro UUID.
2. Vincular processo de TRT (ex.: TRT9 / TRT2) → tribunal selecionado corretamente, sem erro Zod.
3. Editar e remover manualmente o cliente vinculado → auto-save deve continuar funcionando (campo vira `null`, não `""`).
4. Verificar log do edge function / rede para confirmar payload com `client_id: null` quando vazio.

## Arquivos a alterar
- `src/lib/utils/uuid.ts` (novo)
- `src/lib/legal/tribunais.ts` (novo)
- `src/lib/validators/document-generation.ts` (consumir lista nova)
- `src/components/ai/steps/StepDocumentData.tsx` (render agrupado)
- `src/components/ai/DocumentWizard.tsx` (usar `cleanUuid`, fallback "Outro")
- `src/services/documents.ts` (sanitização defensiva no `createDocument`/`updateDocument`)

Sem migration — apenas frontend/validação. Aprova para eu implementar?