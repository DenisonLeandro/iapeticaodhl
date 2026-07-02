import { FileText, FileSignature, Archive, Copy, Loader2 } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { useArchiveDraft, useCaseDrafts } from "@/hooks/useCaseDrafts";
import { CASE_DRAFT_TYPE_LABEL, type CaseDraftType } from "@/types/caseDraft";

interface CaseDocumentsProps {
  documents: CaseDocument[];
  isLoading: boolean;
}

const STATUS_LABELS: Record<string, string> = {
  draft: "Rascunho",
  review: "Em Revisão",
  approved: "Aprovado",
  signed: "Assinado",
  archived: "Arquivada",
};

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-500 text-white hover:bg-gray-500/80 border-transparent",
  review: "bg-yellow-500 text-black hover:bg-yellow-500/80 border-transparent",
  approved: "bg-green-500 text-white hover:bg-green-500/80 border-transparent",
  signed: "bg-blue-500 text-white hover:bg-blue-500/80 border-transparent",
  archived: "bg-slate-400 text-white hover:bg-slate-400/80 border-transparent",
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
  const navigate = useNavigate();
  const { id: caseId } = useParams<{ id: string }>();
  const { data: drafts = [], isLoading: draftsLoading } = useCaseDrafts(caseId);
  const archive = useArchiveDraft();

  const handleCopy = async (content: string) => {
    try {
      await navigator.clipboard.writeText(content);
      toast.success("Minuta copiada com sucesso.");
    } catch {
      toast.error("Não foi possível copiar.");
    }
  };

  const handleArchive = async (id: string) => {
    try {
      await archive.mutateAsync(id);
      toast.success("Minuta arquivada.");
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <div className="space-y-8">
      {/* Minutas do caso — PR-4.4B */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileSignature className="h-4 w-4 text-primary" />
            <h3 className="font-display text-base font-semibold">Minutas do caso</h3>
            <Badge variant="secondary">{drafts.length}</Badge>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => caseId && navigate(`/cases/${caseId}/drafts/new`)}
          >
            Nova minuta
          </Button>
        </div>

        {draftsLoading ? (
          <Skeleton className="h-16 w-full" />
        ) : drafts.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border bg-muted/30 p-6 text-center text-sm text-muted-foreground">
            Nenhuma minuta gerada ainda. Use "Gerar Peça" no painel principal.
          </div>
        ) : (
          <div className="rounded-lg border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Título</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Criado em</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {drafts.map((d) => (
                  <TableRow key={d.id} className="hover:bg-muted/40">
                    <TableCell
                      className="cursor-pointer font-medium"
                      onClick={() => navigate(`/cases/${caseId}/drafts/${d.id}`)}
                    >
                      {d.title || "(sem título)"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {CASE_DRAFT_TYPE_LABEL[d.draft_type as CaseDraftType] ?? d.draft_type}
                    </TableCell>
                    <TableCell>
                      <Badge className={STATUS_COLORS[d.status] ?? ""}>
                        {STATUS_LABELS[d.status] ?? d.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDate(d.created_at)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button size="sm" variant="ghost" onClick={() => handleCopy(d.content)}>
                          <Copy className="h-3.5 w-3.5" />
                        </Button>
                        {d.status !== "archived" && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleArchive(d.id)}
                            disabled={archive.isPending}
                          >
                            {archive.isPending ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Archive className="h-3.5 w-3.5" />
                            )}
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>

      {/* Documentos legados (peças anteriores) */}
      <section>
        <div className="mb-3 flex items-center gap-2">
          <FileText className="h-4 w-4 text-muted-foreground" />
          <h3 className="font-display text-base font-semibold">Peças anteriores</h3>
          <Badge variant="outline">{documents.length}</Badge>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : documents.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border bg-muted/30 p-6 text-center text-sm text-muted-foreground">
            Nenhuma peça anterior vinculada a este processo.
          </div>
        ) : (
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
                  <TableRow
                    key={doc.id}
                    className="cursor-pointer hover:bg-muted/40"
                    onClick={() => navigate(`/ai/documents/${doc.id}/edit`)}
                  >
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
        )}
      </section>
    </div>
  );
}
