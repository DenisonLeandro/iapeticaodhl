import { AlertTriangle, FileText, FileWarning, ScrollText, Scale } from "lucide-react";
import type { ClaimMapClaim } from "@/types/caseClaimMap";
import {
  ApplicabilityBadge,
  ConfidenceBadge,
  RecommendedActionBadge,
  RiskBadge,
} from "./ClaimBadges";
import { Button } from "@/components/ui/button";

interface Props {
  claim: ClaimMapClaim;
}

function List({
  title,
  icon: Icon,
  items,
  emptyText,
  tone = "default",
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  items: string[];
  emptyText?: string;
  tone?: "default" | "warning" | "danger";
}) {
  const wrapperCls =
    tone === "danger"
      ? "border-destructive/40 bg-destructive/5"
      : tone === "warning"
      ? "border-amber-500/40 bg-amber-500/5"
      : "border-border bg-muted/30";
  return (
    <div className={`rounded-lg border p-3 ${wrapperCls}`}>
      <div className="mb-1.5 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        {title}
      </div>
      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground">{emptyText ?? "—"}</p>
      ) : (
        <ul className="space-y-1 text-sm text-foreground">
          {items.map((it, i) => (
            <li key={i} className="leading-snug">
              • {it}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function ClaimCard({ claim }: Props) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h3 className="font-display text-base font-semibold text-foreground">
              {claim.title}
            </h3>
            <p className="text-xs text-muted-foreground">
              Categoria: {claim.category} · ID: {claim.id}
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <ApplicabilityBadge value={claim.applicability} />
            <ConfidenceBadge value={claim.confidence} />
            <RiskBadge value={claim.risk_level} />
            <RecommendedActionBadge value={claim.recommended_action} />
          </div>
        </div>

        {claim.requires_lawyer_confirmation && (
          <div className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-2.5 text-xs text-amber-900 dark:text-amber-200">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>Requer confirmação do advogado antes de incluir na petição.</span>
          </div>
        )}

        {claim.warnings.length > 0 && (
          <List
            title="Alertas"
            icon={FileWarning}
            items={claim.warnings}
            tone="warning"
          />
        )}

        <div className="grid gap-2 sm:grid-cols-2">
          <List
            title="Fatos que sustentam"
            icon={ScrollText}
            items={claim.facts_supporting}
            emptyText="Nenhum fato identificado."
          />
          <List
            title="Fundamentos legais"
            icon={Scale}
            items={claim.legal_basis}
            emptyText="Nenhum fundamento indicado."
          />
          <List
            title="Documentos usados"
            icon={FileText}
            items={claim.documents_supporting}
            emptyText="Nenhum documento vinculado."
          />
          <List
            title="Documentos faltantes"
            icon={FileWarning}
            items={claim.missing_documents}
            emptyText="Sem pendências documentais."
            tone={claim.missing_documents.length > 0 ? "warning" : "default"}
          />
        </div>

        <div className="flex flex-wrap gap-3 border-t border-border pt-3 text-xs text-muted-foreground">
          <span>
            Capítulo de mérito:{" "}
            <strong className="text-foreground">
              {claim.should_generate_merit_section ? "Sim" : "Não"}
            </strong>
          </span>
          <span>
            Pedido:{" "}
            <strong className="text-foreground">
              {claim.should_include_in_prayer_list ? "Sim" : "Não"}
            </strong>
          </span>
          <span>
            Requerimentos finais:{" "}
            <strong className="text-foreground">
              {claim.should_include_in_final_requests ? "Sim" : "Não"}
            </strong>
          </span>
        </div>

        <div className="flex flex-wrap gap-2 border-t border-border pt-3">
          <Button size="sm" variant="outline" disabled>
            Aprovar (em breve)
          </Button>
          <Button size="sm" variant="outline" disabled>
            Rejeitar (em breve)
          </Button>
          <Button size="sm" variant="outline" disabled>
            Preciso de mais informação (em breve)
          </Button>
        </div>
      </div>
    </div>
  );
}
