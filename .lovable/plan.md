# Fase D — Chat com IA vinculado à petição + versionamento

## Diagnóstico

**Edição atual:** `DocumentEditPage.tsx` (`/ai/documents/:id/edit`) usa `LegalEditor` (Tiptap) com auto-save em `documents.content` a cada 30s via `useAutoSave`. Não há chat, nem aba, nem histórico de versões.

**Schema atual de `documents`:** já tem `parent_document_id` e `version` (int default 1). NÃO há tabela de histórico — `parent_document_id` foi pensado mas nunca usado. Não há tabela de mensagens de chat.

**`StepDocumentResult.tsx`** mostra a peça gerada com botões (Voltar, Nova, Copiar, Word, PDF, Salvar, Editar). Sem chat.

**`source_file_ids`** já é persistido em `documents` (Fase B), então o chat pode reusar essa lista para reanexar análises ao contexto.

**Edge function de geração** já existe (`ai-generate`); padrão de invocar Lovable AI Gateway já estabelecido (`google/gemini-3-flash-preview`).

**Conclusão:** precisamos de duas tabelas novas (`document_chat_messages`, `document_versions`), uma edge function (`document-chat`), um painel de chat reutilizável, uma aba/painel de Versões, e a lógica de "Aplicar sugestão" que grava nova versão.

---

## Mudanças

### 1. Migrations

**`document_chat_messages`**
```
id uuid pk
organization_id uuid not null
document_id uuid not null references documents(id) on delete cascade
role text check in ('user','assistant','system')
content text not null
metadata jsonb default '{}'   -- guarda suggested_patch quando assistant
created_by uuid references auth.users(id)
created_at timestamptz default now()
```
RLS: SELECT/INSERT/UPDATE/DELETE por `organization_id IN (...)` (mesmo padrão de `documents`). GRANT a `authenticated` + `service_role`.

**`document_versions`**
```
id uuid pk
organization_id uuid not null
document_id uuid not null references documents(id) on delete cascade
version int not null
content text not null
change_summary text
source text check in ('manual','chat_ai','editor','restored')
created_by uuid references auth.users(id)
created_at timestamptz default now()
unique(document_id, version)
```
RLS idêntico. Index em `(document_id, version desc)`.

**Sem alterações em `documents`** — `version` existente continua sendo a versão atual.

**Backfill (opcional):** ao primeiro acesso de um documento sem versões, criar a v1 automaticamente (no painel de Versões, lazy).

### 2. Edge Function `document-chat`

Path: `supabase/functions/document-chat/index.ts`. `verify_jwt = false`, valida JWT em código.

**Input:**
```ts
{ documentId: string, message: string }
```

**Fluxo:**
1. Valida JWT, deriva `userId` + `organizationId` via `profiles`.
2. Carrega documento (mesma org). Carrega `client`, `case`, `client_files` filtrados por `source_file_ids` (somente `analysis_summary` e `analysis_json` — nunca o PDF bruto nem `extracted_text` completo).
3. Carrega últimas ~20 mensagens do chat (asc).
4. Monta system prompt com regras: parte representada, não inventar fatos/jurisprudência, diferenciar fatos alegados/provados/decisões, só citar precedentes se houver fonte real fornecida etc.
5. Envia para Lovable AI Gateway (`google/gemini-3-flash-preview`) com `generateText` + `Output.object({ schema })` para forçar JSON estruturado:
   ```
   { message: string, suggested_patch: { type: 'insert'|'replace'|'delete'|'none', target_section?: string, content?: string, explanation?: string } }
   ```
6. Persiste mensagem do user e do assistant (assistant em `metadata` guarda `suggested_patch`).
7. Retorna `{ message, suggested_patch, assistantMessageId }`.

Erros: 402 (créditos) / 429 (rate) repassados ao client; toasts no front.

### 3. Service + hooks no frontend

`src/services/documentChat.ts`:
- `listChatMessages(documentId)`
- `sendChatMessage(documentId, message)` → invoca edge function
- `applyPatchAsNewVersion({ documentId, currentContent, patch, changeSummary, source })`
- `listVersions(documentId)`
- `restoreVersion(documentId, versionId)` (cria nova versão a partir da antiga)

`src/hooks/useDocumentChat.ts` (React Query): mensagens + `sendMessageMutation`.
`src/hooks/useDocumentVersions.ts`: lista + `applyVersionMutation` + `restoreVersionMutation`.

### 4. Aplicação de patch (lado cliente)

Para evitar complexidade de patch estruturado nesta fase, suportar:

- **`insert` (default seguro):** acrescenta `<h2>{target_section || 'Trecho adicionado pela IA'}</h2>{content}` ao final do `documents.content`.
- **`replace`:** se `target_section` for um heading existente (matched por texto exato ou normalizado), substitui o bloco daquele heading até o próximo heading do mesmo nível. Se não encontrar, cai para `insert`.
- **`delete`:** mesma busca por heading; se achar, remove o bloco. Se não achar, aborta e mostra "Não foi possível localizar o trecho — aplique manualmente".
- **`none`:** apenas resposta textual, sem botão Aplicar.

Toda mudança passa por `normalizeToHtml` antes de gravar.

Ao aplicar:
1. Confirmação (`AlertDialog`) com preview do patch (`AlertDialog` mais leve para `insert`, obrigatório para `replace`/`delete`).
2. Update `documents.content` e `documents.version = current + 1`.
3. Insert em `document_versions` com `source='chat_ai'` e `change_summary = patch.explanation || 'Sugestão aplicada via chat IA'`.
4. Toast "Alteração aplicada e nova versão salva".
5. Invalida queries de documento + versões + chat (a mensagem fica marcada como aplicada via `metadata.applied = true`).

