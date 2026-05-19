// =============================================================================
// NewDocument Page — /ai/new wizard for AI document generation
// Story 2.2 — Document Generation Flow
// =============================================================================

import { Sparkles } from "lucide-react";
import DocumentWizard from "@/components/ai/DocumentWizard";

export default function NewDocument() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
          <Sparkles className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">
            Gerar Documento com IA
          </h1>
          <p className="text-sm text-muted-foreground">
            Crie documentos jurídicos com auxílio de inteligência artificial.
          </p>
        </div>
      </div>

      <DocumentWizard />
    </div>
  );
}
