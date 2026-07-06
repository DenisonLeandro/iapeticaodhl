// =============================================================================
// PR-4.5A — Painel de Conformidade com Playbook na tela da minuta.
// Somente exibe/copia sugestões — não altera o texto salvo.
// =============================================================================
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Copy, ShieldAlert, ShieldCheck, ShieldQuestion } from "lucide-react";
import type { CaseDraft } from "@/types/caseDraft";
import type { ComplianceMissing, ComplianceResult, LegalPlaybook, PlaybookComplianceStatus } from "@/types/legalPlaybook";
import { PLAYBOOK_STATUS_LABEL } from "@/types/legalPlaybook";

interface Props {
  draft: CaseDraft & {
    playbook_id?: string | null;
    playbook_snapshot?: LegalPlaybook | null;
    playbook_compliance?: ComplianceResult | null;
  };
}

const STATUS_TONE: Record<PlaybookComplianceStatus, string> = {
  aprovado_para_revisao: "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  revisar_antes: "border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-200",
  incompleto: "border-orange-500/40 bg-orange-500/10 text-orange-800 dark:text-orange-200",
  risco_alto: "border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-300",
};

function StatusIcon({ status }: { status: PlaybookComplianceStatus }) {
  if (status === "aprovado_para_revisao") return <ShieldCheck className="h-4 w-4" />;
  if (status === "risco_alto") return <ShieldAlert className="h-4 w-4" />;
  return <ShieldQuestion className="h-4 w-4" />;
}

function copyText(text: string) {
  navigator.clipboard.writeText(text).then(
    () => toast.success("Sugestão copiada."),
    () => toast.error("Não foi possível copiar."),
  );
}

function MissingList({ title, items }: { title: string; items: ComplianceMissing[] }) {
  if (!items || items.length === 0) return null;
  return (
    <div className="mt-3">
      <p className="mb-1 text-xs font-semibold uppercase text-muted-foreground">{title}</p>
      <ul className="space-y-2">
        {items.map((m) => (
          <li key={`${m.kind}-${m.key}`} className="rounded-md border border-border/60 p-2 text-xs">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-1">
                  <span className="font-medium">{m.title}</span>
                  <Badge variant={m.severity === "risco_alto" ? "destructive" : "outline"} className="text-[10px]">
                    {m.severity.replace(/_/g, " ")}
                  </Badge>
                </div>
                <p className="mt-1 text-muted-foreground">{m.reason}</p>
              </div>
              {m.suggestion && (
                <Button size="sm" variant="ghost" onClick={() => copyText(m.suggestion!)}>
                  <Copy className="mr-1 h-3 w-3" /> Copiar
                </Button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function PlaybookCompliancePanel({ draft }: Props) {
  const pb = draft.playbook_snapshot ?? null;
  const compliance = draft.playbook_compliance ?? null;

  if (!pb) {
    return (
      <Card className="p-4">
        <h3 className="text-sm font-semibold">Conformidade com Playbook</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Nenhum playbook aplicável foi encontrado para este caso. Instale ou crie um em <em>Configurações → Playbooks Jurídicos</em>.
        </p>
      </Card>
    );
  }

  const status = (compliance?.status ?? "revisar_antes") as PlaybookComplianceStatus;
  const score = compliance?.score ?? 0;
  const totalMissing =
    (compliance?.missing_blocks?.length ?? 0) +
    (compliance?.missing_requests?.length ?? 0) +
    (compliance?.missing_documents?.length ?? 0);
  const passed = compliance?.passed_items?.length ?? 0;

  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold">Conformidade com Playbook</h3>
          <p className="mt-0.5 text-xs text-muted-foreground truncate" title={pb.name}>
            {pb.name} (v{pb.version})
          </p>
        </div>
        <div className={`flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-medium ${STATUS_TONE[status]}`}>
          <StatusIcon status={status} />
          <span>{score}%</span>
        </div>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">{PLAYBOOK_STATUS_LABEL[status]}</p>

      {compliance ? (
        <>
          <div className="mt-2 flex flex-wrap gap-1 text-[11px] text-muted-foreground">
            <Badge variant="outline">{passed} cumpridos</Badge>
            <Badge variant="outline">{totalMissing} faltantes</Badge>
            {(compliance.sensitive_alerts?.length ?? 0) > 0 && (
              <Badge variant="destructive">{compliance.sensitive_alerts.length} teses sensíveis</Badge>
            )}
          </div>

          <MissingList title="Blocos faltantes" items={compliance.missing_blocks ?? []} />
          <MissingList title="Pedidos faltantes" items={compliance.missing_requests ?? []} />
          <MissingList title="Documentos faltantes" items={compliance.missing_documents ?? []} />
          <MissingList title="Alertas de teses sensíveis" items={compliance.sensitive_alerts ?? []} />
        </>
      ) : (
        <p className="mt-2 text-xs text-muted-foreground">
          A verificação de conformidade será executada junto com a revisão automática.
        </p>
      )}

      {(pb.config?.review_checklist?.length ?? 0) > 0 && (
        <div className="mt-4">
          <p className="mb-1 text-xs font-semibold uppercase text-muted-foreground">Checklist de revisão</p>
          <ul className="space-y-1">
            {pb.config!.review_checklist!.map((c) => (
              <li key={c.key} className="text-xs">
                <span className="mr-1">☐</span>
                {c.label}
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}
