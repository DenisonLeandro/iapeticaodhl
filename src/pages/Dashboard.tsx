import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  FileText,
  CalendarDays,
  Users,
  Scale,
  FilePlus,
  Info,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/backend/client";

// =============================================================================
// Document type labels
// =============================================================================

const DOC_TYPE_LABELS: Record<string, string> = {
  petition: "Petição Inicial",
  appeal: "Recurso",
  contract: "Contrato",
  notification: "Notificação",
  opinion: "Parecer",
  power_of_attorney: "Procuração",
  contestation: "Contestação",
  reply: "Réplica",
  counterclaim: "Reconvenção",
  injunction_appeal: "Agravo de Instrumento",
  internal_appeal: "Agravo Interno",
  declaration_objection: "Embargos de Declaração",
  special_appeal: "Recurso Especial",
  extraordinary_appeal: "Recurso Extraordinário",
  requirement: "Requerimento",
  final_arguments: "Alegações Finais",
  simple_petition: "Petição Simples",
  other: "Outro",
};

const DOC_STATUS_LABELS: Record<string, string> = {
  draft: "Rascunho",
  review: "Revisão",
  approved: "Aprovado",
  signed: "Assinado",
};

const DOC_STATUS_COLORS: Record<string, string> = {
  draft: "bg-yellow-500/20 text-yellow-400 border-transparent",
  review: "bg-blue-500/20 text-blue-400 border-transparent",
  approved: "bg-green-500/20 text-green-400 border-transparent",
  signed: "bg-purple-500/20 text-purple-400 border-transparent",
};

// =============================================================================
// Mock data
// =============================================================================

const MOCK_STATS = {
  totalDocs: 47,
  docsThisMonth: 12,
  totalClients: 23,
  activeCases: 8,
};

const MOCK_RECENT_DOCS = [
  { id: "mock-1", title: "Petição Inicial - João Silva vs. Empresa ABC", type: "petition", status: "draft", created_at: new Date(Date.now() - 86400000).toISOString() },
  { id: "mock-2", title: "Recurso de Apelação - Processo 0001234", type: "appeal", status: "review", created_at: new Date(Date.now() - 172800000).toISOString() },
  { id: "mock-3", title: "Contrato de Prestação de Serviços", type: "contract", status: "approved", created_at: new Date(Date.now() - 259200000).toISOString() },
  { id: "mock-4", title: "Embargos de Declaração - TJ/PE", type: "declaration_objection", status: "signed", created_at: new Date(Date.now() - 345600000).toISOString() },
  { id: "mock-5", title: "Notificação Extrajudicial - Cliente Maria", type: "notification", status: "draft", created_at: new Date(Date.now() - 432000000).toISOString() },
];

const MOCK_CHART_DATA = [
  { type: "Petição Inicial", count: 15 },
  { type: "Recurso", count: 9 },
  { type: "Contrato", count: 7 },
  { type: "Notificação", count: 5 },
  { type: "Embargos", count: 4 },
  { type: "Outros", count: 7 },
];

// =============================================================================
// Data fetching
// =============================================================================

