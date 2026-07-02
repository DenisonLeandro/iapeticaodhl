// =============================================================================
// PR-4.3A.1 — Sugestões de Parte Contrária a partir de dados já existentes
// =============================================================================
// Consulta apenas leitura. Retorna candidatos únicos ordenados por frequência.
// =============================================================================
import { supabase } from "@/lib/backend/client";

function norm(s: string | null | undefined): string | null {
  if (!s) return null;
  const t = s.trim();
  return t.length > 1 ? t : null;
}

export async function fetchOpposingPartySuggestions(
  clientId: string,
): Promise<string[]> {
  if (!clientId) return [];

  const [casesResp, intakesResp] = await Promise.all([
    supabase
      .from("cases")
      .select("id, opposing_party, created_at")
      .eq("client_id", clientId)
      .not("opposing_party", "is", null)
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("case_intake_forms")
      .select("opposing_party")
      .eq("client_id", clientId)
      .not("opposing_party", "is", null)
      .limit(20),
  ]);

  const counts = new Map<string, { display: string; count: number }>();
  const push = (raw: string | null | undefined) => {
    const v = norm(raw);
    if (!v) return;
    const key = v.toLowerCase();
    const cur = counts.get(key);
    if (cur) cur.count += 1;
    else counts.set(key, { display: v, count: 1 });
  };

  ((casesResp as { data: Array<Record<string, unknown>> | null }).data ?? []).forEach((r) =>
    push(r.opposing_party as string | null),
  );
  ((intakesResp as { data: Array<Record<string, unknown>> | null }).data ?? []).forEach((r) =>
    push(r.opposing_party as string | null),
  );

  return Array.from(counts.values())
    .sort((a, b) => b.count - a.count)
    .map((v) => v.display)
    .slice(0, 5);
}
