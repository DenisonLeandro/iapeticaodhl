import { useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Clock,
  Plus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useInteractions } from "@/hooks/useClientDetail";
import InteractionFormDialog from "./InteractionFormDialog";

interface ClientHistorySectionProps {
  clientId: string;
}

const PAGE_SIZE = 10;

export default function ClientHistorySection({
  clientId,
}: ClientHistorySectionProps) {
  const [page, setPage] = useState(1);
  const [formOpen, setFormOpen] = useState(false);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const { interactions, totalCount, isLoading, error } = useInteractions(
    clientId,
    { page, pageSize: PAGE_SIZE },
  );

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-20 w-full" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
        Erro ao carregar histórico de atendimentos.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Action bar */}
      <div className="flex justify-end">
        <Button onClick={() => setFormOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Novo Atendimento
        </Button>
      </div>

      {interactions.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-border bg-muted/50 p-8 text-center">
          <Clock className="mb-3 h-10 w-10 text-muted-foreground" />
          <p className="text-muted-foreground">
            Nenhum atendimento registrado para este cliente.
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Clique em &quot;Novo Atendimento&quot; para adicionar o primeiro registro.
          </p>
        </div>
      ) : (
        <>
          <div className="space-y-3">
            {interactions.map((interaction) => {
              const isExpanded = expandedIds.has(interaction.id);
              const hasLongNotes =
                interaction.notes && interaction.notes.length > 150;

              return (
                <div
                  key={interaction.id}
                  className="rounded-lg border border-border p-4"
                >
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-primary">
                          {format(
                            new Date(interaction.interaction_date),
                            "dd/MM/yyyy",
                            { locale: ptBR },
                          )}
                        </span>
                      </div>
                      <p className="font-medium">{interaction.subject}</p>
                    </div>
                  </div>
                  {interaction.notes && (
                    <div className="mt-2">
                      <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                        {isExpanded || !hasLongNotes
                          ? interaction.notes
                          : `${interaction.notes.slice(0, 150)}...`}
                      </p>
                      {hasLongNotes && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="mt-1 h-auto p-0 text-xs text-primary"
                          onClick={() => toggleExpand(interaction.id)}
                        >
                          {isExpanded ? (
                            <>
                              <ChevronUp className="mr-1 h-3 w-3" />
                              Ver menos
                            </>
                          ) : (
                            <>
                              <ChevronDown className="mr-1 h-3 w-3" />
                              Ver mais
                            </>
                          )}
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2">
              <Button
                variant="outline"
                size="icon"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm text-muted-foreground">
                Página {page} de {totalPages}
              </span>
              <Button
                variant="outline"
                size="icon"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </>
      )}

      {/* Interaction Form Dialog */}
      <InteractionFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        clientId={clientId}
      />
    </div>
  );
}
