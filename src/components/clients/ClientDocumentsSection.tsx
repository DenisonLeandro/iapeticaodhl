import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { FileText, Paperclip } from "lucide-react";
import { Link } from "react-router-dom";
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
  case_id: string | null;
  represented_party: string | null;
  source_file_ids: string[] | null;
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
        .select("id, title, type, status, created_at, case_id, represented_party, source_file_ids")
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
      {documents.map((doc) => {
        const filesCount = doc.source_file_ids?.length ?? 0;
        return (
          <Link
            to={`/ai/documents/${doc.id}/edit`}
            key={doc.id}
            className="flex items-center justify-between rounded-lg border border-border p-4 transition-colors hover:border-primary/40 hover:bg-muted/40"
          >
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">{doc.title}</span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline">
                  {DOC_TYPE_LABELS[doc.type] ?? doc.type}
                </Badge>
                <Badge variant="secondary">
                  {STATUS_LABELS[doc.status] ?? doc.status}
                </Badge>
                {doc.represented_party && (
                  <Badge variant="outline" className="capitalize">
                    representa: {doc.represented_party}
                  </Badge>
                )}
                {filesCount > 0 && (
                  <Badge variant="outline" className="gap-1">
                    <Paperclip className="h-3 w-3" />
                    {filesCount} PDF{filesCount > 1 ? "s" : ""}
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Criado em{" "}
                {format(new Date(doc.created_at), "dd/MM/yyyy", { locale: ptBR })}
              </p>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
