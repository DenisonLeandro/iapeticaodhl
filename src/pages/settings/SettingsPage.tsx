import { useSearchParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { User, Users, Brain } from "lucide-react";
import UsersPage from "./UsersPage";
import AISettingsPage from "./AISettingsPage";
import ProfilePage from "./ProfilePage";

interface TabDef {
  value: string;
  label: string;
  icon: React.ElementType;
  adminOnly?: boolean;
  component: React.ReactNode;
}

const tabs: TabDef[] = [
  { value: "ai", label: "Integrações IA", icon: Brain, component: <AISettingsPage /> },
  { value: "profile", label: "Meu Perfil", icon: User, component: <ProfilePage /> },
  { value: "users", label: "Usuários", icon: Users, adminOnly: true, component: <UsersPage /> },
];

export default function SettingsPage() {
  const { profile } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const isAdmin = profile?.role === "admin";

  const visibleTabs = tabs.filter((t) => !t.adminOnly || isAdmin);
  const currentTab = searchParams.get("tab") || visibleTabs[0]?.value || "ai";

  const handleTabChange = (value: string) => {
    setSearchParams({ tab: value }, { replace: true });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Configurações</h1>
        <p className="text-muted-foreground">Gerencie as configurações do sistema</p>
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
