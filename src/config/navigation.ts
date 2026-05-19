import {
  LayoutDashboard,
  Brain,
  Users,
  UserPlus,
  User,
  Scale,
  Settings,
  FilePlus,
  FileText,
  Bell,
  HelpCircle,
  type LucideIcon,
} from "lucide-react";

export interface NavigationItem {
  label: string;
  path: string;
  icon: LucideIcon;
  showUnreadBadge?: boolean;
  children?: NavigationItem[];
}

export const navigationItems: NavigationItem[] = [
  { label: "Dashboard", path: "/dashboard", icon: LayoutDashboard },
  {
    label: "IA Jurídica",
    path: "/ai",
    icon: Brain,
    children: [
      { label: "Nova Petição", path: "/ai/new", icon: FilePlus },
      { label: "Meus Documentos", path: "/ai/documents", icon: FileText },
    ],
  },
  {
    label: "Clientes",
    path: "/clients",
    icon: Users,
    children: [
      { label: "Cadastro de Clientes", path: "/clients/new", icon: UserPlus },
      { label: "Meus Clientes", path: "/clients", icon: Users },
    ],
  },
  { label: "Processos", path: "/cases", icon: Scale },
  { label: "Publicações", path: "/publications", icon: Bell, showUnreadBadge: true },
  { label: "Configurações", path: "/settings", icon: Settings },
  { label: "Ajuda", path: "/help", icon: HelpCircle },
];

export const routeLabels: Record<string, string> = {
  dashboard: "Dashboard",
  ai: "IA Jurídica",
  clients: "Clientes",
  cases: "Processos",
  settings: "Configurações",
  users: "Usuários",
  profile: "Meu Perfil",
  notifications: "Notificações",
  integrations: "Integrações",
  help: "Ajuda",
};

export const roleLabels: Record<string, string> = {
  admin: "Administrador",
  lawyer: "Advogado",
  secretary: "Secretária",
  intern: "Estagiário",
};
