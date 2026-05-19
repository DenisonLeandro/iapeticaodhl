import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Mail, Pencil, Phone, User } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ClientForm from "@/components/clients/ClientForm";
import ClientCasesSection from "@/components/clients/ClientCasesSection";
import ClientDocumentsSection from "@/components/clients/ClientDocumentsSection";
import ClientHistorySection from "@/components/clients/ClientHistorySection";
import ClientFilesSection from "@/components/clients/ClientFilesSection";
import { useClientDetail } from "@/hooks/useClientDetail";
import { maskCPF, maskCNPJ } from "@/schemas/client.schema";

function formatDocument(type: string | null, number: string | null): string {
  if (!number) return "";
  if (type === "cnpj") return maskCNPJ(number);
  return maskCPF(number);
}

function DetailSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-48" />
      <div className="space-y-2">
        <Skeleton className="h-6 w-64" />
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-4 w-56" />
      </div>
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-64 w-full" />
    </div>
  );
}

export default function ClientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [formOpen, setFormOpen] = useState(false);
  const { client, isLoading, error } = useClientDetail(id);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate("/clients")}
          className="mb-2"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar
        </Button>
        <DetailSkeleton />
      </div>
    );
  }

  if (error || !client) {
    return (
      <div className="space-y-6">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate("/clients")}
          className="mb-2"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar
        </Button>
        <div className="flex flex-col items-center justify-center rounded-lg border border-border bg-muted/50 p-12 text-center">
          <User className="mb-4 h-12 w-12 text-muted-foreground" />
          <h2 className="text-lg font-semibold">Cliente não encontrado</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            O cliente solicitado não existe ou foi removido.
          </p>
          <Button
            variant="outline"
            className="mt-4"
            onClick={() => navigate("/clients")}
          >
            Voltar para Clientes
          </Button>
        </div>
      </div>
    );
  }

  const documentFormatted = formatDocument(
    client.document_type,
    client.document_number,
  );

  return (
    <div className="space-y-6">
      {/* Back button */}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => navigate("/clients")}
        className="mb-2"
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        Voltar
      </Button>

      {/* Client Header */}
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <h1 className="font-display text-2xl font-bold text-foreground">
              {client.full_name}
            </h1>
          </div>

          {/* Document */}
          {documentFormatted && (
            <div className="flex items-center gap-2">
              {client.document_type && (
                <Badge variant="outline" className="text-xs uppercase">
                  {client.document_type}
                </Badge>
              )}
              <span className="text-sm text-muted-foreground">
                {documentFormatted}
              </span>
            </div>
          )}

          {/* Contact info */}
          <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
            {client.email && (
              <div className="flex items-center gap-1">
                <Mail className="h-4 w-4" />
                <span>{client.email}</span>
              </div>
            )}
            {client.phone && (
              <div className="flex items-center gap-1">
                <Phone className="h-4 w-4" />
                <span>{client.phone}</span>
              </div>
            )}
          </div>
        </div>

        <Button variant="outline" onClick={() => setFormOpen(true)}>
          <Pencil className="mr-2 h-4 w-4" />
          Editar
        </Button>
      </div>

      {/* Notes */}
      {client.notes && (
        <div className="rounded-lg border border-border bg-muted/30 p-4">
          <p className="text-sm text-muted-foreground">{client.notes}</p>
        </div>
      )}

      {/* Tabs */}
      <Tabs defaultValue="history">
        <TabsList>
          <TabsTrigger value="cases">Processos</TabsTrigger>
          <TabsTrigger value="documents">Documentos</TabsTrigger>
          <TabsTrigger value="history">Histórico</TabsTrigger>
          <TabsTrigger value="files">Arquivos</TabsTrigger>
        </TabsList>
        <TabsContent value="cases">
          <ClientCasesSection clientId={client.id} />
        </TabsContent>
        <TabsContent value="documents">
          <ClientDocumentsSection clientId={client.id} />
        </TabsContent>
        <TabsContent value="history">
          <ClientHistorySection clientId={client.id} />
        </TabsContent>
        <TabsContent value="files">
          <ClientFilesSection clientId={client.id} />
        </TabsContent>
      </Tabs>

      {/* Edit Form Dialog */}
      <ClientForm
        open={formOpen}
        onOpenChange={setFormOpen}
        client={client}
      />
    </div>
  );
}
