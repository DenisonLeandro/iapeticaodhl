# Fase B — Visualização estilo Word + Exportação + Anti-jurisprudência falsa

## Diagnóstico

**Formato retornado pelo `ai-generate`:** HTML (instrução 8 do system prompt obriga). Às vezes vem com cercas ```html ou misturado.

**Onde aparece HTML cru na tela:**
- `StepDocumentResult.tsx` já usa `dangerouslySetInnerHTML={{ __html: toSafeHtml(...) }}` (linha 175) — então o HTML deveria renderizar. Porém:
  - Quando o modelo retorna conteúdo com entidades HTML escapadas (`&lt;p&gt;`), o sanitizer mantém o texto literal.
  - O CSS `.legal-doc-preview` em `src/index.css` pode estar com `white-space: pre-wrap` ou estilos que fazem o HTML aparecer cru — verificar.
  - Em alguns providers (openai/claude) a resposta volta dentro de blocos ```html que não estão sendo strippados antes de salvar em `documents.content` — o banco guarda HTML "cru" com cercas, e o `LegalEditor` re-exibe sem normalizar.

**Como está salvo em `documents.content`:** HTML (string), mas sem passar por `toSafeHtml` ou `normalizeToHtml` antes do insert — vai como o modelo devolveu (pode conter cercas, escapado, ou markdown).

**Exportações:**
- `exportDocumentToPDF`/`exportDocumentToDOCX` chamam `parseHTML(content)` direto, sem `normalizeToHtml`. Helvetica/Arial — não Tahoma. Margens já em ABNT (30/30/20/20 mm) ✓, mas sem justificado, sem espaçamento 1,5 explícito no PDF.

**LegalEditor/Tiptap:** já renderiza HTML; bastará passá-lo normalizado.

**Anti-jurisprudência:** instrução 4 atual diz "Inclua jurisprudência quando relevante (cite tribunal, número e ementa)" — convida o modelo a inventar. Precisa ser invertida.

---

## Mudanças

### 1. Normalizar conteúdo antes de salvar (fonte única de verdade)

`src/hooks/useDocumentGeneration.ts` e `src/lib/ai/direct-client.ts` (ou onde `documents.content` é persistido pela Fase A): aplicar `normalizeToHtml(raw)` no `content` antes do insert/auto-save. Garante que o banco sempre guarde HTML limpo (sem cercas, sem markdown solto, sem texto escapado).

Para entidades escapadas (`&lt;p&gt;`), adicionar em `normalize-html.ts` um `unescapeIfDoubleEscaped(raw)`: se a string contém muitos `&lt;` mas nenhum `<tag>`, faz unescape antes de detectar HTML.

### 2. Visualização estilo Word (folha A4)

`src/components/ai/steps/StepDocumentResult.tsx`:
- Substituir o `Card` cinza por um wrapper "folha A4" — fundo branco, sombra, largura ~21cm, padding simulando margens (3cm/3cm/2cm/2cm), `text-align: justify`, `font-family: Tahoma`, `font-size: 12pt`, `line-height: 1.5`, recuo de primeira linha em `<p>`.
- Classe `.legal-doc-page` adicionada em `src/index.css` com estilos para h1/h2/h3 centralizados/destacados, `strong`, `blockquote`, etc.
- Sempre renderizar via `dangerouslySetInnerHTML={{ __html: toSafeHtml(content) }}`.

### 3. Botões da tela de resultado

Reorganizar barra de ações em `StepDocumentResult.tsx`:
- Esquerda: **Voltar** (volta etapa wizard), **Nova petição** (reset).
- Direita: **Copiar texto**, **Editar**, **Exportar Word**, **Gerar PDF**, **Salvar / Salvo**.
- Mostrar banner verde discreto: "Petição salva no histórico" quando `isSaved`.

### 4. Exportação Word (`src/lib/docx/export-document.ts`)

- Trocar `font: "Arial"` por `font: "Tahoma"` em todos os `TextRun` e estilos default.
- Adicionar `alignment: AlignmentType.JUSTIFIED` no `flushParagraph` para parágrafos `normal`.
- Espaçamento já é `line: 360` (≈1,5) ✓; manter.
- Margens já corretas (3/3/2/2) ✓.
- Aplicar `normalizeToHtml(content)` antes de `parseHTML` para garantir entrada limpa.

### 5. Exportação PDF (`src/lib/pdf/export-document.ts`)

