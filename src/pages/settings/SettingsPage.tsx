import { Link, useSearchParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { User, Users, Brain, DollarSign, BookMarked, Activity } from "lucide-react";
import UsersPage from "./UsersPage";
import AISettingsPage from "./AISettingsPage";
import ProfilePage from "./ProfilePage";
import AICostsPage from "./AICostsPage";
import PlaybooksListPage from "./PlaybooksListPage";

interface TabDef {
  value: string;
  label: string;
  icon: React.ElementType;
  adminOnly?: boolean;
  component: React.ReactNode;
}

const tabs: TabDef[] = [
  // PR-SEC-1: restrito a admin. A tela lê organizations.llm_config, que hoje
  // carrega a credencial de IA no jsonb. O gate reduz exposição acidental —
  // NÃO fecha o P0: o RLS (organizations_select) ainda permite que qualquer
  // membro autenticado leia a linha via client. Fechamento só no PR-SEC-2A.
  { value: "ai", label: "Integrações IA", icon: Brain, adminOnly: true, component: <AISettingsPage /> },
  { value: "profile", label: "Meu Perfil", icon: User, component: <ProfilePage /> },
  { value: "users", label: "Usuários", icon: Users, adminOnly: true, component: <UsersPage /> },
  { value: "costs", label: "Custos IA", icon: DollarSign, adminOnly: true, component: <AICostsPage /> },
  { value: "playbooks", label: "Playbooks Jurídicos", icon: BookMarked, adminOnly: true, component: <PlaybooksListPage /> },
];

export default function SettingsPage() {
  const { profile } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const isAdmin = profile?.role === "admin";

  const visibleTabs = tabs.filter((t) => !t.adminOnly || isAdmin);

  // A aba pedida via query string precisa ser validada contra as abas visíveis.
  // App.tsx redireciona /settings/ai e /settings/integrations para ?tab=ai; sem
  // esta checagem, um não-admin nessas rotas ficaria com ?tab=ai sem TabsContent
  // correspondente — resultando em área de conteúdo em branco.
  const requestedTab = searchParams.get("tab");
  const fallbackTab = visibleTabs[0]?.value ?? "profile";
  const currentTab = visibleTabs.some((t) => t.value === requestedTab)
    ? (requestedTab as string)
    : fallbackTab;

  const handleTabChange = (value: string) => {
    setSearchParams({ tab: value }, { replace: true });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Configurações</h1>
          <p className="text-muted-foreground">Gerencie as configurações do sistema</p>
        </div>
        {isAdmin && (
          <Button asChild variant="outline" size="sm">
            <Link to="/settings/ai-usage" className="gap-2">
              <Activity className="h-4 w-4" />
              Consumo de IA
            </Link>
          </Button>
        )}
      </div>


      <Tabs value={currentTab} onValueChange={handleTabChange}>
        <TabsList className="flex flex-wrap h-auto gap-1">
          {visibleTabs.map((tab) => (
            <TabsTrigger key={tab.value} value={tab.value} className="gap-2">
              <tab.icon className="h-4 w-4" />
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {visibleTabs.map((tab) => (
          <TabsContent key={tab.value} value={tab.value}>
            {tab.component}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
