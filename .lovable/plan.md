# Diagnóstico técnico

## Estado atual

**Upload (PARTE 1)**
- `FileUploadDialog.tsx` aceita apenas 1 arquivo: `<input type="file">` sem `multiple`, estado `selectedFile: File | null`, validação e upload individuais.
- `uploadFile` em `client-file.service.ts` faz Storage upload + insert um por vez; `useUploadFile` chama `uploadFile` para um único arquivo.
- Limite `MAX_FILE_SIZE` (50 MB) já existe em `client.schema`; mantido por arquivo.
- `client_files` já tem `case_id`, `represented_party`, `document_kind` — não precisa de migration.

**Geração de petição (PARTE 2)**
- `DocumentWizard.tsx`: 3 passos (Tipo → Dados → Resultado). Não busca PDFs do processo.
- `StepDocumentData` tem `clienteVinculadoId` (autopreenche autor) e `numeroProcesso` (texto livre, não vincula a um `cases.id`).
- `useDocumentGeneration` chama `ai-generate` com `prompt` montado no frontend (`buildContext` + `buildUserPrompt`). Não envia IDs de arquivos.
- `supabase/functions/ai-generate/index.ts` valida JWT mas não conhece `client_files`, não busca análises, não valida org dos arquivos.

# Arquivos alterados / criados

**Migration:** nenhuma necessária (schema já suporta tudo).

**PARTE 1 — Upload múltiplo**
- `src/components/clients/FileUploadDialog.tsx` — refatorar para lista de arquivos.
- `src/services/client-file.service.ts` — adicionar `uploadFiles` (loop por arquivo, retorna sucessos/erros) + manter `uploadFile`.
- `src/hooks/useClientDetail.ts` (ou onde mora `useUploadFile`) — adicionar `useUploadFiles` para batch, invalidando `client-files` ao final.

**PARTE 2 — Wizard usa PDFs analisados**
- `src/services/client-file.service.ts` — adicionar `listFilesByCase(caseId)` retornando campos da análise.
- `src/hooks/useClientDetail.ts` (ou novo `useCaseFiles.ts`) — `useFilesByCase(caseId)`.
- `src/components/ai/steps/StepDocumentData.tsx` — adicionar combobox **"Processo vinculado"** (lista cases do cliente selecionado) e gravar `caseId` no form.
- `src/lib/validators/document-generation.ts` — adicionar campos opcionais `caseId`, `selectedAnalysisFileIds: string[]`.
- `src/components/ai/steps/StepCaseDocuments.tsx` (**novo**) — nova etapa 3 do wizard: lista de PDFs do processo com checkboxes, status, "Ver análise", "Analisar agora", "Nenhum analisado…".
- `src/components/ai/DocumentWizard.tsx` — passar de 3 para 4 passos: Tipo → Dados → **Documentos do processo** → Resultado. Pular automaticamente o passo 3 se `caseId` vazio (mostra resumo "sem PDFs").
- `src/hooks/useDocumentGeneration.ts` — repassar `processAnalysisIds` no body para `ai-generate`.
- `src/lib/ai/prompt-builder.ts` — sem mudanças (montagem do bloco vai no backend).
- `supabase/functions/ai-generate/index.ts` — aceitar `processAnalysisIds`, buscar `client_files` com service role, validar `organization_id == body.organizationId` e `processing_status == 'analyzed'`, montar bloco "ANÁLISE DOS DOCUMENTOS DO PROCESSO" e anexar ao prompt antes de chamar o LLM. Acrescentar regras de perspectiva (`represented_party`) no system prompt.

# PARTE 1 — Upload múltiplo: comportamento

1. `<input type="file" multiple>` + dropzone aceitando vários arquivos.
2. Estado: `files: Array<{ id, file, kind, status: 'idle'|'uploading'|'done'|'error', error?, progress }>`.
3. Validação por arquivo (tamanho + mime). Arquivos inválidos ficam marcados em vermelho com motivo, podem ser removidos, **não bloqueiam** os válidos.
4. UI mostra lista prévia: nome, tamanho, tipo, classificação (Select por linha, com botão "Aplicar a todos"), processo vinculado (1 Select aplicado ao lote), parte representada (1 Select aplicado ao lote ou herdada do processo), botão remover.
5. Ao clicar "Enviar": processa sequencialmente (ou Promise.allSettled em paralelo limitado a 3) chamando `uploadFile` para cada arquivo válido. Cada item atualiza seu próprio status.
6. Erro parcial: itens com erro mantêm o motivo na lista; itens enviados ficam check + desabilitados. Toast final: "X enviados com sucesso, Y com erro". Diálogo só fecha se todos sucesso; senão fica aberto com opção "Tentar novamente" só nos com erro.
7. Após qualquer envio bem-sucedido, invalida `["client-files", clientId]`.
8. Botão "Analisar com IA" individual continua no `ClientFilesSection` (sem mudança).

# PARTE 2 — Nova etapa "Documentos do processo"

