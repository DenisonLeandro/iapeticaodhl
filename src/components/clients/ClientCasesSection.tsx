import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ExternalLink, Scale } from "lucide-react";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/lib/backend/client";

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

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
        Erro ao carregar processos.
      </div>
    );
  }

  if (!cases || cases.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-border bg-muted/50 p-8 text-center">
        <Scale className="mb-3 h-10 w-10 text-muted-foreground" />
        <p className="text-muted-foreground">
          Nenhum processo vinculado a este cliente.
        </p>
      </div>
    );
  }

  return (
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
          <Link to={`/cases`}>
            <ExternalLink className="h-4 w-4 text-muted-foreground hover:text-foreground" />
          </Link>
        </div>
      ))}
    </div>
  );
}
