// =============================================================================
// Edge Function: email-notify
// Deno runtime — sends transactional emails via Resend API.
// Supports templates: publication_new, deadline_approaching, task_assigned.
// Story 8.1 — Email & WhatsApp Notifications
//
// LOVABLE CLOUD: This Edge Function is NOT auto-deployed by Lovable.
// It requires server-side execution for API key security (RESEND_API_KEY).
// To deploy manually: supabase functions deploy email-notify
// Then set secrets: supabase secrets set RESEND_API_KEY=re_...
// =============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ---------------------------------------------------------------------------
// CORS
// ---------------------------------------------------------------------------
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type EmailTemplate = "publication_new" | "deadline_approaching" | "task_assigned";

interface EmailNotifyBody {
  to: string;
  template: EmailTemplate;
  data: Record<string, string>;
}

// ---------------------------------------------------------------------------
// Email Templates — inline HTML with JurisTech branding
// ---------------------------------------------------------------------------

function getEmailSubject(template: EmailTemplate, data: Record<string, string>): string {
  switch (template) {
    case "publication_new":
      return `[Peticionamento com IA] Nova publicação detectada — ${data.case_number || "Processo"}`;
    case "deadline_approaching":
      return `[Peticionamento com IA] Prazo próximo — ${data.description || "Prazo"}`;
    case "task_assigned":
      return `[Peticionamento com IA] Nova tarefa atribuída — ${data.title || "Tarefa"}`;
    default:
      return "[Peticionamento com IA] Notificação";
  }
}

