// =============================================================================
// Fase 2 · Bloco 2 — Página "Consumo de IA" (admin only)
// =============================================================================
// Tabela + filtros (inclui edge_function) + cards de resumo + rankings simples.
// Compatível com logs antigos: status/cost_level/edge_function/model ausentes
// aparecem como "—" sem quebrar a tela.
// =============================================================================

import { useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { Loader2, RefreshCw } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { useAuth } from "@/hooks/useAuth";
import {
  computeRankings,
  listAIUsageLog,
  loadFilterOptions,
  summarizeUsage,
  type AIUsageFilters,
  type AIUsageLogRow,
  type CostLevel,
  type UsageStatus,
  type UsageSummary,
} from "@/services/aiUsageLog";

const ANY = "__any__";
const PAGE_SIZE = 100;

function isoDaysAgo(d: number): string {
  return new Date(Date.now() - d * 86_400_000).toISOString();
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

function fmtUSD(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  return `$${n.toFixed(4)}`;
}

function costBadge(level: CostLevel | null | undefined) {
  const variant =
    level === "Muito Alto" ? "destructive"
    : level === "Alto" ? "default"
    : level === "Médio" ? "secondary"
    : level === "Baixo" ? "outline"
    : "outline";
  return <Badge variant={variant as never}>{level ?? "—"}</Badge>;
}

function statusBadge(status: UsageStatus | null | undefined) {
  if (status === "error") return <Badge variant="destructive">erro</Badge>;
  if (status === "success") return <Badge variant="secondary">ok</Badge>;
  return <Badge variant="outline">—</Badge>;
}

function orDash(v: string | number | null | undefined): string {
  if (v === null || v === undefined || v === "") return "—";
  return String(v);
}

export default function AIUsageLogPage() {
  const { profile } = useAuth();
  if (profile && profile.role !== "admin") {
    return <Navigate to="/settings" replace />;
  }

  const [fromIso, setFromIso] = useState<string>(isoDaysAgo(30).slice(0, 10));
  const [toIso, setToIso] = useState<string>(new Date().toISOString().slice(0, 10));
  const [profileId, setProfileId] = useState<string>(ANY);
  const [operation, setOperation] = useState<string>(ANY);
  const [model, setModel] = useState<string>(ANY);
  const [edgeFn, setEdgeFn] = useState<string>(ANY);
  const [costLevel, setCostLevel] = useState<string>(ANY);
  const [status, setStatus] = useState<string>(ANY);

  const [rows, setRows] = useState<AIUsageLogRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [filterOpts, setFilterOpts] = useState<{
    users: Array<{ id: string; label: string }>;
    operations: string[];
    models: string[];
    edge_functions: string[];
  }>({ users: [], operations: [], models: [], edge_functions: [] });

  useEffect(() => {
    loadFilterOptions().then(setFilterOpts).catch(() => {});
  }, []);

  const filters: AIUsageFilters = useMemo(() => ({
    from: fromIso ? new Date(fromIso).toISOString() : undefined,
    to: toIso ? new Date(`${toIso}T23:59:59`).toISOString() : undefined,
    profile_id: profileId === ANY ? null : profileId,
    operation: operation === ANY ? null : operation,
    model: model === ANY ? null : model,
    edge_function: edgeFn === ANY ? null : edgeFn,
    cost_level: costLevel === ANY ? null : (costLevel as CostLevel),
    status: status === ANY ? null : (status as UsageStatus),
  }), [fromIso, toIso, profileId, operation, model, edgeFn, costLevel, status]);

  const runQuery = async (nextPage = 0, append = false) => {
    setLoading(true);
    setError(null);
    try {
      const { rows: r, hasMore: hm } = await listAIUsageLog(filters, nextPage, PAGE_SIZE);
      setRows((prev) => (append ? [...prev, ...r] : r));
      setHasMore(hm);
      setPage(nextPage);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void runQuery(0, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fromIso, toIso, profileId, operation, model, edgeFn, costLevel, status]);

  const summary: UsageSummary = useMemo(() => summarizeUsage(rows), [rows]);
  const rankings = useMemo(() => computeRankings(rows), [rows]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold">Consumo de IA</h1>
          <p className="text-sm text-muted-foreground">
            Todas as chamadas registradas para monitoramento de custo (admin).
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void runQuery(0, false)} disabled={loading}>
          {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
          Atualizar
        </Button>
      </div>

      {/* Cards */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        <SummaryCard label="Chamadas" value={summary.total} />
        <SummaryCard label="Sucesso" value={summary.success} />
        <SummaryCard label="Erro" value={summary.error} />
        <SummaryCard label="Muito Alto" value={summary.very_high} />
        <SummaryCard label="Top funcionalidade" value={summary.top_operation?.key ?? "—"} sub={summary.top_operation ? `${summary.top_operation.count} chamadas` : ""} />
        <SummaryCard label="Top modelo" value={summary.top_model?.key.split("/").pop() ?? "—"} sub={summary.top_model ? `${summary.top_model.count} chamadas` : ""} />
      </div>

      {/* Filtros */}
      <Card>
        <CardHeader><CardTitle className="text-base">Filtros</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="space-y-1"><Label>De</Label><Input type="date" value={fromIso} onChange={(e) => setFromIso(e.target.value)} /></div>
          <div className="space-y-1"><Label>Até</Label><Input type="date" value={toIso} onChange={(e) => setToIso(e.target.value)} /></div>
          <div className="space-y-1">
            <Label>Usuário</Label>
            <Select value={profileId} onValueChange={setProfileId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ANY}>Todos</SelectItem>
                {filterOpts.users.map((u) => <SelectItem key={u.id} value={u.id}>{u.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Operation</Label>
            <Select value={operation} onValueChange={setOperation}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ANY}>Todas</SelectItem>
                {filterOpts.operations.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Edge function</Label>
            <Select value={edgeFn} onValueChange={setEdgeFn}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ANY}>Todas</SelectItem>
                {filterOpts.edge_functions.map((e) => <SelectItem key={e} value={e}>{e}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Modelo</Label>
            <Select value={model} onValueChange={setModel}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ANY}>Todos</SelectItem>
                {filterOpts.models.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Nível de consumo</Label>
            <Select value={costLevel} onValueChange={setCostLevel}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ANY}>Todos</SelectItem>
                <SelectItem value="Baixo">Baixo</SelectItem>
                <SelectItem value="Médio">Médio</SelectItem>
                <SelectItem value="Alto">Alto</SelectItem>
                <SelectItem value="Muito Alto">Muito Alto</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ANY}>Todos</SelectItem>
                <SelectItem value="success">Sucesso</SelectItem>
                <SelectItem value="error">Erro</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Rankings simples */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
        <RankCard title="Top Edge Functions" items={rankings.top_edge_functions} suffix="chamadas" />
        <RankCard title="Top Operations" items={rankings.top_operations} suffix="chamadas" />
        <RankCard title="Top Modelos" items={rankings.top_models.map((r) => ({ ...r, key: r.key.split("/").pop() ?? r.key }))} suffix="chamadas" />
        <Card>
          <CardHeader><CardTitle className="text-sm">Top 10 registros (maior custo)</CardTitle></CardHeader>
          <CardContent className="space-y-1.5">
            {rankings.top_cost.length === 0 ? (
              <p className="text-xs text-muted-foreground">Sem custo estimado disponível.</p>
            ) : rankings.top_cost.map((r) => (
              <div key={r.id} className="flex items-center justify-between gap-2 text-[11px]">
                <span className="truncate" title={`${r.edge_function} · ${r.operation}`}>
                  {r.edge_function} · {r.operation}
                </span>
                <span className="font-mono text-muted-foreground">{fmtUSD(r.cost)}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Tabela */}
      <Card>
        <CardHeader><CardTitle className="text-base">Registros ({rows.length})</CardTitle></CardHeader>
        <CardContent>
          {error && <p className="text-sm text-destructive mb-3">{error}</p>}
          {loading && rows.length === 0 ? (
            <Skeleton className="h-40 w-full" />
          ) : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum registro no período/filtros.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-muted-foreground border-b">
                    <th className="py-2 pr-2 font-normal">Data</th>
                    <th className="py-2 pr-2 font-normal">Usuário</th>
                    <th className="py-2 pr-2 font-normal">Processo</th>
                    <th className="py-2 pr-2 font-normal">Edge function</th>
                    <th className="py-2 pr-2 font-normal">Operation</th>
                    <th className="py-2 pr-2 font-normal">Modelo</th>
                    <th className="py-2 pr-2 font-normal">Status</th>
                    <th className="py-2 pr-2 font-normal text-right">ms</th>
                    <th className="py-2 pr-2 font-normal">Nível</th>
                    <th className="py-2 pr-2 font-normal text-right">USD</th>
                    <th className="py-2 pr-2 font-normal">Arquivo/Draft</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id} className="border-b border-border/40">
                      <td className="py-1.5 pr-2 whitespace-nowrap">{fmtDate(r.created_at)}</td>
                      <td className="py-1.5 pr-2">{orDash(r.user_name ?? r.profile_id?.slice(0, 8))}</td>
                      <td className="py-1.5 pr-2">{orDash(r.case_number ?? r.case_id?.slice(0, 8))}</td>
                      <td className="py-1.5 pr-2">{orDash(r.edge_function)}</td>
                      <td className="py-1.5 pr-2">{orDash(r.operation)}</td>
                      <td className="py-1.5 pr-2 whitespace-nowrap">{orDash(r.model ? `${r.provider}/${r.model.split("/").pop()}` : null)}</td>
                      <td className="py-1.5 pr-2">{statusBadge(r.status)}</td>
                      <td className="py-1.5 pr-2 text-right">{orDash(r.processing_time_ms)}</td>
                      <td className="py-1.5 pr-2">{costBadge(r.cost_level)}</td>
                      <td className="py-1.5 pr-2 text-right font-mono">{fmtUSD(r.cost_estimated)}</td>
                      <td className="py-1.5 pr-2 text-muted-foreground">
                        {r.file_id ? `f:${r.file_id.slice(0, 6)}` : r.document_id ? `d:${r.document_id.slice(0, 6)}` : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {hasMore && (
                <div className="pt-3">
                  <Button size="sm" variant="outline" disabled={loading} onClick={() => void runQuery(page + 1, true)}>
                    {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Carregar mais
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function SummaryCard({ label, value, sub }: { label: string; value: number | string; sub?: string }) {
  return (
    <Card>
      <CardContent className="pt-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-lg font-semibold mt-1 truncate">{value}</p>
        {sub && <p className="text-[10px] text-muted-foreground mt-0.5">{sub}</p>}
      </CardContent>
    </Card>
  );
}

function RankCard({ title, items, suffix }: { title: string; items: Array<{ key: string; count: number }>; suffix: string }) {
  return (
    <Card>
      <CardHeader><CardTitle className="text-sm">{title}</CardTitle></CardHeader>
      <CardContent className="space-y-1.5">
        {items.length === 0 ? (
          <p className="text-xs text-muted-foreground">Sem dados no período.</p>
        ) : items.map((i, idx) => (
          <div key={`${i.key}-${idx}`} className="flex items-center justify-between gap-2 text-[11px]">
            <span className="truncate">{idx + 1}. {i.key}</span>
            <span className="text-muted-foreground">{i.count} {suffix}</span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