async function fetchDashboardData(organizationId: string) {
  const now = new Date();
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;

  const [docsRes, docsMonthRes, clientsRes, casesRes, recentDocsRes] =
    await Promise.all([
      supabase
        .from("documents")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", organizationId),
      supabase
        .from("documents")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", organizationId)
        .gte("created_at", monthStart),
      supabase
        .from("clients")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", organizationId)
        .is("deleted_at", null),
      supabase
        .from("cases")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", organizationId)
        .eq("status", "active"),
      supabase
        .from("documents")
        .select("id, title, type, status, created_at")
        .eq("organization_id", organizationId)
        .order("created_at", { ascending: false })
        .limit(5),
    ]);

  // Fetch doc type distribution
  const { data: allDocs } = await supabase
    .from("documents")
    .select("type")
    .eq("organization_id", organizationId);

  const typeMap: Record<string, number> = {};
  for (const doc of allDocs ?? []) {
    const label = DOC_TYPE_LABELS[doc.type] ?? doc.type;
    typeMap[label] = (typeMap[label] ?? 0) + 1;
  }
  const chartData = Object.entries(typeMap)
    .map(([type, count]) => ({ type, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 6);

  const totalDocs = docsRes.count ?? 0;
  const docsThisMonth = docsMonthRes.count ?? 0;
  const totalClients = clientsRes.count ?? 0;
  const activeCases = casesRes.count ?? 0;
  const hasRealData = totalDocs > 0 || totalClients > 0 || activeCases > 0;

  return {
    stats: hasRealData
      ? { totalDocs, docsThisMonth, totalClients, activeCases }
      : MOCK_STATS,
    recentDocs: hasRealData ? (recentDocsRes.data ?? []) : MOCK_RECENT_DOCS,
    chartData: hasRealData && chartData.length > 0 ? chartData : MOCK_CHART_DATA,
    isMock: !hasRealData,
  };
}

// =============================================================================
// Component
// =============================================================================

const Dashboard = () => {
  const { profile, organization } = useAuth();
  const organizationId = organization?.id;

  const { data, isLoading } = useQuery({
    queryKey: ["dashboard-stats", organizationId],
    queryFn: () => fetchDashboardData(organizationId!),
    enabled: !!organizationId,
  });

  const stats = data?.stats;
  const recentDocs = data?.recentDocs ?? [];
  const chartData = data?.chartData ?? [];
  const isMock = data?.isMock ?? true;

  const statCards = [
    { label: "Petições Geradas", value: stats?.totalDocs ?? 0, icon: FileText, color: "text-primary" },
    { label: "Petições Este Mês", value: stats?.docsThisMonth ?? 0, icon: CalendarDays, color: "text-accent-foreground" },
    { label: "Clientes Ativos", value: stats?.totalClients ?? 0, icon: Users, color: "text-green-500" },
    { label: "Processos Ativos", value: stats?.activeCases ?? 0, icon: Scale, color: "text-yellow-500" },
  ];

  return (
    <div className="space-y-6">
      {/* Welcome + Quick Action */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">
            Bem-vindo(a), {profile?.full_name ?? "Usuário"}!
          </h1>
          <p className="mt-1 text-muted-foreground">
            {organization?.name ?? "Peticionamento com IA"}
          </p>
        </div>
        <Button asChild size="lg" className="w-full sm:w-auto">
          <Link to="/ai/new">
            <FilePlus className="mr-2 h-5 w-5" />
            Nova Petição
          </Link>
        </Button>
      </div>

      {/* Mock banner */}
      {isMock && !isLoading && (
        <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/50 p-3 text-sm text-muted-foreground">
          <Info className="h-4 w-4 shrink-0" />
          Dados de demonstração — comece a usar o sistema para ver seus dados reais.
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        {isLoading
          ? Array.from({ length: 4 }).map((_, i) => (
              <Card key={i} className="bg-glass border-border">
                <CardHeader className="pb-2">
                  <Skeleton className="h-4 w-24" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-8 w-16" />
                </CardContent>
              </Card>
            ))
          : statCards.map((card) => {
              const Icon = card.icon;
              return (
                <Card key={card.label} className="bg-glass border-border">
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      {card.label}
                    </CardTitle>
                    <Icon className={`h-4 w-4 ${card.color}`} />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-foreground">
                      {card.value}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
      </div>

      {/* Chart + Recent Documents */}
      <div className="grid gap-6 grid-cols-1 lg:grid-cols-2">
        {/* Document Distribution Chart */}
        <Card className="bg-glass border-border">
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Distribuição por Tipo de Documento
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-[250px] w-full" />
            ) : (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={chartData} layout="vertical" margin={{ left: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis type="number" tick={{ fontSize: 12 }} className="text-muted-foreground" />
                  <YAxis
                    dataKey="type"
                    type="category"
                    width={130}
                    tick={{ fontSize: 11 }}
                    className="text-muted-foreground"
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--background))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                    }}
                    labelStyle={{ color: "hsl(var(--foreground))" }}
                  />
                  <Bar dataKey="count" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} name="Quantidade" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Recent Documents */}
        <Card className="bg-glass border-border">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Documentos Recentes
            </CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/ai/documents">Ver todos</Link>
            </Button>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : recentDocs.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                Nenhum documento gerado ainda.
              </p>
            ) : (
              <div className="space-y-3">
                {recentDocs.map((doc) => (
                  <Link
                    key={doc.id}
                    to={doc.id.startsWith("mock") ? "/ai/new" : `/ai/documents/${doc.id}/edit`}
                    className="flex items-center justify-between rounded-lg border border-border p-3 transition-colors hover:bg-muted/50"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">
                        {doc.title}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {DOC_TYPE_LABELS[doc.type] ?? doc.type} •{" "}
                        {new Date(doc.created_at).toLocaleDateString("pt-BR")}
                      </p>
                    </div>
                    <Badge className={`ml-2 shrink-0 ${DOC_STATUS_COLORS[doc.status] ?? ""}`}>
                      {DOC_STATUS_LABELS[doc.status] ?? doc.status}
                    </Badge>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;
