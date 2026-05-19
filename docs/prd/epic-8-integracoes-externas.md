# Epic 8: Integrações Externas

**Goal:** Integrar comunicação (WhatsApp, email) e busca em tribunais para notificações e automação.

**FRs:** FR19
**NFRs:** NFR2, NFR4

---

## Story 8.1: Email & WhatsApp Notifications

> Como advogado,
> quero receber notificações por email e WhatsApp sobre prazos e publicações,
> para não perder compromissos importantes.

**Acceptance Criteria:**
1. Edge Function `email-notify` usando Resend para emails transacionais
2. Templates de email: publicação nova, prazo próximo, tarefa atribuída
3. Integração WhatsApp via Z-API ou Evolution API
4. Edge Function `whatsapp-notify` para envio de mensagens
5. Configuração de preferências de notificação por usuário (email, WhatsApp, ambos, nenhum)
6. Seção em `/settings/notifications` para configurar preferências
