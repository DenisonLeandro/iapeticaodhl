// =============================================================================
// [CASE_CHAT_DEBUG] — Logger temporário e sanitizado para diagnóstico do chat.
// Ativação: localStorage.setItem('CASE_CHAT_DEBUG', '1') no DevTools.
// Inerte em produção quando a flag não está ativa.
// Não loga tokens, headers, conteúdo jurídico completo nem dados sensíveis.
// =============================================================================

const FLAG_KEY = "CASE_CHAT_DEBUG";

function enabled(): boolean {
  try {
    return typeof window !== "undefined" && window.localStorage?.getItem(FLAG_KEY) === "1";
  } catch {
    return false;
  }
}

export function ccdLog(scope: string, event: string, data?: Record<string, unknown>) {
  if (!enabled()) return;
  // Sanitiza: nunca expor strings longas; truncar em 80 chars.
  const safe: Record<string, unknown> = {};
  if (data) {
    for (const [k, v] of Object.entries(data)) {
      if (typeof v === "string") {
        safe[k] = v.length > 80 ? `${v.slice(0, 80)}…(${v.length})` : v;
      } else if (v === null || v === undefined || typeof v === "number" || typeof v === "boolean") {
        safe[k] = v;
      } else {
        // não logar objetos complexos por segurança
        safe[k] = `[${typeof v}]`;
      }
    }
  }
  // eslint-disable-next-line no-console
  console.debug(`[CASE_CHAT_DEBUG] ${scope} · ${event}`, safe);
}