function renderEmailHtml(template: EmailTemplate, data: Record<string, string>): string {
  const header = `
    <div style="background-color: #1e3a5f; padding: 24px; text-align: center;">
      <h1 style="color: #ffffff; margin: 0; font-family: Arial, sans-serif; font-size: 24px;">
        Peticionamento com IA
      </h1>
      <p style="color: #93c5fd; margin: 4px 0 0; font-family: Arial, sans-serif; font-size: 14px;">
        Sistema Jurídico Inteligente
      </p>
    </div>
  `;

  const footer = `
    <div style="background-color: #f3f4f6; padding: 16px; text-align: center; border-top: 1px solid #e5e7eb;">
      <p style="color: #6b7280; font-family: Arial, sans-serif; font-size: 12px; margin: 0;">
        Esta é uma notificação automática do Peticionamento com IA.
        <br/>
        Gerencie suas preferências de notificação nas configurações do sistema.
      </p>
    </div>
  `;

  let body = "";

  switch (template) {
    case "publication_new":
      body = `
        <div style="padding: 24px; font-family: Arial, sans-serif;">
          <h2 style="color: #1e3a5f; margin: 0 0 16px;">Nova Publicação Detectada</h2>
          <p style="color: #374151; font-size: 15px; line-height: 1.6;">
            Uma nova publicação foi detectada no diário de justiça para o processo:
          </p>
          <div style="background-color: #eff6ff; border-left: 4px solid #3b82f6; padding: 16px; margin: 16px 0; border-radius: 4px;">
            <p style="margin: 0 0 8px; color: #1e40af; font-weight: bold;">
              Processo: ${data.case_number || "N/A"}
            </p>
            <p style="margin: 0 0 8px; color: #374151;">
              Advogado: ${data.lawyer_name || "N/A"}
            </p>
            <p style="margin: 0; color: #374151;">
              Data da publicação: ${data.publication_date || "N/A"}
            </p>
          </div>
          ${data.content ? `<p style="color: #374151; font-size: 14px; line-height: 1.6; background-color: #f9fafb; padding: 12px; border-radius: 4px;">${data.content}</p>` : ""}
          <a href="${data.link || "#"}" style="display: inline-block; background-color: #1e3a5f; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 16px; font-size: 14px;">
            Ver no Sistema
          </a>
        </div>
      `;
      break;

    case "deadline_approaching":
      body = `
        <div style="padding: 24px; font-family: Arial, sans-serif;">
          <h2 style="color: #dc2626; margin: 0 0 16px;">Prazo Próximo</h2>
          <p style="color: #374151; font-size: 15px; line-height: 1.6;">
            Atenção! Um prazo está se aproximando:
          </p>
          <div style="background-color: #fef2f2; border-left: 4px solid #ef4444; padding: 16px; margin: 16px 0; border-radius: 4px;">
            <p style="margin: 0 0 8px; color: #991b1b; font-weight: bold;">
              ${data.description || "Prazo"}
            </p>
            <p style="margin: 0 0 8px; color: #374151;">
              Processo: ${data.case_number || "N/A"}
            </p>
            <p style="margin: 0 0 8px; color: #374151;">
              Data limite: ${data.deadline_date || "N/A"}
            </p>
            <p style="margin: 0; color: #dc2626; font-weight: bold; font-size: 16px;">
              Faltam ${data.days_remaining || "?"} dias
            </p>
          </div>
          <a href="${data.link || "#"}" style="display: inline-block; background-color: #dc2626; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 16px; font-size: 14px;">
            Ver Detalhes
          </a>
        </div>
      `;
      break;

    case "task_assigned":
      body = `
        <div style="padding: 24px; font-family: Arial, sans-serif;">
          <h2 style="color: #1e3a5f; margin: 0 0 16px;">Nova Tarefa Atribuída</h2>
          <p style="color: #374151; font-size: 15px; line-height: 1.6;">
            Uma nova tarefa foi atribuída a você:
          </p>
          <div style="background-color: #f0fdf4; border-left: 4px solid #22c55e; padding: 16px; margin: 16px 0; border-radius: 4px;">
            <p style="margin: 0 0 8px; color: #166534; font-weight: bold;">
              ${data.title || "Tarefa"}
            </p>
            ${data.description ? `<p style="margin: 0 0 8px; color: #374151;">${data.description}</p>` : ""}
            ${data.due_date ? `<p style="margin: 0; color: #374151;">Prazo: ${data.due_date}</p>` : ""}
          </div>
          <a href="${data.link || "#"}" style="display: inline-block; background-color: #1e3a5f; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 16px; font-size: 14px;">
            Ver Tarefa
          </a>
        </div>
      `;
      break;
  }

  return `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    </head>
    <body style="margin: 0; padding: 0; background-color: #f9fafb;">
      <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
        ${header}
        ${body}
        ${footer}
      </div>
    </body>
    </html>
  `;
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------
Deno.serve(async (req: Request) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // -----------------------------------------------------------------------
    // Auth
    // -----------------------------------------------------------------------
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing Authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // -----------------------------------------------------------------------
    // Parse body
    // -----------------------------------------------------------------------
    const body: EmailNotifyBody = await req.json();
    const { to, template, data } = body;

    if (!to || !template || !data) {
      return new Response(
        JSON.stringify({ error: "Campos obrigatórios: to, template, data" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const validTemplates: EmailTemplate[] = [
      "publication_new",
      "deadline_approaching",
      "task_assigned",
    ];
    if (!validTemplates.includes(template)) {
      return new Response(
        JSON.stringify({
          error: `Template inválido. Valores aceitos: ${validTemplates.join(", ")}`,
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // -----------------------------------------------------------------------
    // Check user notification preferences
    // -----------------------------------------------------------------------
    const serviceSupabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: prefs } = await serviceSupabase
      .from("notification_preferences")
      .select("*")
      .eq("profile_id", user.id)
      .single();

    if (prefs) {
      if (!prefs.email_enabled) {
        return new Response(
          JSON.stringify({ success: false, reason: "Email desabilitado pelo usuário" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const templateToPreference: Record<EmailTemplate, string> = {
        publication_new: "notify_publications",
        deadline_approaching: "notify_deadlines",
        task_assigned: "notify_tasks",
      };

      const prefKey = templateToPreference[template];
      if (prefKey && !prefs[prefKey]) {
        return new Response(
          JSON.stringify({
            success: false,
            reason: `Tipo de notificação "${template}" desabilitado pelo usuário`,
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    }

    // -----------------------------------------------------------------------
    // Send email via Resend API
    // -----------------------------------------------------------------------
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      throw new Error("Missing secret: RESEND_API_KEY. Configure via: supabase secrets set RESEND_API_KEY=...");
    }

    const fromEmail = Deno.env.get("RESEND_FROM_EMAIL") || "noreply@peticionamentocomia.com.br";

    const subject = getEmailSubject(template, data);
    const html = renderEmailHtml(template, data);

    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: `Peticionamento com IA <${fromEmail}>`,
        to: [to],
        subject,
        html,
      }),
    });

    if (!resendResponse.ok) {
      const errText = await resendResponse.text();
      throw new Error(`Resend API error (${resendResponse.status}): ${errText}`);
    }

    const resendData = await resendResponse.json();

    // -----------------------------------------------------------------------
    // Response
    // -----------------------------------------------------------------------
    return new Response(
      JSON.stringify({
        success: true,
        messageId: resendData.id,
        template,
        to,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("email-notify error:", message);

    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
