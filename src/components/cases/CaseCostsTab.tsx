// =============================================================================
// PR-3.7 — Aba "Custos IA" dentro do processo (admin only)
// =============================================================================

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, DollarSign } from "lucide-react";
import { useCaseAICostHistory, useCaseAICostSummary } from "@/hooks/useAICosts";
import { formatBRL, formatUSD, USD_BRL_RATE } from "@/lib/ai/fx";

interface Props {
  caseId: string;
}

const PAGE = 25;

export default function CaseCostsTab({ caseId }: Props) {
  const [page, setPage] = useState(0);
  const summary = useCaseAICostSummary(caseId);
  const history = useCaseAICostHistory(caseId, page, PAGE);

  const totalUsd = summary.data?.summary.cost_usd ?? 0;
  const totalOps = summary.data?.summary.operations ?? 0;
  const pageCount = Math.max(1, Math.ceil((history.data?.total ?? 0) / PAGE));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Custo total
            </CardTitle>
          </CardHeader>
          <CardContent>
            {summary.isLoading ? (
              <Skeleton className="h-12 w-full" />
            ) : (
              <>
                <div className="text-xl font-semibold">{formatUSD(totalUsd)}</div>
                <div className="text-xs text-muted-foreground">
                  {formatBRL(totalUsd)} <span className="opacity-70">(BRL estimado · {USD_BRL_RATE})</span>
                </div>
              </>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Operações</CardTitle>
          </CardHeader>
          <CardContent>
            {summary.isLoading ? (
              <Skeleton className="h-12 w-full" />
            ) : (
              <div className="text-xl font-semibold">{totalOps}</div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Por operação</CardTitle>
          </CardHeader>
          <CardContent>
            {summary.isLoading ? (
              <Skeleton className="h-12 w-full" />
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {(summary.data?.by_operation ?? []).map((b) => (
                  <Badge key={b.operation} variant="secondary" className="text-[10px]">
                    {b.operation}: {b.operations} · {formatUSD(b.cost_usd)}
                  </Badge>
                ))}
                {!summary.data?.by_operation.length && (
                  <span className="text-xs text-muted-foreground">Sem dados.</span>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Histórico</CardTitle>
        </CardHeader>
        <CardContent>
          {history.isLoading ? (
            <Skeleton className="h-40 w-full" />
          ) : !history.data?.rows.length ? (
            <p className="text-sm text-muted-foreground">
              Nenhuma operação de IA registrada para este processo ainda.
            </p>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-muted-foreground border-b">
                      <th className="py-2 font-normal">Data</th>
                      <th className="py-2 font-normal">Operação</th>
                      <th className="py-2 font-normal">Modelo</th>
                      <th className="py-2 text-right font-normal">Tokens</th>
                      <th className="py-2 text-right font-normal">USD</th>
                      <th className="py-2 font-normal">Usuário</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.data.rows.map((r) => (
                      <tr key={r.id} className="border-t border-border/50">
                        <td className="py-1.5 text-xs whitespace-nowrap">
                          {new Date(r.created_at).toLocaleString("pt-BR")}
                        </td>
                        <td className="py-1.5">
                          <Badge variant="outline" className="text-[10px]">{r.operation}</Badge>
                        </td>
                        <td className="py-1.5 text-xs font-mono truncate max-w-[180px]">{r.model}</td>
                        <td className="py-1.5 text-right text-xs">
                          {r.tokens_input}/{r.tokens_output}
                        </td>
                        <td className="py-1.5 text-right font-mono text-xs">
                          {formatUSD(r.cost_estimated)}
                        </td>
                        <td className="py-1.5 text-xs">{r.user_name ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex items-center justify-between pt-3">
                <span className="text-xs text-muted-foreground">
                  Página {page + 1} de {pageCount} · {history.data.total} registros
                </span>
                <div className="flex gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page === 0}
                    onClick={() => setPage((p) => Math.max(0, p - 1))}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page + 1 >= pageCount}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
