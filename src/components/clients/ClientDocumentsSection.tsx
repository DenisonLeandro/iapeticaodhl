import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { FileText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/lib/backend/client";

interface ClientDocumentsSectionProps {
  clientId: string;
}

interface DocumentRecord {
  id: string;
  title: string;
  type: string;
  status: string;
  created_at: string;
}

const DOC_TYPE_LABELS: Record<string, string> = {
  petition: "Petição",
  appeal: "Recurso",
  contract: "Contrato",
  notification: "Notificação",
  opinion: "Parecer",
  power_of_attorney: "Procuração",
  other: "Outro",
};

const STATUS_LABELS: Record<string, string> = {
  draft: "Rascunho",
  review: "Em revisão",
  approved: "Aprovado",
  signed: "Assinado",
};

export default function ClientDocumentsSection({
  clientId,
}: ClientDocumentsSectionProps) {
  const { data: documents, isLoading, error } = useQuery({
    queryKey: ["client-documents", clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("documents")
        .select("id, title, type, status, created_at")
        .eq("client_id", clientId)
        .order("created_at", { ascending: false });

      if (error) throw new Error(error.message);
      return (data as unknown as DocumentRecord[]) ?? [];
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
        Erro ao carregar documentos.
      </div>
    );
  }

  if (!documents || documents.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-border bg-muted/50 p-8 text-center">
        <FileText className="mb-3 h-10 w-10 text-muted-foreground" />
        <p className="text-muted-foreground">
          Nenhum documento gerado para este cliente.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {documents.map((doc) => (
        <div
          key={doc.id}
          className="flex items-center justify-between rounded-lg border border-border p-4"
        >
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">{doc.title}</span>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline">
                {DOC_TYPE_LABELS[doc.type] ?? doc.type}
              </Badge>
              <Badge variant="secondary">
                {STATUS_LABELS[doc.status] ?? doc.status}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Criado em{" "}
              {format(new Date(doc.created_at), "dd/MM/yyyy", { locale: ptBR })}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