- jsPDF não tem Tahoma nativo. Duas opções:
  - **(a) embarcar fonte Tahoma** via `addFileToVFS` + `addFont` (arquivo TTF em `src/assets/fonts/`) — peso ~600KB.
  - **(b) usar Helvetica** (já está) e aceitar substituição visual — Word fica em Tahoma.
- Recomendado: **opção (a)** já que o usuário pediu padrão visual idêntico.
- Adicionar justificação: usar `pdf.text(line, x, y, { align: "justify", maxWidth })` para corpo.
- Aumentar `lineHeight` para refletir 1,5 (≈ 7.5mm com fonte 12pt).
- Aplicar `normalizeToHtml(content)` antes de `parseHTML`.

### 6. Regra anti-jurisprudência falsa (`src/lib/ai/prompt-builder.ts`)

Substituir regra 4 e adicionar bloco dedicado no `buildSystemPrompt`:

```
4. JURISPRUDÊNCIA: NÃO invente precedentes. É proibido fabricar número de processo, ementa, relator, turma, data ou tribunal. Só cite jurisprudência se ela for fornecida explicitamente no prompt do usuário (seção "JURISPRUDÊNCIA SELECIONADA"). Se nenhuma jurisprudência real for fornecida, NÃO cite — fundamente apenas com lei, doutrina e princípios. A ausência de jurisprudência é preferível a citar precedente falso.
10. NÃO invente fatos, datas, nomes, valores, números de processo nem precedentes.
```

Em `buildUserPrompt`, marcar a seção de jurisprudência de forma inequívoca:
```
--- JURISPRUDÊNCIA REAL FORNECIDA PELO SISTEMA (única permitida) ---
<texto + fonte/link/identificador>
--- FIM DA JURISPRUDÊNCIA REAL ---
```

Se `jurisprudenciaText` estiver vazio, incluir:
```
--- JURISPRUDÊNCIA ---
Nenhuma jurisprudência foi fornecida. NÃO cite precedentes neste documento.
```

### 7. Editor (`src/pages/ai/DocumentEditPage.tsx` / `LegalEditor.tsx`)

Aplicar mesma classe `.legal-doc-page` no container do editor para que a edição também tenha aparência Word (Tahoma 12, justificado, A4 simulado).

---

## Arquivos a alterar

- `src/lib/ai/normalize-html.ts` — adicionar `unescapeIfDoubleEscaped`
- `src/lib/ai/prompt-builder.ts` — regra anti-jurisprudência + seção marcada
- `src/hooks/useDocumentGeneration.ts` — normalizar `content` antes do auto-save
- `src/components/ai/steps/StepDocumentResult.tsx` — folha A4, botões, banner "salva"
- `src/components/ai/LegalEditor.tsx` — classe `.legal-doc-page`
- `src/index.css` — estilos `.legal-doc-page` (Tahoma, A4, justificado, 1.5)
- `src/lib/docx/export-document.ts` — Tahoma + justified + normalize
- `src/lib/pdf/export-document.ts` — embarcar Tahoma + justified + normalize
- `src/assets/fonts/Tahoma.ttf` (novo) — para jsPDF

## Sem migration

Conteúdo continua em `documents.content` como HTML string. Documentos antigos passam por `toSafeHtml` no momento de exibir/exportar — retroativamente limpos.

## Testes (preview)

1. Gerar petição nova — verificar que NÃO aparecem `<h1>`, `<p>`, `<strong>` na tela; texto justificado, Tahoma, folha A4.
2. Banner "Petição salva no histórico" aparece após auto-save.
3. Botões: Voltar, Nova petição, Copiar, Editar, Exportar Word, Gerar PDF, Salvar/Salvo.
4. Baixar .docx → abrir no Word → Tahoma 12, justificado, margens 3/3/2/2, 1,5.
5. Baixar PDF → Tahoma 12 (ou fallback), justificado, sem HTML.
6. Abrir documento antigo em `/ai/documents/:id/edit` → renderiza limpo.
7. Gerar petição sem jurisprudência selecionada → conferir que IA não inventa precedente; gerar com jurisprudência real do `JurisprudenceSearch` → conferir que cita exatamente a fonte fornecida.

## Riscos

- Tahoma embarcada no PDF aumenta bundle ~600KB. Mitigação: lazy-load do módulo de export PDF (já é dinâmico).
- Mudar `content` salvo (normalizado) não afeta documentos existentes; eles continuam funcionando porque o display também normaliza.
- Regra anti-jurisprudência pode reduzir qualidade percebida quando usuário não fornecer julgados; é o trade-off desejado.
