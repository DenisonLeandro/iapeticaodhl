import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ExternalLink, Link as LinkIcon, Plus, Scale } from "lucide-react";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/lib/backend/client";
import CaseForm from "@/components/cases/CaseForm";
import LinkExistingCaseDialog from "@/components/clients/LinkExistingCaseDialog";

interface ClientCasesSectionProps {
  clientId: string;
}

interface CaseRecord {
  id: string;
  case_number: string;
  court: string;
  subject: string | null;
  status: string;
  created_at: string;
}

const STATUS_LABELS: Record<string, string> = {
  active: "Ativo",
  archived: "Arquivado",
  closed: "Encerrado",
};

const STATUS_VARIANTS: Record<string, "default" | "secondary" | "outline"> = {
  active: "default",
  archived: "secondary",
  closed: "outline",
};

export default function ClientCasesSection({ clientId }: ClientCasesSectionProps) {
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [createFormOpen, setCreateFormOpen] = useState(false);

  const { data: cases, isLoading, error } = useQuery({
    queryKey: ["client-cases", clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cases")
        .select("id, case_number, court, subject, status, created_at")
        .eq("client_id", clientId)
        .order("created_at", { ascending: false });

      if (error) throw new Error(error.message);
      return (data as CaseRecord[]) ?? [];
    },
  });

  const Actions = (
    <div className="flex flex-wrap items-center gap-2">
      <Button size="sm" onClick={() => setCreateFormOpen(true)}>
        <Plus className="mr-2 h-4 w-4" />
        Cadastrar novo processo
      </Button>
      <Button size="sm" variant="outline" onClick={() => setLinkDialogOpen(true)}>
        <LinkIcon className="mr-2 h-4 w-4" />
        Vincular processo existente
      </Button>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-sm font-medium text-muted-foreground">
          Processos do cliente {cases ? `(${cases.length})` : ""}
        </h3>
        {Actions}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : error ? (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          Erro ao carregar processos.
        </div>
      ) : !cases || cases.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-border bg-muted/50 p-8 text-center">
          <Scale className="mb-3 h-10 w-10 text-muted-foreground" />
          <p className="mb-1 font-medium text-foreground">
            Este cliente ainda não possui processos vinculados.
          </p>
          <p className="mb-4 text-sm text-muted-foreground">
            Cadastre um processo ou vincule um processo existente.
          </p>
          {Actions}
        </div>
      ) : (
        <div className="space-y-3">
          {cases.map((c) => (
            <div
              key={c.id}
              className="flex items-center justify-between rounded-lg border border-border p-4"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{c.case_number}</span>
                  <Badge variant={STATUS_VARIANTS[c.status] ?? "outline"}>
                    {STATUS_LABELS[c.status] ?? c.status}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  {c.court}
                  {c.subject ? ` - ${c.subject}` : ""}
                </p>
                <p className="text-xs text-muted-foreground">
                  Aberto em{" "}
                  {format(new Date(c.created_at), "dd/MM/yyyy", { locale: ptBR })}
                </p>
              </div>
              <Link
                to={`/cases/${c.id}`}
                className="text-muted-foreground hover:text-foreground"
                aria-label="Abrir processo"
              >
                <ExternalLink className="h-4 w-4" />
              </Link>
            </div>
          ))}
        </div>
      )}

      <CaseForm
        defaultClientId={clientId}
        open={createFormOpen}
        onOpenChange={setCreateFormOpen}
        hideTrigger
      />

      <LinkExistingCaseDialog
        clientId={clientId}
        open={linkDialogOpen}
        onOpenChange={setLinkDialogOpen}
      />
    </div>
  );
}
