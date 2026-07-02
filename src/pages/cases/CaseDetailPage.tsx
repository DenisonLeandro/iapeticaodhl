import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { AlertTriangle, ArrowLeft, Link as LinkIcon } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import {
  useCaseDetail,
  useCaseMovements,
  useCaseDocuments,
} from "@/hooks/useCaseDetail";
import { useAuth } from "@/hooks/useAuth";
import CaseTimeline from "@/components/cases/CaseTimeline";
import CaseDocuments from "@/components/cases/CaseDocuments";
import CaseFilesSection from "@/components/cases/CaseFilesSection";
import CaseForm from "@/components/cases/CaseForm";
import CaseChatPanel from "@/components/cases/CaseChatPanel";
import CaseCostsTab from "@/components/cases/CaseCostsTab";
import CaseWorkbench from "@/components/cases/CaseWorkbench";
import CaseIntakeForm from "@/components/cases/CaseIntakeForm";

import CaseMoreMenu from "@/components/cases/CaseMoreMenu";
import { useCaseDrafts } from "@/hooks/useCaseDrafts";

function DetailSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-64" />
      <div className="grid grid-cols-2 gap-4">
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
      </div>
      <Skeleton className="h-64" />
    </div>
  );
}

type TabValue =
  | "principal"
  | "intake"
  | "documents"
  | "pieces"
  | "history"
  | "chat-advanced"
  | "technical"
  | "costs";

export default function CaseDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [editOpen, setEditOpen] = useState(false);
  
  const [activeTab, setActiveTab] = useState<TabValue>("principal");
  const { profile } = useAuth();
  const isAdmin = profile?.role === "admin";

  const { caseData, isLoading: caseLoading, error: caseError } = useCaseDetail(id);
  const { movements, isLoading: movementsLoading } = useCaseMovements(id);
  const { documents, isLoading: documentsLoading } = useCaseDocuments(id);
  const { data: drafts = [] } = useCaseDrafts(id);

  if (caseLoading) {
    return <DetailSkeleton />;
  }

  if (caseError || !caseData) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/cases">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar para Processos
          </Link>
        </Button>
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-8 text-center text-destructive">
          Processo não encontrado ou erro ao carregar dados.
        </div>
      </div>
    );
  }

  const hasCaseNumber = !!caseData.case_number?.trim();
  const phaseLabel = hasCaseNumber ? "Processo judicial" : "Caso em preparação";
  const phaseBadgeClass = hasCaseNumber
    ? "bg-primary/15 text-primary hover:bg-primary/20 border-transparent"
    : "bg-amber-500/15 text-amber-700 dark:text-amber-400 hover:bg-amber-500/20 border-transparent";

  const headerTitle = hasCaseNumber
    ? caseData.case_number
    : caseData.subject || caseData.client_name || "Caso em preparação";

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
            <BreadcrumbPage>{headerTitle}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* Header enxuto */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-display text-2xl font-bold text-foreground">
              {headerTitle}
            </h1>
            <Badge className={phaseBadgeClass}>{phaseLabel}</Badge>
          </div>
          {hasCaseNumber && caseData.subject && (
            <p className="mt-1 text-sm text-muted-foreground">{caseData.subject}</p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
            Editar
          </Button>
          <CaseMoreMenu
            isAdmin={isAdmin}
            onOpenAdvancedChat={() => setActiveTab("chat-advanced")}
            onOpenTechnical={() => setActiveTab("technical")}
            onOpenCosts={() => setActiveTab("costs")}
          />
          <CaseForm editCase={caseData} open={editOpen} onOpenChange={setEditOpen} hideTrigger />
        </div>
      </div>

      {!caseData.client_id && (
        <Alert variant="default" className="border-amber-500/50 bg-amber-500/10">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <AlertTitle>Caso sem cliente vinculado</AlertTitle>
          <AlertDescription className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <span>
              Vincule um cliente para enviar documentos e gerar peças com IA.
            </span>
            <Button size="sm" onClick={() => setEditOpen(true)}>
              <LinkIcon className="mr-2 h-4 w-4" />
              Vincular cliente
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Tabs principais */}
      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as TabValue)}
        className="w-full"
      >
        <TabsList className="flex h-auto flex-wrap">
          <TabsTrigger value="principal" data-tab-trigger="principal">
            Principal
          </TabsTrigger>
          <TabsTrigger value="intake" data-tab-trigger="intake">
            Ficha
          </TabsTrigger>
          <TabsTrigger value="documents" data-tab-trigger="documents">
            Documentos
          </TabsTrigger>
          <TabsTrigger value="pieces" data-tab-trigger="pieces">
            Peças ({drafts.filter((d) => d.status !== "archived").length + documents.length})
          </TabsTrigger>
          <TabsTrigger value="history" data-tab-trigger="history">
            Histórico ({movements.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="principal" className="mt-6">
          <CaseWorkbench
            caseData={caseData}
            documents={documents}
            onOpenChat={() => setActiveTab("chat-advanced")}
          />
        </TabsContent>

        <TabsContent value="intake" className="mt-6">
          <CaseIntakeForm
            caseData={caseData}
            onAnalyzed={() => setActiveTab("principal")}
          />
        </TabsContent>

        <TabsContent value="documents" className="mt-6">
          <CaseFilesSection
            caseId={caseData.id}
            clientId={caseData.client_id}
            variant="simple"
          />
        </TabsContent>


        <TabsContent value="pieces" className="mt-6">
          <CaseDocuments documents={documents} isLoading={documentsLoading} />
        </TabsContent>

        <TabsContent value="history" className="mt-6">
          <CaseTimeline
            movements={movements}
            isLoading={movementsLoading}
            caseId={caseData.id}
          />
        </TabsContent>

        {/* Abas ocultas — acessadas pelo card "Conversar com IA" e pelo menu "Mais opções" */}
        <TabsContent value="chat-advanced" className="mt-6">
          <div className="mx-auto w-full max-w-5xl">
            <CaseChatPanel caseId={caseData.id} />
          </div>
        </TabsContent>

        <TabsContent value="technical" className="mt-6">
          <CaseFilesSection
            caseId={caseData.id}
            clientId={caseData.client_id}
            variant="technical"
          />
        </TabsContent>

        {isAdmin && (
          <TabsContent value="costs" className="mt-6">
            <CaseCostsTab caseId={caseData.id} />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
