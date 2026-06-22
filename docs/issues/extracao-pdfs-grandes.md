# Issue: Extração de PDFs acima de 15 MB / autos grandes

**Status:** aberta · não bloqueia PR-3
**Origem:** validação operacional do PR-2 (3º arquivo de teste — sentença de 22,24 MB)
**Componente:** `supabase/functions/extract-document-text`

## Contexto

Durante a validação do PR-2, o 3º PDF de teste (`HEURY X VIGOR - SENTENCA 1o. GRAU`,
22,24 MB, nativo) falhou de forma reprodutível no pipeline de extração mesmo após:

1. Implementação do fallback automático para `google/gemini-2.5-flash` via Lovable
   AI Gateway (substituindo o caminho `pdfjs-dist` quando `file_size > 8 MB`).
2. Implementação de upload em streaming (`ReadableStream` em blocos de 768 KB) para
   evitar `JSON.stringify` de ~30 MB de base64 no edge runtime.

## Limitação técnica

Os Supabase Edge Functions (Deno runtime) têm orçamento por invocação que não
acomoda PDFs grandes. Observado em logs:

- `WORKER_RESOURCE_LIMIT` / `CPU Time exceeded` — orçamento de CPU por invoke
  esgotado durante o encode base64 de ~22 MB.
- `Memory limit exceeded` — quando o corpo da requisição é montado em memória
  (`JSON.stringify` de 30 MB).

O encode base64 sozinho de 22 MB consome todo o CPU budget antes mesmo do upload
para a gateway começar, e nenhum fallback dentro do mesmo runtime resolve.

## Limite operacional atual

- PDFs **até ~8 MB** → caminho `pdfjs-dist` (streaming página-a-página).
- PDFs **8 MB ≤ tamanho ≤ 15 MB** → fallback `gemini-2.5-flash@multimodal`.
- PDFs **> 15 MB** → **falha limpa** com mensagem orientativa
  (`pdf_too_large_for_edge_runtime: X MB excede o limite de 15 MB. Divida o PDF
  em arquivos menores antes de reenviar.`).

O hard guard de 15 MB existe para evitar queimar 3 tentativas com
`WORKER_RESOURCE_LIMIT` e manter o arquivo preso em `pipeline_stage = 'extracting'`.

## Comportamento atual (mantido por ora)

- Falha imediata em `extract-document-text` com `pipeline_stage = 'failed'` e
  `pipeline_last_error` instruindo o usuário a dividir o PDF.
- Job marcado como `failed` no `processing_jobs` após `max_attempts`.
- Nenhum arquivo fica preso em estado `extracting`.

## Alternativas técnicas para resolução futura

1. **Worker dedicado fora do edge runtime**
   - Container/VM (ex.: Cloud Run, Fly.io, Railway worker) com Node/Python e
     limites de CPU/memória adequados.
   - Edge function continua sendo o orquestrador; despacha jobs para fila externa
     (ou tabela `processing_jobs` consumida pelo worker dedicado).

2. **Split server-side por páginas/blocos**
   - Pré-processamento que quebra PDFs grandes em PDFs menores (ex.: 5 MB cada)
     antes do upload definitivo ou logo após ele.
   - Cada bloco passa pelo pipeline atual sem alteração.
   - Pode rodar no cliente (pdf-lib no navegador) ou no worker dedicado.

3. **Google Files API (nativo do Gemini)**
   - Upload do PDF para a Files API do Google (suporta arquivos grandes) e
     referência por `file_uri` na chamada do modelo.
   - Requer chave Google nativa (não disponível via Lovable AI Gateway hoje) ou
     suporte explícito da gateway para esse fluxo.

4. **OCR/extração externa**
   - Serviços como AWS Textract, Azure Document Intelligence ou Google Document
     AI para extração; resultado volta para o pipeline atual de chunk/classify/embed.

5. **Upload e processamento assíncrono fora do edge runtime**
   - Frontend faz upload direto para storage; um worker assíncrono (queue + worker
     dedicado) consome e processa sem janela de CPU do edge.
   - Status reportado em tempo real via Supabase Realtime.

## Decisão atual

- **Não resolver agora.** A limitação fica documentada nesta issue.
- A mensagem de falha orienta o usuário a dividir o PDF.
- PR-3 (Chat por Processo / RAG) segue independente — depende apenas de arquivos
  já processados com `pipeline_stage = 'done'`.

## Critérios de aceite quando esta issue for retomada

- PDFs de até pelo menos 50 MB processam sem erro `WORKER_RESOURCE_LIMIT`.
- `extracted_text`, `document_chunks` e `document_embeddings` populados
  corretamente, sem duplicação.
- Tempo total de processamento previsível (com progresso visível ao usuário se
  > 60 s).
- Comportamento de falha permanece limpo para casos realmente irrecuperáveis.
