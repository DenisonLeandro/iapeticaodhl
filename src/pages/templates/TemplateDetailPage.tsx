import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Download, RefreshCw, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import {
  useAnalyzeLegalTemplate,
  useLegalTemplate,
  useSetLegalTemplateStatus,
  useUploadLegalTemplateFile,
} from "@/hooks/useLegalTemplates";
import {
  downloadLegalTemplateBlob,
  getLegalTemplateDownloadUrl,
} from "@/services/legalTemplates";
import { TemplateAnalysisPanel } from "@/components/templates/TemplateAnalysisPanel";
import {
  AnalysisBadge,
  StatusBadge,
} from "@/components/templates/TemplateStatusBadge";

export default function TemplateDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();
  const { data: template, isLoading } = useLegalTemplate(id);
  const analyze = useAnalyzeLegalTemplate();
  const setStatus = useSetLegalTemplateStatus();
  const upload = useUploadLegalTemplateFile();
  const [replaceFile, setReplaceFile] = useState<File | null>(null);

  if (isLoading || !template) {
    return <p className="text-muted-foreground">Carregando…</p>;
  }

  const handleAnalyze = async () => {
    try {
      await analyze.mutateAsync(template.id);
      toast({ title: "Análise iniciada", description: "Aguarde alguns segundos." });
    } catch (e) {
      toast({ title: "Erro", description: (e as Error).message, variant: "destructive" });
    }
  };

  const handleDownload = async () => {
    if (!template.file_path) return;
    try {
      const url = await getLegalTemplateDownloadUrl(template.file_path);
      window.open(url, "_blank");
    } catch (e) {
      toast({ title: "Erro", description: (e as Error).message, variant: "destructive" });
    }
  };

  const handleToggleStatus = async () => {
    const next = template.status === "active" ? "inactive" : "active";
    try {
      await setStatus.mutateAsync({ id: template.id, status: next });
      toast({ title: next === "active" ? "Modelo ativado" : "Modelo inativado" });
    } catch (e) {
      toast({ title: "Erro", description: (e as Error).message, variant: "destructive" });
    }
  };

  const handleReplaceFile = async () => {
    if (!replaceFile) return;
    try {
      await upload.mutateAsync({ id: template.id, file: replaceFile });
      setReplaceFile(null);
      toast({ title: "Arquivo substituído", description: "Reanalise o modelo." });
    } catch (e) {
      toast({ title: "Erro no upload", description: (e as Error).message, variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <Button variant="ghost" size="sm" asChild>
          <Link to="/templates"><ArrowLeft className="h-4 w-4 mr-1" /> Modelos</Link>
        </Button>
      </div>

      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">{template.name}</h1>
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            {template.legal_area && <span>{template.legal_area}</span>}
            {template.piece_type && <span>· {template.piece_type}</span>}
            {template.main_topic && <span>· {template.main_topic}</span>}
            {template.represented_party && <span>· {template.represented_party}</span>}
          </div>
          <div className="flex items-center gap-2 pt-1">
            <StatusBadge status={template.status} />
            <AnalysisBadge status={template.analysis_status} />
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          {template.file_path && (
            <Button variant="outline" size="sm" onClick={handleDownload}>
              <Download className="h-4 w-4 mr-2" /> Baixar arquivo
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={handleAnalyze}
            disabled={
              analyze.isPending ||
              !template.file_path ||
              template.analysis_status === "processing"
            }
          >
            <RefreshCw className="h-4 w-4 mr-2" /> Reanalisar
          </Button>
          <Button variant="outline" size="sm" onClick={handleToggleStatus}>
            {template.status === "active" ? "Inativar" : "Ativar"}
          </Button>
        </div>
      </div>

      <Card className="p-4 space-y-3">
        <h2 className="text-sm font-semibold">Arquivo do modelo</h2>
        <div className="text-sm text-muted-foreground">
          {template.file_name
            ? <>Arquivo atual: <span className="text-foreground">{template.file_name}</span></>
            : "Nenhum arquivo enviado ainda."}
        </div>
        <Separator />
        <div className="grid gap-2">
          <Label htmlFor="replace-file">
            {template.file_path ? "Substituir arquivo" : "Enviar arquivo"}
          </Label>
          <div className="flex gap-2">
            <Input
              id="replace-file"
              type="file"
              accept=".docx,.pdf,.txt"
              onChange={(e) => setReplaceFile(e.target.files?.[0] ?? null)}
            />
            <Button onClick={handleReplaceFile} disabled={!replaceFile || upload.isPending}>
              <Upload className="h-4 w-4 mr-2" />
              {upload.isPending ? "Enviando…" : "Enviar"}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Ao substituir o arquivo, os campos de análise são zerados e o modelo
            volta ao status pendente até nova análise.
          </p>
        </div>
      </Card>

      <TemplateAnalysisPanel template={template} />

      {template.description && (
        <Card className="p-4">
          <h2 className="text-sm font-semibold mb-2">Descrição de uso</h2>
          <p className="text-sm text-muted-foreground whitespace-pre-wrap">
            {template.description}
          </p>
        </Card>
      )}
      {template.internal_notes && (
        <Card className="p-4">
          <h2 className="text-sm font-semibold mb-2">Observações internas</h2>
          <p className="text-sm text-muted-foreground whitespace-pre-wrap">
            {template.internal_notes}
          </p>
        </Card>
      )}
    </div>
  );
}