**Fluxo no wizard:**
1. Step 1 Tipo (igual).
2. Step 2 Dados — adicionar, logo após o combobox de Cliente: combobox **"Processo vinculado"** alimentado por `useClientCases(clienteVinculadoId)`. Ao selecionar, grava `caseId` no form e autopreenche `numeroProcesso`, `tribunal`/`vara` se disponível.
3. Step 3 **Documentos do processo** — só aparece se houver `caseId`. Caso contrário, o wizard pula direto para o Resultado com aviso "Nenhum processo vinculado — petição será gerada apenas com base no formulário".
4. Step 4 Resultado (atual Step 3).

**Step 3 (componente novo):**
- `useFilesByCase(caseId)` lista todos os `client_files` do processo.
- Para cada arquivo: linha com checkbox, nome, `document_kind`, badge de status (`analyzed`/`pending`/`processing`/`error`), `represented_party`, data, botão "Ver análise" (abre `FileAnalysisDialog` existente), botão "Analisar agora" (apenas para pendentes, dispara `useAnalyzePdf`), mensagem de erro inline para `error`.
- Default: todos os `analyzed` vêm selecionados. Pendentes/erro ficam desabilitados.
- Estado guardado em `selectedAnalysisFileIds: string[]` no wizard.
- Seção secundária "Documentos do cliente não vinculados a processo" (opcional, fase 2 — deixar TODO ou implementar agora colapsada, sem seleção automática).
- Aviso quando nenhum analisado: "A petição será gerada apenas com base nas informações preenchidas manualmente."

# Integração com `ai-generate`

**Frontend** envia no body:
```ts
{ ...campos atuais, processAnalysisIds: string[], representedParty?: string }
```

**Backend (`ai-generate/index.ts`)** após autenticar:
1. Confirma `user.profile.organization_id === body.organizationId` via query em `profiles`.
2. Se `processAnalysisIds.length > 0`:
   - `serviceSupabase.from('client_files').select('id, organization_id, file_name, document_kind, represented_party, processing_status, analysis_summary, analysis_json').in('id', processAnalysisIds)`.
   - Filtra: `organization_id === body.organizationId` (descarta qualquer vazamento), `processing_status === 'analyzed'`.
   - Para cada um, monta bloco no formato:
     ```
     Documento: {file_name}
     Tipo: {document_kind}
     Perspectiva: {represented_party}
     Resumo: {analysis_summary}
     Pontos favoráveis: ...
     Riscos: ...
     ... (extraído de analysis_json)
     ```
   - Prepende ao `prompt` recebido o cabeçalho **"ANÁLISE DOS DOCUMENTOS DO PROCESSO"** + blocos.
3. Acrescenta ao `systemPrompt` regras de perspectiva: "Escritório representa a parte {represented_party}. Defenda essa parte. Não inverta polos. Não invente fatos: use apenas o formulário e os documentos analisados. Sinalize informações ausentes."
4. Mantém chamadas atuais a `callLovableAI` / providers externos.

# Segurança / isolamento de organização

- Backend usa **service role** apenas para buscar arquivos, mas **filtra `organization_id`** com o valor confirmado contra `profiles.organization_id` do `auth.uid()` — nunca confia no `organizationId` cru do body.
- Arquivos fora da org do usuário são descartados silenciosamente (sem listá-los).
- Validação extra: `processing_status === 'analyzed'`.
- RLS de `client_files` continua intacto no path do frontend.

# Como testar

1. **Upload múltiplo:**
   - Selecionar 3 PDFs (1 acima de 50 MB) + 1 PNG. O inválido aparece em vermelho; os 3 válidos enviam normalmente. Aba Arquivos lista os 3.
   - Simular erro de rede em 1 arquivo: outros completam, toast final mostra resumo.
   - Aplicar `document_kind = 'inicial'` ao lote e vincular ao processo X — todos os 3 herdam.
2. **Wizard com PDFs:**
   - Cliente com processo + 2 PDFs analisados → Step 3 aparece, ambos vêm marcados, gerar petição. Verificar nos logs do edge function que o prompt contém o bloco "ANÁLISE DOS DOCUMENTOS DO PROCESSO".
   - Desmarcar todos → wizard exibe aviso "nenhum analisado" e gera só com formulário.
   - Cliente sem processo → Step 3 é pulado, fluxo atual preservado.
   - Trocar `represented_party` do processo de "autor" para "reu" → regenerar → petição muda de perspectiva.
3. **Isolamento:** Forjar no devtools um `processAnalysisIds` com ID de outra org → backend descarta, prompt sai sem bloco daquele arquivo.

# Implementação incremental

Ordem proposta (cada etapa é commit/teste antes da próxima):
1. Service `uploadFiles` + hook `useUploadFiles` (sem mudar UI ainda).
2. Refator `FileUploadDialog` para múltiplos arquivos.
3. Service `listFilesByCase` + hook `useFilesByCase`.
4. Combobox de processo no `StepDocumentData` + campo no schema.
5. Novo `StepCaseDocuments` + integração no `DocumentWizard` (com skip quando sem `caseId`).
6. Atualizar `useDocumentGeneration` para enviar `processAnalysisIds`.
7. Atualizar `ai-generate` edge function (busca + bloco no prompt + regras de perspectiva).

Nenhuma etapa quebra o fluxo anterior; sem `processAnalysisIds` o backend se comporta exatamente como hoje.
