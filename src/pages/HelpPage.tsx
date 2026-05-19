import { useState } from "react";
import {
  HelpCircle,
  Brain,
  Users,
  Scale,
  Settings,
  FileText,
  FilePlus,
  UserPlus,
  Search,
  ChevronDown,
  ChevronRight,
  BookOpen,
  Sparkles,
  Upload,
  Mic,
  Download,
  Eye,
  Edit,
  PlusCircle,
  LayoutDashboard,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface GuideStep {
  title: string;
  description: string;
}

interface GuideSection {
  id: string;
  title: string;
  icon: React.ElementType;
  badge?: string;
  description: string;
  steps: GuideStep[];
}

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------

const guideSections: GuideSection[] = [
  {
    id: "dashboard",
    title: "Dashboard",
    icon: LayoutDashboard,
    description: "Visão geral do sistema com métricas e atalhos rápidos.",
    steps: [
      { title: "Acessar o Dashboard", description: "Após fazer login, você será redirecionado automaticamente para o Dashboard. Ele exibe um resumo dos seus dados: processos ativos, documentos recentes e atalhos rápidos para as principais funcionalidades." },
      { title: "Atalhos rápidos", description: "Use os cards do Dashboard para navegar rapidamente para criar uma nova petição, cadastrar um cliente ou acessar seus processos." },
    ],
  },
  {
    id: "ai-new",
    title: "Nova Petição (IA Jurídica)",
    icon: FilePlus,
    badge: "IA",
    description: "Gere petições e documentos jurídicos automaticamente com inteligência artificial.",
    steps: [
      { title: "Acessar Nova Petição", description: "No menu lateral, clique em 'IA Jurídica' > 'Nova Petição'. O sistema abrirá o assistente de geração em 3 etapas." },
      { title: "Etapa 1 — Tipo de Documento", description: "Escolha a categoria (Petições, Recursos, Contratos, Notificações, Outros) e selecione o tipo específico de documento que deseja gerar." },
      { title: "Etapa 2 — Dados do Documento", description: "Preencha as informações necessárias: fatos, qualificação do autor, fundamentos jurídicos, pedidos e demais campos. Use o botão 'Preencher por voz' para ditar as informações." },
      { title: "Etapa 3 — Resultado", description: "A IA gerará o documento completo. Revise o conteúdo no editor, faça ajustes se necessário, e salve ou exporte em PDF/DOCX." },
      { title: "Vincular a Cliente/Processo", description: "Na etapa 2, utilize o campo de busca para vincular o documento a um cliente ou processo existente." },
      { title: "OCR — Importar documento", description: "Use o botão de upload para importar um documento digitalizado. O sistema extrairá o texto automaticamente via OCR e preencherá os campos." },
    ],
  },
  {
    id: "ai-documents",
    title: "Meus Documentos",
    icon: FileText,
    description: "Gerencie todos os documentos gerados pela IA.",
    steps: [
      { title: "Listar documentos", description: "No menu 'IA Jurídica' > 'Meus Documentos', veja todos os documentos gerados, com filtros por tipo, status e data." },
      { title: "Editar documento", description: "Clique em qualquer documento para abrir o editor completo. Você pode alterar o conteúdo, formatar texto e salvar as alterações." },
      { title: "Exportar", description: "No editor, use os botões de exportação para baixar o documento em formato PDF ou DOCX, seguindo os padrões CNJ/ABNT." },
      { title: "Alterar status", description: "Documentos passam por fluxo de status: Rascunho → Revisão → Aprovado → Assinado. Altere o status conforme o andamento." },
    ],
  },
  {
    id: "clients-new",
    title: "Cadastro de Clientes",
    icon: UserPlus,
    description: "Cadastre novos clientes com todos os dados necessários.",
    steps: [
      { title: "Acessar cadastro", description: "No menu 'Clientes' > 'Cadastro de Clientes' ou clique no botão '+ Novo Cliente' na lista de clientes." },
      { title: "Dados obrigatórios", description: "Preencha nome completo, tipo de documento (CPF ou CNPJ), número do documento, email, telefone e endereço completo." },
      { title: "Busca de CEP", description: "Ao digitar o CEP, o sistema busca automaticamente o endereço via ViaCEP, preenchendo rua, bairro, cidade e estado." },
      { title: "Preencher por voz", description: "Use o botão 'Preencher por voz' para ditar os dados do cliente. A IA transcreve e preenche os campos automaticamente." },
      { title: "Salvar", description: "Após preencher todos os dados, clique em 'Salvar'. O cliente ficará disponível para vincular a processos e documentos." },
    ],
  },
  {
    id: "clients-list",
    title: "Meus Clientes",
    icon: Users,
    description: "Visualize, busque e gerencie todos os clientes cadastrados.",
    steps: [
      { title: "Listar clientes", description: "No menu 'Clientes' > 'Meus Clientes', veja todos os clientes com busca por nome, CPF/CNPJ ou email." },
      { title: "Detalhes do cliente", description: "Clique em um cliente para acessar seus detalhes: dados pessoais, processos vinculados, documentos, arquivos e histórico de interações." },
      { title: "Editar dados", description: "Na tela de detalhes, clique em 'Editar' para atualizar as informações do cliente." },
      { title: "Enviar arquivos", description: "Na aba 'Arquivos', faça upload de documentos do cliente (contratos, procurações, etc.)." },
      { title: "Registrar interação", description: "Na aba 'Histórico', registre atendimentos, reuniões e comunicações com o cliente." },
      { title: "Excluir cliente", description: "Use o botão de exclusão para remover um cliente. A exclusão é lógica (soft delete) — os dados são preservados." },
    ],
  },
  {
    id: "cases",
    title: "Processos",
    icon: Scale,
    description: "Gerencie processos judiciais do escritório.",
    steps: [
      { title: "Listar processos", description: "No menu 'Processos', visualize todos os processos com filtros por status (ativo, arquivado, encerrado), tribunal e advogado responsável." },
      { title: "Novo processo", description: "Clique em '+ Novo Processo' e preencha: número do processo, tribunal, vara, assunto, parte contrária e advogado responsável." },
      { title: "Vincular cliente", description: "Ao criar ou editar um processo, selecione o cliente associado no campo correspondente." },
      { title: "Detalhes do processo", description: "Clique em um processo para ver detalhes completos, incluindo timeline de movimentações e documentos vinculados." },
      { title: "Registrar movimentação", description: "Na tela de detalhes, adicione movimentações processuais com data, tipo e descrição." },
      { title: "Documentos do processo", description: "Visualize e vincule documentos gerados pela IA ao processo." },
    ],
  },
  {
    id: "settings-ai",
    title: "Configurações — Integrações IA",
    icon: Brain,
    description: "Configure o provedor de inteligência artificial utilizado pelo sistema.",
    steps: [
      { title: "Acessar configurações", description: "No menu 'Configurações', acesse a aba 'Integrações IA'." },
      { title: "Provedor padrão (Lovable AI)", description: "O sistema vem configurado com Lovable AI — funciona imediatamente, sem necessidade de chave API. É o provedor recomendado." },
      { title: "Usar provedor externo", description: "Opcionalmente, selecione OpenAI, Gemini ou Claude como provedor. Será necessário informar a chave API correspondente." },
      { title: "Selecionar modelo", description: "Ao usar provedor externo, escolha o modelo desejado na lista (ex: GPT-4o, Gemini 2.5 Pro, Claude 3.5 Sonnet)." },
      { title: "Testar conexão", description: "Clique em 'Testar Conexão' para verificar se a chave API e o modelo estão funcionando corretamente." },
    ],
  },
  {
    id: "settings-profile",
    title: "Configurações — Meu Perfil",
    icon: Settings,
    description: "Gerencie seus dados pessoais no sistema.",
    steps: [
      { title: "Acessar perfil", description: "No menu 'Configurações', acesse a aba 'Meu Perfil' ou clique no seu avatar no canto superior direito." },
      { title: "Editar dados", description: "Atualize nome completo, telefone e número da OAB. O email não pode ser alterado." },
      { title: "Salvar alterações", description: "Após editar, clique em 'Salvar alterações'. As mudanças são aplicadas imediatamente no sistema." },
    ],
  },
  {
    id: "settings-users",
    title: "Configurações — Usuários (Admin)",
    icon: Users,
    badge: "Admin",
    description: "Gerencie os membros da equipe do escritório.",
    steps: [
      { title: "Acessar usuários", description: "No menu 'Configurações', acesse a aba 'Usuários'. Esta aba é visível apenas para administradores." },
      { title: "Convidar membro", description: "Clique em 'Convidar' e informe o email do novo membro. Ele receberá um convite para ingressar no escritório." },
      { title: "Alterar função", description: "Defina a função de cada membro: Administrador, Advogado, Secretária ou Estagiário. Cada função possui permissões diferentes." },
      { title: "Remover membro", description: "Clique no ícone de remoção ao lado do membro que deseja remover da equipe." },
    ],
  },
];

// ---------------------------------------------------------------------------
// Components
// ---------------------------------------------------------------------------

function SectionCard({ section, expanded, onToggle }: { section: GuideSection; expanded: boolean; onToggle: () => void }) {
  const Icon = section.icon;
  const Chevron = expanded ? ChevronDown : ChevronRight;

  return (
    <Card className="transition-all hover:shadow-md">
      <CardHeader
        className="cursor-pointer select-none"
        onClick={onToggle}
      >
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Icon className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <CardTitle className="text-base">{section.title}</CardTitle>
              {section.badge && (
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{section.badge}</Badge>
              )}
            </div>
            <p className="mt-0.5 text-sm text-muted-foreground">{section.description}</p>
          </div>
          <Chevron className="h-5 w-5 shrink-0 text-muted-foreground transition-transform" />
        </div>
      </CardHeader>

      {expanded && (
        <CardContent className="pt-0">
          <ol className="space-y-4 border-l-2 border-primary/20 pl-6">
            {section.steps.map((step, idx) => (
              <li key={idx} className="relative">
                <div className="absolute -left-[31px] flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                  {idx + 1}
                </div>
                <h4 className="font-medium text-foreground">{step.title}</h4>
                <p className="mt-1 text-sm text-muted-foreground leading-relaxed">{step.description}</p>
              </li>
            ))}
          </ol>
        </CardContent>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function HelpPage() {
  const [search, setSearch] = useState("");
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const toggle = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const expandAll = () => setExpandedIds(new Set(guideSections.map((s) => s.id)));
  const collapseAll = () => setExpandedIds(new Set());

  const filtered = guideSections.filter((s) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      s.title.toLowerCase().includes(q) ||
      s.description.toLowerCase().includes(q) ||
      s.steps.some(
        (st) =>
          st.title.toLowerCase().includes(q) ||
          st.description.toLowerCase().includes(q)
      )
    );
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <BookOpen className="h-6 w-6" />
          Central de Ajuda
        </h1>
        <p className="text-muted-foreground">
          Guia completo passo a passo de todas as funcionalidades do sistema.
        </p>
      </div>

      {/* Search + controls */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar no guia..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex gap-2 text-sm">
          <button onClick={expandAll} className="text-primary hover:underline">
            Expandir tudo
          </button>
          <span className="text-muted-foreground">•</span>
          <button onClick={collapseAll} className="text-primary hover:underline">
            Recolher tudo
          </button>
        </div>
      </div>

      {/* Sections */}
      <div className="space-y-3">
        {filtered.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              Nenhum resultado encontrado para "{search}".
            </CardContent>
          </Card>
        )}

        {filtered.map((section) => (
          <SectionCard
            key={section.id}
            section={section}
            expanded={expandedIds.has(section.id)}
            onToggle={() => toggle(section.id)}
          />
        ))}
      </div>
    </div>
  );
}
