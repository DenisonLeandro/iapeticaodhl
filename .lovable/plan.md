## Objetivo

Trocar o destino do botão **Conversar com IA** (aba Principal) do drawer lateral para a aba ampla **Chat IA avançado** já existente, mantendo o `CaseChatPanel` e todo o backend intactos.

## Mudanças

### 1. `src/pages/cases/CaseDetailPage.tsx`
- Remover `import CaseChatDrawer from "@/components/cases/CaseChatDrawer";`
- Remover o estado `const [chatDrawerOpen, setChatDrawerOpen] = useState(false);`
- Remover o `<CaseChatDrawer ... />` do final do JSX.
- Trocar `onOpenChat={() => setChatDrawerOpen(true)}` por `onOpenChat={() => setActiveTab("chat-advanced")}` no `<CaseWorkbench />`.
- No `TabsContent value="chat-advanced"`, envolver o painel para evitar chat espremido:
  ```tsx
  <div className="mx-auto w-full max-w-5xl">
    <CaseChatPanel caseId={caseData.id} />
  </div>
  ```
- `CaseMoreMenu → Chat IA avançado` continua chamando `setActiveTab("chat-advanced")` (sem mudança).

### 2. `src/components/cases/CaseWorkbench.tsx`
- Sem alterações. O card "Conversar com IA" continua chamando `onOpenChat`; apenas o pai injeta novo comportamento.

### 3. `src/components/cases/CaseChatDrawer.tsx`
- Mantido no repositório sem uso. Limpeza fica para PR futuro.

## Não tocar

`CaseChatPanel`, `useCaseChat`, `services/caseChat`, edge `case-chat`, RAG, embeddings, PR-3.6, PR-3.7, migrations, RLS, geração de peças, PR-4.1, Dossiê.

## Validação (Playwright, viewport 900×503)

Processo `e12334e2-aad0-4c69-8b40-cc7dbe94c372`:
1. Aba Principal → clicar **Conversar com IA**.
2. Confirmar troca para a aba **Chat IA avançado** e ausência de `Sheet`/drawer no DOM.
3. Enviar: *"Qual o valor atualizado no processo e quais os próximos passos?"*
4. Verificar: resposta visível, citações renderizadas, composer acessível, botões de feedback presentes, sem corte por altura/scroll.
5. Conferir `ai_usage_log` (`operation='chat'`) com `supabase--read_query`.
6. Validar `Mais opções → Chat IA avançado` abrindo a mesma aba.

## Resultado esperado

Botão **Conversar com IA** abre a aba ampla, o chat funciona de forma confiável em viewports pequenos e nenhum código de backend é alterado.