### 5. UI — abas no editor e na tela de resultado

**`DocumentEditPage.tsx`:** envolver editor numa estrutura de `Tabs`:
- **Petição** — `LegalEditor` (atual).
- **Conversa com IA** — novo `DocumentChatPanel`.
- **Versões** — novo `DocumentVersionsPanel`.

**`StepDocumentResult.tsx`:** após o save automático (quando `isSaved && savedDocumentId`), adicionar abaixo do banner verde um `Accordion`/`Collapsible` "Conversar com a IA sobre esta petição" que renderiza o mesmo `DocumentChatPanel` (passa `documentId`). Sem abas aqui — chat fica abaixo da preview, recolhido por padrão.

### 6. Componentes novos

- `src/components/ai/chat/DocumentChatPanel.tsx` — lista de mensagens, sugestões rápidas (chips), input + enviar, render markdown com `react-markdown` (já no projeto? se não, adicionar).
- `src/components/ai/chat/ChatMessage.tsx` — bolha user/assistant; para assistant com `suggested_patch != none`, mostra botões **Aplicar**, **Copiar**, **Descartar**.
- `src/components/ai/chat/ApplyPatchDialog.tsx` — confirmação com preview.
- `src/components/ai/versions/DocumentVersionsPanel.tsx` — lista versões (versão, data, usuário, resumo, origem) com ações **Visualizar** (Dialog com HTML renderizado read-only) e **Restaurar** (confirmação → cria nova versão `restored`).

### 7. Sugestões rápidas (chips no chat)

Botões pré-prontos que populam o input (não enviam direto):
- Melhorar fundamentação
- Verificar riscos
- Revisar coerência
- Sugerir tópico faltante
- Impugnar tese da parte contrária
- Melhorar pedidos

### 8. Não nesta fase

Chat streaming (resposta vem inteira), comparação visual de versões (diff), reanalisar PDFs, análise conjunta, OCR no chat.

---

## Arquivos a criar/alterar

**Novos**
- `supabase/functions/document-chat/index.ts`
- `src/services/documentChat.ts`
- `src/services/documentVersions.ts`
- `src/hooks/useDocumentChat.ts`
- `src/hooks/useDocumentVersions.ts`
- `src/components/ai/chat/DocumentChatPanel.tsx`
- `src/components/ai/chat/ChatMessage.tsx`
- `src/components/ai/chat/ApplyPatchDialog.tsx`
- `src/components/ai/versions/DocumentVersionsPanel.tsx`
- `src/lib/ai/patch-applier.ts` — funções `applyInsert/applyReplace/applyDelete` sobre HTML

**Alterados**
- `src/pages/ai/DocumentEditPage.tsx` — Tabs (Petição / Conversa / Versões)
- `src/components/ai/steps/StepDocumentResult.tsx` — accordion "Conversar com a IA"
- `src/integrations/supabase/types.ts` — regenerado após migration

**Migration**
- 2 novas tabelas + RLS + GRANTs + indexes.

---

## Riscos técnicos

- **`replace`/`delete` por heading match** é frágil — se o modelo retornar um `target_section` inexato, vai cair em insert (seguro) ou abortar. Mitigação: sempre apresentar preview ao usuário antes de aplicar.
- **Custo de contexto:** anexar todas análises `analysis_summary` pode explodir tokens. Cortar `analysis_summary` em ~2000 chars por arquivo e ignorar `analysis_json` se passar limite.
- **Conflito com auto-save do editor:** após "Aplicar", o `LegalEditor` precisa receber o novo `content`; já temos `useEffect` que faz `setContent` quando `initialContent` muda — invalidar `useDocument(id)` cobre.
- **Race:** se usuário está digitando no editor e aplica patch do chat, edição local é sobrescrita. Mitigação: bloquear "Aplicar" enquanto `isSaving` é true e dar toast "Salve suas edições antes de aplicar a sugestão" se houver diff não salvo.

---

## Plano incremental recomendado

1. **D1 — Migrations + edge function `document-chat`** (text only, sem patch estruturado): chat funciona, responde texto, mensagens persistidas. Só botão **Copiar** + **Descartar**.
2. **D2 — Resposta estruturada com `suggested_patch`** + botão **Aplicar** (apenas `insert` ao final, com preview).
3. **D3 — Versionamento completo:** tabela `document_versions`, painel Versões, restaurar.
4. **D4 — `replace` e `delete` por heading match** + chips de sugestão rápida.
5. **D5 — Integrar chat também na `StepDocumentResult`** (collapsible abaixo da preview).

Permite parar em qualquer ponto e ter algo útil em produção.

---

## Como testar

1. Gerar petição → abrir editor → aba Conversa → "resuma os fatos" → IA responde, mensagem persistida; recarregar e ver histórico.
2. "Inclua tópico sobre nulidade do banco de horas" → resposta com patch insert → Aplicar → conferir parágrafo ao final + nova versão (v2) em Versões.
3. Restaurar v1 → conferir conteúdo voltou e v3 foi criada com `source=restored`.
4. Outro usuário de outra org tenta GET `/document-chat` → 403.
5. Documento com `source_file_ids` vazio → chat funciona, mas IA não cita análise inexistente.
6. Pedir jurisprudência inventada → IA recusa por regra do system prompt.
7. Patch `replace` cujo `target_section` não existe → aplicar cai em insert seguro (com aviso).
