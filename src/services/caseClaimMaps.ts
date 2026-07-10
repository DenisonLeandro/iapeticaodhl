// =============================================================================
// PR-6A — Serviço do Mapa de Pedidos e Riscos
// =============================================================================
import { supabase } from "@/lib/backend/client";
import { withInflight } from "@/lib/ai/inflight-guard";
import type {
  BuildClaimMapPayload,
  BuildClaimMapResponse,
  CaseClaimMap,
} from "@/types/caseClaimMap";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export async function getCurrentClaimMap(caseId: string): Promise<CaseClaimMap | null> {
  const { data, error } = await db
    .from("case_claim_maps")
    .select("*")
    .eq("case_id", caseId)
    .eq("is_current", true)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as CaseClaimMap | null) ?? null;
}

export async function listClaimMapVersions(caseId: string): Promise<CaseClaimMap[]> {
  const { data, error } = await db
    .from("case_claim_maps")
    .select("*")
    .eq("case_id", caseId)
    .order("version", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as CaseClaimMap[];
}

export async function buildClaimMap(payload: BuildClaimMapPayload): Promise<CaseClaimMap> {
  return withInflight(`build-claim-map:${payload.case_id}`, async () => {
  const FRIENDLY = "Não foi possível gerar o Mapa de Pedidos e Riscos. Tente novamente.";
  const { data, error } = await supabase.functions.invoke("build-claim-map", { body: payload });

  if (error) {
    let status: number | undefined;
    let code: string | undefined;
    let message: string | undefined;
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const resp: Response | undefined = (error as any)?.context?.response;
      if (resp) {
        status = resp.status;
        const parsed = await resp.clone().json().catch(() => null);
        if (parsed && typeof parsed === "object") {
          code = (parsed as { code?: string }).code;
          message = (parsed as { message?: string }).message;
        }
      }
    } catch { /* ignore */ }
    console.error("buildClaimMap:error", { status, code, message: message ?? error.message });
    throw new Error(message ?? FRIENDLY);
  }

  if (data && (data as { success?: boolean }).success === false) {
    const message = (data as { message?: string }).message;
    console.error("buildClaimMap:soft_error", data);
    throw new Error(message ?? FRIENDLY);
  }

  const result = data as BuildClaimMapResponse;
  if (!result?.claim_map) throw new Error(FRIENDLY);
  return result.claim_map;
  });
}
