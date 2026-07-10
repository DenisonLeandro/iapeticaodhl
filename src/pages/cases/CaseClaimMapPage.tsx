import { useMemo, useState } from "react";
import ConfirmAICostDialog from "@/components/ai/ConfirmAICostDialog";
import { Link, useParams } from "react-router-dom";
import { toast } from "sonner";
import { AlertTriangle, ArrowLeft, ListChecks, RefreshCw, Sparkles } from "lucide-react";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useBuildClaimMap, useCurrentClaimMap } from "@/hooks/useCaseClaimMap";
import { useCaseDetail } from "@/hooks/useCaseDetail";
import { CLAIM_MAP_STATUS_LABEL, type ClaimMapClaim } from "@/types/caseClaimMap";
import ClaimCard from "@/components/cases/claim-map/ClaimCard";

export default function CaseClaimMapPage() {
  const { caseId } = useParams<{ caseId: string }>();
  const { caseData } = useCaseDetail(caseId);
  const { data: map, isLoading } = useCurrentClaimMap(caseId);
  const build = useBuildClaimMap();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const grouped = useMemo(() => {
    const groups = new Map<string, ClaimMapClaim[]>();
    for (const c of map?.claims ?? []) {
      const key = c.category || "outros";
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(c);
    }
    return Array.from(groups.entries());
  }, [map?.claims]);

  const doBuild = async () => {
    if (!caseId) return;
    try {
      await build.mutateAsync(caseId);
      toast.success("Mapa gerado com sucesso.");
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const handleBuild = () => setConfirmOpen(true);

  const headerTitle = caseData?.case_number || caseData?.subject || "Caso";

  return (
    <div className="space-y-6">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link to="/cases">Processos</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link to={`/cases/${caseId}`}>{headerTitle}</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Mapa de Pedidos e Riscos</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-display text-2xl font-bold text-foreground">
              Mapa de Pedidos e Riscos
            </h1>
            {map && (
              <Badge variant="outline">
                v{map.version} · {CLAIM_MAP_STATUS_LABEL[map.status] ?? map.status}
              </Badge>
            )}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Estrutura jurídica preliminar do caso. Somente leitura nesta versão — decisões do
            advogado serão liberadas em etapa futura.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="ghost" size="sm" asChild>
            <Link to={`/cases/${caseId}`}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Voltar para o caso
            </Link>
          </Button>
          <Button onClick={handleBuild} disabled={build.isPending}>
            {map ? (
              <>
                <RefreshCw className={`mr-2 h-4 w-4 ${build.isPending ? "animate-spin" : ""}`} />
                {build.isPending ? "Gerando..." : "Regerar Mapa"}
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-4 w-4" />
                {build.isPending ? "Gerando..." : "Gerar Mapa de Pedidos e Riscos"}
              </>
            )}
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
      ) : !map ? (
        <div className="rounded-xl border border-dashed border-border bg-muted/20 p-10 text-center">
          <ListChecks className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
          <h2 className="font-display text-lg font-semibold text-foreground">
            Nenhum mapa gerado ainda
          </h2>
          <p className="mx-auto mt-2 max-w-lg text-sm text-muted-foreground">
            Gere um mapa estruturado dos pedidos, riscos e documentos aplicáveis ao caso
            antes de partir para a redação da petição.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {(map.global_warnings.length > 0 || map.missing_case_data.length > 0) && (
            <div className="grid gap-3 sm:grid-cols-2">
              {map.global_warnings.length > 0 && (
                <div className="rounded-xl border border-amber-500/40 bg-amber-500/5 p-4">
                  <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-amber-800 dark:text-amber-300">
                    <AlertTriangle className="h-4 w-4" />
                    Alertas gerais
                  </div>
                  <ul className="space-y-1 text-sm text-foreground">
                    {map.global_warnings.map((w, i) => (
                      <li key={i}>• {w}</li>
                    ))}
                  </ul>
                </div>
              )}
              {map.missing_case_data.length > 0 && (
                <div className="rounded-xl border border-border bg-muted/30 p-4">
                  <div className="mb-2 text-sm font-semibold text-foreground">
                    Dados do caso que estão faltando
                  </div>
                  <ul className="space-y-1 text-sm text-foreground">
                    {map.missing_case_data.map((m, i) => (
                      <li key={i}>• {m}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {grouped.map(([category, claims]) => (
            <section key={category} className="space-y-3">
              <h2 className="font-display text-lg font-semibold capitalize text-foreground">
                {category.replace(/_/g, " ")}{" "}
                <span className="text-sm font-normal text-muted-foreground">
                  ({claims.length})
                </span>
              </h2>
              <div className="grid gap-3">
                {claims.map((c) => (
                  <ClaimCard key={c.id} claim={c} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
      <ConfirmAICostDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={map ? "Regerar Mapa de Pedidos e Riscos?" : "Gerar Mapa de Pedidos e Riscos?"}
        description="Esta ação processa todo o contexto do caso com IA e pode consumir créditos. Deseja continuar?"
        estimatedCalls={1}
        model="gemini-2.5-pro"
        costLevel="Muito Alto"
        confirmLabel={map ? "Regerar mapa" : "Gerar mapa"}
        onConfirm={() => { setConfirmOpen(false); void doBuild(); }}
      />
    </div>
  );
}
