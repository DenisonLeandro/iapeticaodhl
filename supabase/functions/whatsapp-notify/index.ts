// =============================================================================
// Edge Function: whatsapp-notify
// Deno runtime — placeholder for WhatsApp notification via Z-API or Evolution API.
// Currently logs messages and returns success (mock mode).
// Story 8.1 — Email & WhatsApp Notifications
//
// LOVABLE CLOUD: This Edge Function is NOT auto-deployed by Lovable.
// It requires server-side execution for API key security.
// To deploy manually: supabase functions deploy whatsapp-notify
// Then set secrets: supabase secrets set WHATSAPP_API_URL=... WHATSAPP_API_TOKEN=...
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
interface WhatsAppNotifyBody {
  to: string;
  message: string;
}

interface SendResult {
  success: boolean;
  messageId?: string;
  mock?: boolean;
}

// ---------------------------------------------------------------------------
// WhatsApp Provider Interface & Adapters
// ---------------------------------------------------------------------------
interface WhatsAppProvider {
  sendMessage(phone: string, message: string): Promise<SendResult>;
}

class ZApiProvider implements WhatsAppProvider {
  async sendMessage(phone: string, message: string): Promise<SendResult> {
    const zapiUrl = Deno.env.get("WHATSAPP_API_URL");
    const zapiToken = Deno.env.get("WHATSAPP_API_TOKEN");

    if (!zapiUrl || !zapiToken) {
      console.warn("[whatsapp-notify] Z-API não configurado. Modo mock ativado.");
      return this.mockSend(phone, message);
    }

    try {
      const response = await fetch(`${zapiUrl}/send-text`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Client-Token": zapiToken,
        },
        body: JSON.stringify({ phone, message }),
      });

      const data = await response.json();
      return { success: response.ok, messageId: data.messageId };
    } catch (err) {
      console.error("[whatsapp-notify] Z-API error:", err);
      return { success: false };
    }
  }

  private mockSend(phone: string, message: string): SendResult {
    console.log(`[whatsapp-notify][MOCK] Enviando para ${phone}: ${message}`);
    return { success: true, messageId: `mock-${Date.now()}`, mock: true };
  }
}

class EvolutionApiProvider implements WhatsAppProvider {
  async sendMessage(phone: string, message: string): Promise<SendResult> {
    const evolutionUrl = Deno.env.get("WHATSAPP_API_URL");
    const evolutionApiKey = Deno.env.get("WHATSAPP_API_TOKEN");
    const instance = Deno.env.get("WHATSAPP_INSTANCE") || "juristech";

    if (!evolutionUrl || !evolutionApiKey) {
      console.warn("[whatsapp-notify] Evolution API não configurada. Modo mock ativado.");
      return this.mockSend(phone, message);
    }

    try {
      const response = await fetch(
        `${evolutionUrl}/message/sendText/${instance}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: evolutionApiKey,
          },
          body: JSON.stringify({ number: phone, textMessage: { text: message } }),
        },
      );

      const data = await response.json();
      return { success: response.ok, messageId: data.key?.id };
    } catch (err) {
      console.error("[whatsapp-notify] Evolution API error:", err);
      return { success: false };
    }
  }

  private mockSend(phone: string, message: string): SendResult {
    console.log(`[whatsapp-notify][MOCK] Enviando para ${phone}: ${message}`);
    return { success: true, messageId: `mock-${Date.now()}`, mock: true };
  }
}

function getProvider(): WhatsAppProvider {
  const provider = Deno.env.get("WHATSAPP_PROVIDER") || "zapi";
  return provider === "evolution" ? new EvolutionApiProvider() : new ZApiProvider();
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
    const body: WhatsAppNotifyBody = await req.json();
    const { to, message } = body;

    if (!to || !message) {
      return new Response(
        JSON.stringify({ error: "Campos obrigatórios: to, message" }),
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

    if (prefs && !prefs.whatsapp_enabled) {
      return new Response(
        JSON.stringify({ success: false, reason: "WhatsApp desabilitado pelo usuário" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // -----------------------------------------------------------------------
    // Send via WhatsApp provider
    // -----------------------------------------------------------------------
    const provider = getProvider();
    const result = await provider.sendMessage(to, message);

    // -----------------------------------------------------------------------
    // Response
    // -----------------------------------------------------------------------
    return new Response(
      JSON.stringify({
        success: result.success,
        messageId: result.messageId,
        mock: result.mock ?? false,
        to,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("whatsapp-notify error:", message);

    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
