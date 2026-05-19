import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, RefreshCw, CheckCheck, Loader2, Inbox } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  usePublications,
  useMarkPublicationRead,
  useMarkAllPublicationsRead,
  useTriggerScraper,
  useUnreadPublicationsCount,
} from "@/hooks/usePublications";
import PublicationCard from "@/components/publications/PublicationCard";
import PublicationFiltersBar from "@/components/publications/PublicationFilters";
import PublicationDetailDialog from "@/components/publications/PublicationDetailDialog";
import type {
  PublicationFilters,
  PublicationWithCase,
} from "@/types/publication";
import { PUBLICATIONS_PAGE_SIZE } from "@/services/publications";

export default function PublicationsPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [filters, setFilters] = useState<PublicationFilters>({
    read: "all",
    source: "all",
    search: "",
  });
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<PublicationWithCase | null>(null);

  const listQuery = usePublications(filters, page);
  const unreadQuery = useUnreadPublicationsCount();
  const markRead = useMarkPublicationRead();
  const markAll = useMarkAllPublicationsRead();
  const scraper = useTriggerScraper();

  const totalPages = useMemo(() => {
    const c = listQuery.data?.count ?? 0;
    return Math.max(1, Math.ceil(c / PUBLICATIONS_PAGE_SIZE));
  }, [listQuery.data?.count]);

  const handleToggleRead = (pub: PublicationWithCase) => {
    markRead.mutate(
      { id: pub.id, read: !pub.read },
      {
        onSuccess: () => {
          if (selected?.id === pub.id) {
            setSelected({ ...pub, read: !pub.read });
          }
        },
        onError: (err: Error) => {
          toast({
            title: "Erro ao atualizar publicação",
            description: err.message,
            variant: "destructive",
          });
        },
      },
    );
  };

  const handleOpenCase = (caseId: string) => {
    navigate(`/cases/${caseId}`);
  };

  const handleMarkAll = () => {
    markAll.mutate(undefined, {
      onSuccess: () =>
        toast({ title: "Todas as publicações marcadas como lidas" }),
      onError: (err: Error) =>
        toast({
          title: "Erro",
          description: err.message,
          variant: "destructive",
        }),
    });
  };

  const handleTriggerScraper = () => {
    scraper.mutate(undefined, {
      onSuccess: (data) =>
        toast({
          title: "Busca concluída",
          description: `${data.publications_saved ?? 0} novas publicações encontradas.`,
        }),
      onError: (err: Error) =>
        toast({
          title: "Erro ao buscar publicações",
          description: err.message,
          variant: "destructive",
        }),
    });
  };

  const items = listQuery.data?.data ?? [];
  const isLoading = listQuery.isLoading;
  const isError = listQuery.isError;
  const unread = unreadQuery.data ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold flex items-center gap-2">
            <Bell className="h-6 w-6 text-primary" />
            Publicações Judiciais
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Acompanhe publicações capturadas automaticamente do DJEN.
            {unread > 0 && (
              <>
                {" "}
                <span className="text-primary font-medium">
                  {unread} não lida{unread > 1 ? "s" : ""}
                </span>
                .
              </>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={handleMarkAll}
            disabled={markAll.isPending || unread === 0}
          >
            <CheckCheck className="h-4 w-4 mr-2" />
            Marcar todas como lidas
          </Button>
          <Button onClick={handleTriggerScraper} disabled={scraper.isPending}>
            {scraper.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            Buscar publicações agora
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-4">
          <PublicationFiltersBar
            value={filters}
            onChange={(next) => {
              setFilters(next);
              setPage(0);
            }}
          />
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-32 w-full" />
          ))}
        </div>
      ) : isError ? (
        <Card>
          <CardContent className="p-8 text-center space-y-3">
            <p className="text-destructive font-medium">
              Erro ao carregar publicações
            </p>
            <p className="text-sm text-muted-foreground">
              {(listQuery.error as Error)?.message}
            </p>
            <Button variant="outline" onClick={() => listQuery.refetch()}>
              Tentar novamente
            </Button>
          </CardContent>
        </Card>
      ) : items.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center space-y-3">
            <Inbox className="h-12 w-12 mx-auto text-muted-foreground" />
            <h3 className="font-semibold">Nenhuma publicação encontrada</h3>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              Quando o DJEN/DataJud capturar publicações vinculadas aos seus
              processos, elas aparecerão aqui. Você pode acionar a busca manualmente
              acima.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {items.map((pub) => (
            <PublicationCard
              key={pub.id}
              publication={pub}
              onOpen={setSelected}
              onToggleRead={handleToggleRead}
              onOpenCase={handleOpenCase}
            />
          ))}

          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-4">
              <Button
                variant="outline"
                size="sm"
                disabled={page === 0}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
              >
                Anterior
              </Button>
              <span className="text-sm text-muted-foreground">
                Página {page + 1} de {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages - 1}
                onClick={() => setPage((p) => p + 1)}
              >
                Próxima
              </Button>
            </div>
          )}
        </div>
      )}

      <PublicationDetailDialog
        publication={selected}
        open={!!selected}
        onOpenChange={(o) => !o && setSelected(null)}
        onToggleRead={handleToggleRead}
        onOpenCase={handleOpenCase}
      />
    </div>
  );
}
