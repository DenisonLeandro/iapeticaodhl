import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ExternalLink, Check, Mail } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import type { PublicationWithCase } from "@/types/publication";

interface Props {
  publication: PublicationWithCase | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onToggleRead: (pub: PublicationWithCase) => void;
  onOpenCase?: (caseId: string) => void;
}

export default function PublicationDetailDialog({
  publication,
  open,
  onOpenChange,
  onToggleRead,
  onOpenCase,
}: Props) {
  if (!publication) return null;

  const dateLabel = (() => {
    try {
      return format(new Date(publication.publication_date), "dd 'de' MMMM 'de' yyyy", {
        locale: ptBR,
      });
    } catch {
      return publication.publication_date;
    }
  })();

  const safeContent = (publication.content ?? "").trim() || "(Sem conteúdo disponível)";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 flex-wrap">
            Publicação Judicial
            <Badge variant="outline">{publication.source.toUpperCase()}</Badge>
            {!publication.read && (
              <Badge className="bg-primary">Não lida</Badge>
            )}
          </DialogTitle>
          <DialogDescription>
            {dateLabel} · Advogado: {publication.lawyer_name}
          </DialogDescription>
        </DialogHeader>

        <Separator />

        <ScrollArea className="flex-1 pr-4">
          <div className="text-sm whitespace-pre-wrap leading-relaxed text-foreground">
            {safeContent}
          </div>

          {publication.matched_case_number && (
            <div className="mt-4 text-xs text-muted-foreground">
              <strong>Número detectado:</strong> {publication.matched_case_number}
            </div>
          )}
        </ScrollArea>

        <DialogFooter className="gap-2 sm:gap-2">
          {publication.case && onOpenCase && (
            <Button
              variant="outline"
              onClick={() => onOpenCase(publication.case!.id)}
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              Abrir processo {publication.case.case_number}
            </Button>
          )}
          <Button
            variant="default"
            onClick={() => onToggleRead(publication)}
          >
            {publication.read ? (
              <>
                <Mail className="h-4 w-4 mr-2" />
                Marcar como não lida
              </>
            ) : (
              <>
                <Check className="h-4 w-4 mr-2" />
                Marcar como lida
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
