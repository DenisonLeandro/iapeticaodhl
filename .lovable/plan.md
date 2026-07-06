## Objetivo

Exportar os DOCX das duas minutas para comparação jurídica, sem alterar código, conteúdo ou rodar nova geração.

## Drafts

- Capítulos: `12bbd5df-2957-44f6-ac1a-afef0533fa77`
- Rápido: `e0250e5c-...` (recuperar UUID completo do teste E2E anterior — mesmo caso)

## Passos

1. Consultar `case_drafts` (via `supabase--read_query`) para os dois IDs e confirmar:
   - `generation_mode` (`chapters` / `fast`)
   - `case_id` idêntico
   - `content` não vazio e tamanho em caracteres
2. Rodar Playwright autenticado abrindo cada `DraftDetailPage` e clicando "Exportar Word", capturando o download real (mesma pipeline `exportDocumentToDOCX` que o usuário usaria). Salvar em:
   - `/mnt/documents/comparacao-juridica/modo_capitulos_peticao_inicial.docx`
   - `/mnt/documents/comparacao-juridica/modo_rapido_peticao_inicial.docx`
3. Validar cada arquivo:
   - Tamanho > 0
   - Assinatura ZIP (`PK`)
   - `unzip -p .../word/document.xml` contém trecho inicial de `case_drafts.content` (confirma que veio do draft correto)
4. Reportar caminhos, tamanhos, mode/case_id de cada draft, e qualquer limitação (ex.: se um dos drafts não estiver mais acessível).

## Não fazer

- Sem alterações em código, edge functions, DB, migrations
- Sem regenerar/reprocessar minutas
- Sem editar `case_drafts.content`
