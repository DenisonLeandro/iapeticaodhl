import { useState } from "react";
import {
  FileText,
  Gavel,
  Calendar,
  FileUp,
  MoreHorizontal,
  Scale,
  RotateCcw,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import type { CaseMovement, MovementType } from "@/types/case";
import {
  MOVEMENT_TYPE_LABELS,
  MOVEMENT_TYPE_COLORS,
  MOVEMENT_DOT_COLORS,
} from "@/types/case";
import MovementForm from "@/components/cases/MovementForm";

interface CaseTimelineProps {
  movements: CaseMovement[];
  isLoading: boolean;
  caseId: string;
}

const MOVEMENT_ICONS: Record<MovementType, React.ElementType> = {
  peticao: FileUp,
  despacho: FileText,
  decisao: Scale,
  sentenca: Gavel,
  audiencia: Calendar,
  recurso: RotateCcw,
  outro: MoreHorizontal,
};

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function TimelineSkeleton() {
  return (
    <div className="space-y-6">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="flex gap-4">
          <Skeleton className="h-4 w-4 rounded-full flex-shrink-0" />
          <div className="space-y-2 flex-1">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-full" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function CaseTimeline({ movements, isLoading, caseId }: CaseTimelineProps) {
  const [showAll, setShowAll] = useState(false);

  const INITIAL_COUNT = 10;
  const displayedMovements = showAll ? movements : movements.slice(0, INITIAL_COUNT);
  const hasMore = movements.length > INITIAL_COUNT;

  if (isLoading) {
    return <TimelineSkeleton />;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Timeline de Movimentações</h3>
        <MovementForm caseId={caseId} />
      </div>

      {movements.length === 0 ? (
        <div className="rounded-lg border border-border bg-muted/50 p-8 text-center text-muted-foreground">
          Nenhuma movimentação registrada
        </div>
      ) : (
        <div className="relative">
          {displayedMovements.map((movement, index) => {
            const Icon = MOVEMENT_ICONS[movement.type];
            const isLast = index === displayedMovements.length - 1;

            return (
              <div
                key={movement.id}
                className={`relative pl-8 pb-8 ${!isLast ? "border-l-2 border-muted" : ""}`}
                style={{ marginLeft: "7px" }}
              >
                {/* Dot indicator */}
                <div
                  className={`absolute -left-2 w-4 h-4 rounded-full ${MOVEMENT_DOT_COLORS[movement.type]} flex items-center justify-center ring-4 ring-background`}
                >
                  <Icon className="h-2.5 w-2.5 text-white" />
                </div>

                {/* Content */}
                <div className="ml-4 rounded-lg border border-border bg-card p-4 shadow-sm">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge className={MOVEMENT_TYPE_COLORS[movement.type]}>
                      {MOVEMENT_TYPE_LABELS[movement.type]}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {formatDate(movement.movement_date)}
                    </span>
                  </div>
                  <p className="text-sm text-foreground">{movement.description}</p>
                  {movement.creator_name && (
                    <p className="text-xs text-muted-foreground mt-2">
                      Registrado por {movement.creator_name}
                    </p>
                  )}
                </div>
              </div>
            );
          })}

          {hasMore && !showAll && (
            <div className="text-center pt-2">
              <button
                type="button"
                onClick={() => setShowAll(true)}
                className="text-sm text-primary hover:underline"
              >
                Ver mais {movements.length - INITIAL_COUNT} movimentações
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
