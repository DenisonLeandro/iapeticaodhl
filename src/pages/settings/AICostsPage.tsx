// =============================================================================
// PR-3.7 — Dashboard de Custos da IA (admin only)
// =============================================================================

import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { Navigate } from "react-router-dom";
import { Download, TrendingUp, Activity, DollarSign } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  useAICostBreakdown,
  useAICostDaily,
  useAICostSummaries,
  useAICostTopCases,
  useAICostTopClients,
  useAICostTopUsers,
} from "@/hooks/useAICosts";
import { formatBRL, formatUSD, USD_BRL_RATE } from "@/lib/ai/fx";
import { downloadCSV, toCSV } from "@/services/aiCosts";

function SummaryCard({
  title,
  ops,
  usd,
  isLoading,
}: {
  title: string;
  ops: number;
  usd: number;
  isLoading: boolean;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-16 w-full" />
        ) : (
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-muted-foreground" />
              <span className="text-2xl font-semibold">{ops}</span>
              <span className="text-xs text-muted-foreground">operações</span>
            </div>
            <div className="text-base font-semibold">{formatUSD(usd)}</div>
            <div className="text-xs text-muted-foreground">
              {formatBRL(usd)} <span className="opacity-70">(BRL estimado · taxa {USD_BRL_RATE})</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function TopList({
  title,
  rows,
  isLoading,
}: {
  title: string;
  rows: { id: string; label: string; operations: number; cost_usd: number }[] | undefined;
  isLoading: boolean;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {isLoading ? (
          <Skeleton className="h-32 w-full" />
        ) : !rows?.length ? (
          <p className="text-xs text-muted-foreground">Sem dados no período.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-muted-foreground">
                <th className="py-1 font-normal">#</th>
                <th className="py-1 font-normal">Identificação</th>
                <th className="py-1 text-right font-normal">Ops</th>
                <th className="py-1 text-right font-normal">USD</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.id} className="border-t border-border/50">
                  <td className="py-1.5 text-muted-foreground">{i + 1}</td>
                  <td className="py-1.5 truncate max-w-[200px]">{r.label}</td>
                  <td className="py-1.5 text-right">{r.operations}</td>
                  <td className="py-1.5 text-right font-mono text-xs">
                    {formatUSD(r.cost_usd)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </CardContent>
    </Card>
  );
}

export default function AICostsPage() {
  const { profile } = useAuth();
  const [days, setDays] = useState<number>(30);

  const summaries = useAICostSummaries();
  const daily = useAICostDaily(days);
  const breakdown = useAICostBreakdown(days);
  const topUsers = useAICostTopUsers(days);
  const topCases = useAICostTopCases(days);
  const topClients = useAICostTopClients(days);

  // Bloqueio de admin (defesa em profundidade — UI já oculta a aba)
  if (profile && profile.role !== "admin") {
    return <Navigate to="/settings" replace />;
  }

  const dailyByDay = useMemo(() => {
    const map = new Map<string, { day: string; cost_usd: number; operations: number }>();
    for (const d of daily.data ?? []) {
      const cur = map.get(d.day) ?? { day: d.day, cost_usd: 0, operations: 0 };
      cur.cost_usd += d.cost_usd;
      cur.operations += d.operations;
      map.set(d.day, cur);
    }
    return [...map.values()].sort((a, b) => (a.day < b.day ? -1 : 1));
  }, [daily.data]);

  const handleExport = () => {
    const rows = (daily.data ?? []).map((d) => ({
      day: d.day,
      operation: d.operation,
      operations: d.operations,
      tokens_input: d.tokens_input,
      tokens_output: d.tokens_output,
      cost_usd: d.cost_usd.toFixed(6),
      cost_brl_estimated: (d.cost_usd * USD_BRL_RATE).toFixed(4),
    }));
    downloadCSV(`ai-costs-${days}d-${Date.now()}.csv`, toCSV(rows));
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-semibold flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Custos da IA
          </h2>
          <p className="text-sm text-muted-foreground">
            Telemetria financeira e operacional. Custos reais em USD. BRL exibido como
            estimativa.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Tabs value={String(days)} onValueChange={(v) => setDays(Number(v))}>
            <TabsList>
              <TabsTrigger value="7">7 dias</TabsTrigger>
              <TabsTrigger value="30">30 dias</TabsTrigger>
            </TabsList>
          </Tabs>
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="mr-2 h-4 w-4" />
            Exportar CSV
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <SummaryCard
          title="Hoje"
          ops={summaries.data?.today.operations ?? 0}
          usd={summaries.data?.today.cost_usd ?? 0}
          isLoading={summaries.isLoading}
        />
        <SummaryCard
          title="Últimos 7 dias"
          ops={summaries.data?.d7.operations ?? 0}
          usd={summaries.data?.d7.cost_usd ?? 0}
          isLoading={summaries.isLoading}
        />
        <SummaryCard
          title="Últimos 30 dias"
          ops={summaries.data?.d30.operations ?? 0}
          usd={summaries.data?.d30.cost_usd ?? 0}
          isLoading={summaries.isLoading}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <TrendingUp className="h-4 w-4" />
            Custo diário (USD)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {daily.isLoading ? (
            <Skeleton className="h-72 w-full" />
          ) : dailyByDay.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Sem dados de telemetria no período. Use o Chat IA ou processe um documento.
            </p>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={dailyByDay}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="day" stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 11 }} />
                  <YAxis stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{
                      background: "hsl(var(--background))",
                      border: "1px solid hsl(var(--border))",
                    }}
                    formatter={(v: number) => formatUSD(v)}
                  />
                  <Legend />
                  <Line type="monotone" dataKey="cost_usd" name="USD" stroke="hsl(var(--primary))" />
                </LineChart>
              </ResponsiveContainer>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={dailyByDay}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="day" stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 11 }} />
                  <YAxis stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{
                      background: "hsl(var(--background))",
                      border: "1px solid hsl(var(--border))",
                    }}
                  />
                  <Legend />
                  <Bar dataKey="operations" name="Operações" fill="hsl(var(--primary))" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Por operação ({days} dias)</CardTitle>
        </CardHeader>
        <CardContent>
          {breakdown.isLoading ? (
            <Skeleton className="h-20 w-full" />
          ) : !breakdown.data?.length ? (
            <p className="text-sm text-muted-foreground">Sem dados no período.</p>
          ) : (
            <div className="flex flex-wrap gap-3">
              {breakdown.data.map((b) => (
                <div key={b.operation} className="rounded-md border bg-card px-3 py-2">
                  <Badge variant="secondary" className="mb-1">{b.operation}</Badge>
                  <div className="text-sm">{b.operations} ops</div>
                  <div className="font-mono text-xs">{formatUSD(b.cost_usd)}</div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <TopList title="Top 10 Usuários" rows={topUsers.data} isLoading={topUsers.isLoading} />
        <TopList title="Top 10 Processos" rows={topCases.data} isLoading={topCases.isLoading} />
        <TopList title="Top 10 Clientes" rows={topClients.data} isLoading={topClients.isLoading} />
      </div>
    </div>
  );
}
