import { useEffect, useMemo, useRef, useState } from "react";
import { ShieldCheck, ShieldAlert, ShieldQuestion } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  runCompletenessAudit,
  PROTOCOL_READINESS_LABEL,
  type ProtocolReadiness,
} from "@shared/completeness.ts";
import { useCalculationByDraft } from "@/hooks/useCaseCalculations";
import { persistCompletenessAudit, setLawyerReviewConfirmation } from "@/services/caseDrafts";
import type { CaseDraft } from "@/types/caseDraft";

const SEAL_STYLE: Record<ProtocolReadiness, string> = {
  draft_incomplete: "bg-amber-600 text-white hover:bg-amber-600",
  ready_for_legal_review: "bg-sky-600 text-white hover:bg-sky-600",
  lawyer_review_confirmed: "bg-emerald-600 text-white hover:bg-emerald-600",
};

const CATEGORY_LABEL: Record<string, string> = {
  legal_review: "Revisão jurídica",
  qualification: "Dado de qualificação",
  instruction: "Documento a juntar",
  calculation: "Valor a calcular",
  other: "Outro marcador",
};

const CASE_VALUE_LABEL: Record<string, string> = {
  complete: "Completo",
  partial: "Parcial — há pedidos pendentes",
  pending: "Sem base suficiente",
  manual: "Definido pelo advogado",
};

export default function CompletenessPanel({
  draft,
  content,
  onRefresh,
}: {
  draft: CaseDraft;
  content: string;
  onRefresh?: () => void;
}) {
  const { data } = useCalculationByDraft(draft.id);
  const [saving, setSaving] = useState(false);

  const report = (draft.quality_report ?? {}) as Record<string, unknown>;
  const confirmedHash =
    typeof report.lawyer_review_confirmed_hash === "string" ? report.lawyer_review_confirmed_hash : null;

  const audit = useMemo(
    () =>
      runCompletenessAudit({
        content,
        items: data?.items ?? [],
        lawyerReviewConfirmedHash: confirmedHash,
      }),
    [content, data?.items, confirmedHash],
  );

  const legacy = !report.completeness_audit && !confirmedHash && !data;
  const hash = audit.state_hash;
  const staleConfirmation = !!confirmedHash && audit.protocol_readiness !== "lawyer_review_confirmed";

  // Persistência da auditoria (debounce): cobre edição manual do conteúdo,
  // alteração/confirmação de valores e reexecução da verificação.
  const persistedRef = useRef<string | null>(
    ((report.completeness_audit as { state_hash?: string } | undefined)?.state_hash) ?? null,
  );
  useEffect(() => {
    if (!content?.trim()) return;
    if (persistedRef.current === audit.state_hash) return;
    const t = setTimeout(() => {
      persistedRef.current = audit.state_hash;
      persistCompletenessAudit(draft.id, report, audit as unknown as Record<string, unknown>).catch((e) =>
        console.warn("[CompletenessPanel] persistCompletenessAudit failed", (e as Error).message),
      );
    }, 2000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audit.state_hash, draft.id, content]);

  const toggleConfirmation = async (confirm: boolean) => {
    setSaving(true);
    try {
      await setLawyerReviewConfirmation(draft.id, report, confirm ? hash : null);
      toast.success(confirm ? "Minuta marcada como apta para protocolo." : "Confirmação revogada.");
      onRefresh?.();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };


  const Icon =
    audit.protocol_readiness === "lawyer_review_confirmed"
      ? ShieldCheck
      : audit.protocol_readiness === "ready_for_legal_review"
        ? ShieldQuestion
        : ShieldAlert;

  const grouped = audit.placeholders.slice(0, 20);

  return (
    <Card className="p-4">
      <div className="mb-2 flex items-center gap-2">
        <Icon className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold">Completude</h3>
        <Badge className={`text-[10px] ${SEAL_STYLE[audit.protocol_readiness]}`}>
          {PROTOCOL_READINESS_LABEL[audit.protocol_readiness]}
        </Badge>
      </div>

      {legacy && (
        <p className="mb-2 rounded-md border border-muted bg-muted/40 p-2 text-[11px] text-muted-foreground">
          Minuta anterior a esta verificação — auditoria calculada agora, sem alterar o conteúdo salvo.
        </p>
      )}

      <div className="grid grid-cols-2 gap-2 text-[11px]">
        <div className="rounded-md border p-2">
          <div className="text-muted-foreground">Pendências no texto</div>
          <div className="text-base font-semibold">{audit.placeholder_count}</div>
          <div className="text-muted-foreground">
            revisão jurídica: {audit.legal_review_placeholder_count ?? 0} · qualificação: {audit.qualification_placeholder_count} · instrução: {audit.instruction_placeholder_count ?? 0} · cálculo: {audit.calculation_placeholder_count} · outros: {audit.other_placeholder_count}
          </div>
        </div>
        <div className="rounded-md border p-2">
          <div className="text-muted-foreground">Valor da causa</div>
          <div className="text-base font-semibold">
            {audit.claim_value_sum.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
          </div>
          <div className="text-muted-foreground">{CASE_VALUE_LABEL[audit.case_value_status]}</div>
        </div>
      </div>

      {audit.case_value_pending_claims.length > 0 && (
        <div className="mt-2 text-[11px] text-amber-700 dark:text-amber-300">
          Pedidos fora do somatório:{" "}
          {audit.case_value_pending_claims.map((c) => c.label).join("; ")}
        </div>
      )}

      {grouped.length > 0 && (
        <div className="mt-3 space-y-1">
          <div className="text-[11px] font-semibold text-muted-foreground">Pendências localizadas</div>
          {grouped.map((p, i) => (
            <div key={`${p.index}-${i}`} className="rounded-md border p-2 text-[11px]">
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono">{p.marker}</span>
                <Badge variant="outline" className="text-[10px]">{CATEGORY_LABEL[p.category]}</Badge>
              </div>
              <div className="mt-0.5 text-muted-foreground">
                Seção: {p.section_key} · ocorrência {p.occurrence_index}
              </div>
              <div className="mt-0.5 italic text-muted-foreground">…{p.excerpt}…</div>
            </div>
          ))}
          {audit.placeholders.length > grouped.length && (
            <div className="text-[11px] text-muted-foreground">
              +{audit.placeholders.length - grouped.length} outras ocorrências.
            </div>
          )}
        </div>
      )}

      {staleConfirmation && (
        <p className="mt-3 rounded-md border border-amber-500/40 bg-amber-500/10 p-2 text-[11px] text-amber-800 dark:text-amber-200">
          A minuta ou os valores foram alterados depois da confirmação — o selo de apto para protocolo foi invalidado.
        </p>
      )}

      <div className="mt-3">
        {audit.protocol_readiness === "lawyer_review_confirmed" ? (
          <Button size="sm" variant="outline" disabled={saving} onClick={() => toggleConfirmation(false)}>
            Revogar “apto para protocolo”
          </Button>
        ) : (
          <Button
            size="sm"
            disabled={saving || audit.protocol_readiness !== "ready_for_legal_review"}
            onClick={() => toggleConfirmation(true)}
            title={
              audit.protocol_readiness !== "ready_for_legal_review"
                ? "Resolva as pendências e o valor da causa antes de confirmar."
                : undefined
            }
          >
            Marcar como apto para protocolo
          </Button>
        )}
      </div>
    </Card>
  );
}
