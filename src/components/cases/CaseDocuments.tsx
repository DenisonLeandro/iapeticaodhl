import { FileText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { CaseDocument } from "@/types/case";

interface CaseDocumentsProps {
  documents: CaseDocument[];
  isLoading: boolean;
}

const STATUS_LABELS: Record<string, string> = {
  draft: "Rascunho",
  review: "Em Revisão",
  approved: "Aprovado",
  signed: "Assinado",
};

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-500 text-white hover:bg-gray-500/80 border-transparent",
  review: "bg-yellow-500 text-black hover:bg-yellow-500/80 border-transparent",
  approved: "bg-green-500 text-white hover:bg-green-500/80 border-transparent",
  signed: "bg-blue-500 text-white hover:bg-blue-500/80 border-transparent",
};

const TYPE_LABELS: Record<string, string> = {
  petition: "Petição",
  appeal: "Recurso",
  contract: "Contrato",
  notification: "Notificação",
  opinion: "Parecer",
  power_of_attorney: "Procuração",
  other: "Outro",
};

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("pt-BR");
}

export default function CaseDocuments({ documents, isLoading }: CaseDocumentsProps) {
  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    );
  }

  if (documents.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-muted/50 p-8 text-center text-muted-foreground">
        <FileText className="mx-auto h-8 w-8 mb-2 opacity-50" />
        Nenhum documento vinculado a este processo
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Título</TableHead>
            <TableHead>Tipo</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Data</TableHead>
            <TableHead>Autor</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {documents.map((doc) => (
            <TableRow key={doc.id}>
              <TableCell className="font-medium">{doc.title}</TableCell>
              <TableCell className="text-muted-foreground">
                {TYPE_LABELS[doc.type] ?? doc.type}
              </TableCell>
              <TableCell>
                <Badge className={STATUS_COLORS[doc.status] ?? ""}>
                  {STATUS_LABELS[doc.status] ?? doc.status}
                </Badge>
              </TableCell>
              <TableCell className="text-muted-foreground">
                {formatDate(doc.created_at)}
              </TableCell>
              <TableCell className="text-muted-foreground">
                {doc.creator_name ?? "—"}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
