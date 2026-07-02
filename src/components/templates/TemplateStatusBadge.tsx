import { Badge } from "@/components/ui/badge";
import type {
  LegalTemplateAnalysisStatus,
  LegalTemplateStatus,
} from "@/types/legalTemplate";

export function StatusBadge({ status }: { status: LegalTemplateStatus }) {
  const map: Record<LegalTemplateStatus, { label: string; variant: "default" | "secondary" | "outline" }> = {
    active: { label: "Ativo", variant: "default" },
    inactive: { label: "Inativo", variant: "secondary" },
    in_review: { label: "Em revisão", variant: "outline" },
  };
  const cfg = map[status] ?? map.active;
  return <Badge variant={cfg.variant}>{cfg.label}</Badge>;
}

export function AnalysisBadge({ status }: { status: LegalTemplateAnalysisStatus }) {
  const map: Record<LegalTemplateAnalysisStatus, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
    pending: { label: "Pendente", variant: "outline" },
    processing: { label: "Processando…", variant: "secondary" },
    done: { label: "Analisado", variant: "default" },
    error: { label: "Erro", variant: "destructive" },
  };
  const cfg = map[status] ?? map.pending;
  return <Badge variant={cfg.variant}>{cfg.label}</Badge>;
}
