## Objetivo
Toda petição exportada — tanto **PDF** quanto **Word (.docx)** — deve sair sobre o papel timbrado A4 anexo (faixa laranja + logo Denison Leandro no topo, endereços das filiais no rodapé) em todas as páginas.

## Como funciona hoje
- `src/lib/pdf/export-document.ts` — jsPDF, A4, margens 30/20/30/20 mm, sem fundo.
- `src/lib/docx/export-document.ts` — docx-js, A4, margens 3/2/3/2 cm, header vazio, footer só com "Página N".
- Mesmo arquivo é usado pelo wizard (`StepDocumentResult`) e pela página de edição.

## Solução

### 1. Preparar os assets do timbrado
A partir do `A4_logo.pdf` enviado, gerar:
- **`letterhead-full.jpg`** — página A4 inteira em 200 dpi (≈1654×2339 px). Será o fundo do PDF.
- **`letterhead-header.png`** — só o topo (faixa laranja + logo, ≈1654×450 px, fundo branco).
- **`letterhead-footer.png`** — só o rodapé com os endereços das filiais (≈1654×420 px, fundo branco).

Ambos sobem como Lovable Assets (`src/assets/letterhead-*.{jpg,png}.asset.json`) para não inchar o repo.

Motivo dos três arquivos: o PDF aceita uma imagem A4 inteira como fundo (mais fiel ao timbrado original); o Word precisa de header/footer separados porque é assim que `docx-js` posiciona conteúdo repetido em todas as páginas.

### 2. PDF (`src/lib/pdf/export-document.ts`)
- Carregar `letterhead-full.jpg` como base64 uma vez.
- Desenhar `pdf.addImage(bg, 'JPEG', 0, 0, 210, 297)` no início da primeira página e dentro de `checkPageBreak` antes de cada `addPage`.
- Ajustar margens para o texto não invadir o timbrado:
  - `marginTop`: 30 → **45 mm**
  - `marginBottom`: 20 → **55 mm**
  - laterais mantidas (30 / 20 mm)
- Remover a numeração "Página N" do rodapé do PDF (o timbrado já ocupa o rodapé com os endereços). Se preferir manter, posicionar acima do bloco de endereços (~`pageHeight - 58mm`) — confirmar.

### 3. Word (`src/lib/docx/export-document.ts`)
- Adicionar `headers.default` com um `ImageRun` do `letterhead-header.png` centralizado, sem texto, ocupando a largura útil.
- Substituir o `footers.default` atual: trocar "Página N" por um `ImageRun` do `letterhead-footer.png` (ou manter ambos: rodapé timbrado + linha "Página N" pequena abaixo — confirmar).
- Ajustar margens do section para deixar espaço:
  - `top`: 1701 → **2550 DXA** (≈4,5 cm)
  - `bottom`: 1134 → **3120 DXA** (≈5,5 cm)
  - `header`: 567 DXA (≈1 cm da borda)
  - `footer`: 567 DXA
- Carregar os PNGs via `fetch(asset.url).then(r => r.arrayBuffer())` antes de instanciar o `Document`. `ImageRun` exige `type: "png"` e buffer.

### 4. Escopo multi-tenant
O timbrado é do escritório Denison Leandro. Como hoje só há essa organização ativa, aplico globalmente nos dois exportadores via um helper `getLetterheadAssets(orgId)` que por enquanto retorna sempre o mesmo conjunto. Quando surgir outra organização, basta adicionar um campo `letterhead_*_url` em `organizations` — fora do escopo agora.

### 5. Preview na tela
Os previews HTML (`legal-doc-preview` no wizard e no editor) **não** mudam — continuam mostrando só o texto. O timbrado aparece apenas nos arquivos exportados (PDF e Word).

### 6. QA antes de entregar
- Gerar PDF de teste com 2–3 páginas, converter com `pdftoppm` e verificar: faixa laranja + logo em todas as páginas, rodapé em todas, texto sem invasão.
- Gerar DOCX de teste, converter para PDF com LibreOffice e fazer a mesma checagem visual.

## Arquivos afetados
- Novo: `src/assets/letterhead-full.jpg.asset.json`, `letterhead-header.png.asset.json`, `letterhead-footer.png.asset.json`
- Editado: `src/lib/pdf/export-document.ts`
- Editado: `src/lib/docx/export-document.ts`
- Sem mudanças de banco, RLS, edge functions ou UI.

## Decisões a confirmar
1. **Numeração "Página N"**: remover de PDF e Word, ou manter (pequena, acima do timbrado do rodapé)?
2. **Aplicar a todos os documentos** (PDF + Word) ou só ao PDF nesta entrega?