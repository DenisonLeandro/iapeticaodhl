import { useParams, Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Sparkles, User, Scale, Briefcase } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import CaseTimeline from "@/components/cases/CaseTimeline";
import CaseDocuments from "@/components/cases/CaseDocuments";
import CaseForm from "@/components/cases/CaseForm";
import {
  STATUS_BADGE_COLORS,
  STATUS_LABELS,
  type CaseStatus,
} from "@/types/case";

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

export default function CaseDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { caseData, isLoading: caseLoading, error: caseError } = useCaseDetail(id);
  const { movements, isLoading: movementsLoading } = useCaseMovements(id);
  const { documents, isLoading: documentsLoading } = useCaseDocuments(id);

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

  const aiDocUrl = `/ai/new?caseId=${caseData.id}&clientId=${caseData.client_id ?? ""}&court=${encodeURIComponent(caseData.court)}&caseNumber=${encodeURIComponent(caseData.case_number)}`;

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link to="/cases">Processos</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{caseData.case_number}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="font-display text-2xl font-bold text-foreground">
              {caseData.case_number}
            </h1>
            <Badge className={STATUS_BADGE_COLORS[caseData.status as CaseStatus]}>
              {STATUS_LABELS[caseData.status as CaseStatus]}
            </Badge>
          </div>
          {caseData.subject && (
            <p className="text-sm text-muted-foreground">{caseData.subject}</p>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate(aiDocUrl)}
          >
            <Sparkles className="mr-2 h-4 w-4" />
            Gerar Documento com IA
          </Button>
          <CaseForm editCase={caseData} />
        </div>
      </div>

      {/* Case Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Scale className="h-4 w-4" />
              Tribunal / Vara
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-semibold">{caseData.court}</p>
            {caseData.branch && (
              <p className="text-sm text-muted-foreground">{caseData.branch}</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <User className="h-4 w-4" />
              Cliente
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-semibold">
              {caseData.client_name ?? "Não vinculado"}
            </p>
            {caseData.opposing_party && (
              <p className="text-sm text-muted-foreground">
                vs. {caseData.opposing_party}
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Briefcase className="h-4 w-4" />
              Advogado Responsável
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-semibold">
              {caseData.lawyer_name ?? "Não atribuído"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="timeline" className="w-full">
        <TabsList>
          <TabsTrigger value="timeline">
            Timeline ({movements.length})
          </TabsTrigger>
          <TabsTrigger value="documents">
            Documentos ({documents.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="timeline" className="mt-6">
          <CaseTimeline
            movements={movements}
            isLoading={movementsLoading}
            caseId={caseData.id}
          />
        </TabsContent>

        <TabsContent value="documents" className="mt-6">
          <CaseDocuments
            documents={documents}
            isLoading={documentsLoading}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
