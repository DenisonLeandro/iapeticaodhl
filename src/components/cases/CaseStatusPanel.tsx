// =============================================================================
// CaseStatusPanel — PR-4.0A
// Painel-resumo no topo da aba Principal: cliente, responsável, contagens,
// última atualização e "próxima ação sugerida" determinística (sem IA).
// =============================================================================

import { Briefcase, CalendarClock, FileText, Lightbulb, User } from "lucide-react";
import { Link } from "react-router-dom";

interface Props {
  clientId: string | null | undefined;
  clientName: string | null | undefined;
  lawyerName: string | null | undefined;
  documentsReady: number;
  documentsTotal: number;
  lastUpdate: string | null;
  suggestion: string;
}

function formatRelative(iso: string | null): string {
  if (!iso) return "—";
  const date = new Date(iso);
  const diffMs = Date.now() - date.getTime();
  const oneDay = 24 * 60 * 60 * 1000;
  if (diffMs < oneDay && date.toDateString() === new Date().toDateString()) {
    return "hoje";
  }
  if (diffMs < 2 * oneDay) return "ontem";
  return date.toLocaleDateString("pt-BR");
}

export default function CaseStatusPanel({
  clientId,
  clientName,
  lawyerName,
  documentsReady,
  documentsTotal,
  lastUpdate,
  suggestion,
}: Props) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <InfoItem icon={User} label="Cliente">
          {clientId ? (
            <Link
              to={`/clients/${clientId}`}
              className="font-medium text-foreground hover:underline"
            >
              {clientName ?? "Cliente vinculado"}
            </Link>
          ) : (
            <span className="font-medium text-muted-foreground">Não vinculado</span>
          )}
        </InfoItem>

        <InfoItem icon={Briefcase} label="Responsável">
          <span className="font-medium text-foreground">
            {lawyerName ?? "Não atribuído"}
          </span>
        </InfoItem>

        <InfoItem icon={FileText} label="Documentos">
          <span className="font-medium text-foreground">
            {documentsReady} de {documentsTotal} prontos
          </span>
        </InfoItem>

        <InfoItem icon={CalendarClock} label="Atualizado">
          <span className="font-medium text-foreground">{formatRelative(lastUpdate)}</span>
        </InfoItem>
      </div>

      <div className="mt-5 flex items-start gap-3 rounded-lg bg-primary/5 px-4 py-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
          <Lightbulb className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Próxima ação sugerida
          </p>
          <p className="text-sm font-medium text-foreground">{suggestion}</p>
        </div>
      </div>
    </div>
  );
}

function InfoItem({
  icon: Icon,
  label,
  children,
}: {
  icon: typeof User;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
        <div className="truncate text-sm">{children}</div>
      </div>
    </div>
  );
}
