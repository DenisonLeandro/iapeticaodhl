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
  const pb = draft?.playbook_snapshot ?? null;
  const compliance = draft?.playbook_compliance ?? null;
  const rawStatus = (draft as unknown as { playbook_status?: string | null })?.playbook_status ?? null;

  // Estado amigável para o advogado comum
  const friendly = (() => {
    if (rawStatus === "playbook_error") {
      return "A peça foi gerada, mas recomenda-se revisão manual de alguns pontos.";
    }
    if (rawStatus === "playbook_partial") {
      return "A peça foi gerada, mas recomenda-se revisão manual de alguns pontos.";
    }
    if (rawStatus === "playbook_applied" || pb) {
      return "IA aplicou o padrão jurídico recomendado para este tipo de caso.";
    }
    return "Nenhum padrão jurídico específico foi encontrado. A IA gerou a peça com análise jurídica geral.";
  })();

  if (!pb) {
    return (
      <Card className="p-4">
        <h3 className="text-sm font-semibold">Padrão jurídico</h3>
        <p className="mt-1 text-xs text-muted-foreground">{friendly}</p>
      </Card>
    );
  }

  const KNOWN_STATUSES: PlaybookComplianceStatus[] = [
    "aprovado_para_revisao",
    "revisar_antes",
    "incompleto",
    "risco_alto",
  ];
  const rawComplianceStatus = compliance?.status;
  const status: PlaybookComplianceStatus =
    rawComplianceStatus && KNOWN_STATUSES.includes(rawComplianceStatus as PlaybookComplianceStatus)
      ? (rawComplianceStatus as PlaybookComplianceStatus)
      : "revisar_antes";
  const score = compliance?.score ?? 0;
  const missingBlocks = compliance?.missing_blocks ?? [];
  const missingRequests = compliance?.missing_requests ?? [];
  const missingDocuments = compliance?.missing_documents ?? [];
  const sensitiveAlerts = compliance?.sensitive_alerts ?? [];
  const totalMissing = missingBlocks.length + missingRequests.length + missingDocuments.length;
  const passed = compliance?.passed_items?.length ?? 0;
  const reviewChecklist = pb.config?.review_checklist ?? [];

  if (!compliance) {
    return (
      <Card className="p-4">
        <h3 className="text-sm font-semibold">Padrão jurídico</h3>
        <p className="mt-1 text-xs text-muted-foreground">{friendly}</p>
      </Card>
    );
  }

  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold">Padrão jurídico</h3>
          <p className="mt-1 text-xs text-muted-foreground">{friendly}</p>
        </div>
      </div>

      <details className="mt-3 text-xs">
        <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
          Ver detalhes técnicos
        </summary>
        <div className="mt-2 space-y-2">
          <p className="text-[11px] text-muted-foreground truncate" title={pb.name}>
            {pb.name} (v{pb.version})
          </p>
          <div className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-medium ${STATUS_TONE[status]}`}>
            <StatusIcon status={status} />
            <span>{score}%</span>
          </div>
          <p className="text-xs text-muted-foreground">{PLAYBOOK_STATUS_LABEL[status]}</p>
          <div className="flex flex-wrap gap-1 text-[11px] text-muted-foreground">
            <Badge variant="outline">{passed} cumpridos</Badge>
            <Badge variant="outline">{totalMissing} faltantes</Badge>
            {sensitiveAlerts.length > 0 && (
              <Badge variant="destructive">{sensitiveAlerts.length} teses sensíveis</Badge>
            )}
          </div>

          <MissingList title="Blocos faltantes" items={missingBlocks} />
          <MissingList title="Pedidos faltantes" items={missingRequests} />
          <MissingList title="Documentos faltantes" items={missingDocuments} />
          <MissingList title="Alertas de teses sensíveis" items={sensitiveAlerts} />

          {reviewChecklist.length > 0 && (
            <div className="mt-2">
              <p className="mb-1 text-xs font-semibold uppercase text-muted-foreground">Checklist de revisão</p>
              <ul className="space-y-1">
                {reviewChecklist.map((c) => (
                  <li key={c.key} className="text-xs">
                    <span className="mr-1">☐</span>
                    {c.label}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </details>
    </Card>
  );
}

