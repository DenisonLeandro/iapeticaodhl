import { AlertTriangle, ShieldCheck, ShieldAlert } from "lucide-react";
import type { CaseDraftQualityReport } from "@/types/caseDraft";

interface Props {
  warnings?: string[] | null;
  missing?: string[] | null;
  qualityReport?: CaseDraftQualityReport | null;
}

export default function DraftWarningsList({ warnings, missing, qualityReport }: Props) {
  const weak = qualityReport?.weak_topics ?? [];
  const missingTopics = qualityReport?.missing_topics ?? [];
  const qaAlerts = qualityReport?.quality_alerts ?? [];

  const hasQuality = !!qualityReport;
  const hasAny =
    (warnings && warnings.length > 0) ||
    (missing && missing.length > 0) ||
    weak.length > 0 || missingTopics.length > 0 || qaAlerts.length > 0 || hasQuality;
  if (!hasAny) return null;

  const needsRewrite = qualityReport?.needs_rewrite === true;
  const rewriteApplied = qualityReport?.rewrite_applied === true;

  return (
    <div className="space-y-3">
      {hasQuality && (
        <div className={`rounded-lg border p-4 text-sm ${
          needsRewrite && !rewriteApplied
            ? "border-red-500/40 bg-red-500/10"
            : "border-emerald-500/40 bg-emerald-500/10"
        }`}>
          <div className="mb-2 flex items-center gap-2 font-medium">
            {needsRewrite && !rewriteApplied ? (
              <><ShieldAlert className="h-4 w-4 text-red-600" /> Qualidade da minuta — revisar manualmente</>
            ) : (
              <><ShieldCheck className="h-4 w-4 text-emerald-600" /> Qualidade da minuta</>
            )}
          </div>
          <ul className="grid grid-cols-1 gap-0.5 text-xs">
            <QRow ok={qualityReport?.matches_template_depth} label="Profundidade equivalente ao modelo" />
            <QRow ok={qualityReport?.has_preliminaries} label="Preliminares" />
            <QRow ok={qualityReport?.has_legal_basis_per_topic} label="Fundamento legal por tópico" />
            <QRow ok={qualityReport?.has_detailed_requests} label="Pedidos discriminados" />
            <QRow ok={qualityReport?.has_reflexes} label="Reflexos" />
            <QRow ok={qualityReport?.has_successive_requests_when_applicable} label="Pedidos sucessivos quando cabíveis" />
            <QRow ok={qualityReport?.has_burden_of_proof_when_applicable} label="Ônus da prova quando cabível" />
            <QRow ok={qualityReport?.avoids_copying_template_facts} label="Não copiou fatos do modelo" />
          </ul>
          {rewriteApplied && (
            <p className="mt-2 text-xs italic text-muted-foreground">
              Reescrita automática aplicada para cobrir tópicos fracos/ausentes.
            </p>
          )}
        </div>
      )}

      {(missingTopics.length > 0 || weak.length > 0) && (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 text-sm">
          <div className="mb-2 flex items-center gap-2 font-medium text-amber-800 dark:text-amber-300">
            <AlertTriangle className="h-4 w-4" />
            Tópicos a reforçar
          </div>
          {missingTopics.length > 0 && (
            <div className="mb-2">
              <div className="text-xs font-semibold uppercase text-muted-foreground">Tópicos ausentes</div>
              <ul className="list-disc space-y-0.5 pl-5">
                {missingTopics.map((t, i) => <li key={`m${i}`}>{t}</li>)}
              </ul>
            </div>
          )}
          {weak.length > 0 && (
            <div>
              <div className="text-xs font-semibold uppercase text-muted-foreground">Tópicos frouxos</div>
              <ul className="list-disc space-y-0.5 pl-5">
                {weak.map((t, i) => <li key={`w${i}`}>{t}</li>)}
              </ul>
            </div>
          )}
        </div>
      )}

      {((warnings && warnings.length > 0) || (missing && missing.length > 0) || qaAlerts.length > 0) && (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 text-sm">
          <div className="mb-2 flex items-center gap-2 font-medium text-amber-800 dark:text-amber-300">
            <AlertTriangle className="h-4 w-4" />
            Alertas de revisão
          </div>
          {qaAlerts.length > 0 && (
            <div className="mb-2">
              <div className="text-xs font-semibold uppercase text-muted-foreground">Jurisprudência / fundamentos a revisar</div>
              <ul className="list-disc space-y-0.5 pl-5">
                {qaAlerts.map((a, i) => <li key={`a${i}`}>{a}</li>)}
              </ul>
            </div>
          )}
          {warnings && warnings.length > 0 && (
            <div className="mb-2">
              <div className="text-xs font-semibold uppercase text-muted-foreground">Alertas</div>
              <ul className="list-disc space-y-0.5 pl-5">
                {warnings.map((w, i) => <li key={`ww${i}`}>{w}</li>)}
              </ul>
            </div>
          )}
          {missing && missing.length > 0 && (
            <div>
              <div className="text-xs font-semibold uppercase text-muted-foreground">Informações pendentes</div>
              <ul className="list-disc space-y-0.5 pl-5">
                {missing.map((w, i) => <li key={`mi${i}`}>{w}</li>)}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function QRow({ ok, label }: { ok: boolean | undefined; label: string }) {
  return (
    <li className="flex items-center gap-2">
      <span className={`inline-block h-1.5 w-1.5 rounded-full ${ok ? "bg-emerald-500" : "bg-amber-500"}`} />
      <span className={ok ? "text-muted-foreground" : "text-foreground"}>{label}</span>
    </li>
  );
}
