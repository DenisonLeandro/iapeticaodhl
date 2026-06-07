# Correção: tags HTML aparecendo no preview da petição

## Diagnóstico

**Causa raiz:** o `ai-generate` instrui a IA a devolver **HTML** (regra 8 do system prompt em `src/lib/ai/prompt-builder.ts`), e o conteúdo realmente vem em HTML (`<h1>`, `<p>`, `<strong>`...). Mas o `StepDocumentResult` renderiza esse conteúdo dentro de uma `<div>` com `whitespace-pre-wrap` como **texto** — então as tags aparecem literais.

```tsx
// src/components/ai/steps/StepDocumentResult.tsx (atual)
<div className="whitespace-pre-wrap ..." data-testid="generated-content">
  {generatedDocument.content}   // ← string HTML virando texto
</div>
```

Pontos verificados:
- **Formato retornado pelo ai-generate:** HTML (às vezes com cerca ```html ... ``` ao redor — depende do modelo).
- **Onde aparece errado:** apenas no **Step 3 (resultado)** do wizard. O `LegalEditor` (Tiptap) usado em `/ai/documents/:id/edit` já renderiza HTML corretamente via `setContent`.
- **Exportação Word/PDF:** já usa `parseHTML` (`src/lib/document-parser.ts`) → recebe HTML corretamente. **Não está quebrada**, mas vale higienizar antes para remover eventuais cercas ```html.
- **Documentos antigos salvos:** continuam funcionando. O conteúdo já está em HTML no banco; só mudamos a forma de exibir.
- **Sanitização:** usar `DOMPurify` (allowlist: `h1,h2,h3,h4,p,br,strong,b,em,i,u,ol,ul,li,blockquote,span`). Sem `script`, `style`, `iframe`, atributos `on*`, `href javascript:`.

## Escopo da correção

### 1. Helper de normalização — `src/lib/ai/normalize-html.ts` (novo)
- `stripCodeFences(raw)` — remove ```html ... ``` ou ``` ... ``` envolvendo a resposta.
- `looksLikeHtml(raw)` — heurística (`/<\/?(p|h[1-6]|strong|em|ul|ol|li|blockquote|br)\b/i`).
- `markdownToHtml(raw)` — fallback simples se o modelo devolver markdown (negrito `**`, headings `#`, listas, parágrafos por linha em branco).
- `normalizeToHtml(raw)` — pipeline: strip fences → se já é HTML, retorna; senão converte markdown/plain text → wrappa parágrafos.
- `sanitizeHtml(html)` — `DOMPurify.sanitize` com allowlist.

### 2. Preview rich no Step 3 — `StepDocumentResult.tsx`
- Substituir a `<div whitespace-pre-wrap>{content}</div>` por um bloco com `dangerouslySetInnerHTML` usando `sanitizeHtml(normalizeToHtml(content))`.
- Classes de documento jurídico: fundo claro tipo "papel", fonte Tahoma 12pt, line-height 1.5, texto justificado, margens internas (3cm/2cm equivalentes em px), `prose` desativado para não conflitar.
- Adicionar estilos em `src/index.css` (classe `.legal-doc-preview`) replicando o look do `.legal-editor` já existente.

### 3. Pequeno ajuste no prompt — `src/lib/ai/prompt-builder.ts`
- Reforçar regra 8: "Retorne **apenas HTML**, sem cercas de código (sem ```html```), sem comentários, sem texto fora das tags. Tags permitidas: h1, h2, h3, p, strong, em, ol, ul, li, blockquote, br."

### 4. Dependência
- `bun add dompurify` + `bun add -d @types/dompurify`.

## Arquivos alterados

| Arquivo | Mudança |
|---|---|
| `src/lib/ai/normalize-html.ts` | **novo** — strip fences + markdown→html + sanitize |
| `src/components/ai/steps/StepDocumentResult.tsx` | render HTML sanitizado |
| `src/index.css` | classe `.legal-doc-preview` |
| `src/lib/ai/prompt-builder.ts` | ajuste textual na regra 8 |
| `package.json` | + dompurify |

**Não alterar agora:** `LegalEditor` (já correto), `export-document.ts` (PDF/DOCX) — mas o normalize será aplicado na entrada do editor e dos exports em fase futura se necessário.

## Riscos

- **Baixo.** Mudança isolada à camada de apresentação.
- DOMPurify roda no cliente, sem afetar dados salvos.
- Documentos antigos: já estão em HTML → vão renderizar melhor que antes.
- XSS: mitigado pela allowlist do DOMPurify.

## Como testar no preview

1. Gerar uma nova petição completa (cliente + processo + PDF).
2. Verificar Step 3: deve aparecer formatada (negrito visível, parágrafos, títulos), **sem `<p>` ou `<strong>` visíveis**.
3. Clicar "Copiar texto" — ainda copia o HTML cru (ok, é o conteúdo armazenado).
4. Exportar PDF e DOCX — abrir e conferir formatação preservada.
5. Abrir documento antigo via `/ai/documents/:id/edit` — Tiptap deve continuar funcionando normalmente.
6. Console: zero erros de DOMPurify ou React.

Após sua aprovação, implemento direto.
