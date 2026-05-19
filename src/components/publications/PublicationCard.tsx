import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { FileText, Check, ExternalLink, Mail } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { PublicationWithCase } from "@/types/publication";

interface PublicationCardProps {
  publication: PublicationWithCase;
  onOpen: (pub: PublicationWithCase) => void;
  onToggleRead: (pub: PublicationWithCase) => void;
  onOpenCase?: (caseId: string) => void;
}

const SOURCE_LABEL: Record<string, string> = {
  djen: "DJEN",
  dje_pe: "DJE-PE",
  dje_sp: "DJE-SP",
  dje_rj: "DJE-RJ",
};

export default function PublicationCard({
  publication,
  onOpen,
  onToggleRead,
  onOpenCase,
}: PublicationCardProps) {
  const dateLabel = (() => {
    try {
      return format(new Date(publication.publication_date), "dd 'de' MMMM 'de' yyyy", {
        locale: ptBR,
      });
    } catch {
      return publication.publication_date;
    }
  })();

  const safeContent = (publication.content ?? "").trim() || "(Sem conteúdo)";
  const preview =
    safeContent.length > 320 ? `${safeContent.slice(0, 320)}…` : safeContent;

  return (
    <Card
      className={cn(
        "transition-all hover:border-primary/50 cursor-pointer",
        !publication.read && "border-primary/40 bg-primary/[0.03]",
      )}
      onClick={() => onOpen(publication)}
    >
      <CardContent className="p-5 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className="gap-1">
              <FileText className="h-3 w-3" />
              {SOURCE_LABEL[publication.source] ?? publication.source}
            </Badge>
            <span className="text-sm text-muted-foreground">{dateLabel}</span>
            {!publication.read && (
              <Badge variant="default" className="bg-primary">
                Não lida
              </Badge>
            )}
          </div>

          <Button
            size="sm"
            variant="ghost"
            onClick={(e) => {
              e.stopPropagation();
              onToggleRead(publication);
            }}
            className="shrink-0"
          >
            {publication.read ? (
              <>
                <Mail className="h-4 w-4 mr-1" />
                Marcar como não lida
              </>
            ) : (
              <>
                <Check className="h-4 w-4 mr-1" />
                Marcar como lida
              </>
            )}
          </Button>
        </div>

        <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
          {preview}
        </p>

        <div className="flex items-center gap-3 text-xs text-muted-foreground pt-1">
          <span>
            <strong>Advogado:</strong> {publication.lawyer_name}
          </span>
          {publication.case && onOpenCase ? (
            <Button
              size="sm"
              variant="link"
              className="h-auto p-0 text-xs"
              onClick={(e) => {
                e.stopPropagation();
                onOpenCase(publication.case!.id);
              }}
            >
              <ExternalLink className="h-3 w-3 mr-1" />
              Processo {publication.case.case_number}
            </Button>
          ) : publication.matched_case_number ? (
            <span>
              <strong>Processo:</strong> {publication.matched_case_number}
            </span>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
