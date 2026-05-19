// =============================================================================
// StepDocumentType — Step 1: Document type selection grid with categories
// Story 2.2 — Document Generation Flow
// =============================================================================

import {
  FileText,
  Repeat,
  FileSignature,
  Bell,
  BookOpen,
  ScrollText,
  MoreHorizontal,
  ShieldAlert,
  MessageSquareReply,
  Swords,
  Gavel,
  Scale,
  FileWarning,
  Star,
  FilePlus,
  ClipboardList,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  ALL_DOCUMENT_TYPES,
  DOCUMENT_CATEGORIES,
  type DocumentType,
  type DocumentCategory,
} from "@/types/ai";
import type { LucideIcon } from "lucide-react";

const ICON_MAP: Record<DocumentType, LucideIcon> = {
  petition: FileText,
  contestation: ShieldAlert,
  reply: MessageSquareReply,
  counterclaim: Swords,
  appeal: Repeat,
  injunction_appeal: Gavel,
  internal_appeal: Scale,
  declaration_objection: FileWarning,
  special_appeal: Star,
  extraordinary_appeal: Star,
  contract: FileSignature,
  notification: Bell,
  requirement: ClipboardList,
  opinion: BookOpen,
  power_of_attorney: ScrollText,
  final_arguments: FilePlus,
  simple_petition: FileText,
  other: MoreHorizontal,
};

interface StepDocumentTypeProps {
  selectedType: DocumentType | null;
  onSelect: (type: DocumentType) => void;
}

const CATEGORY_ORDER: DocumentCategory[] = [
  "peticoes",
  "recursos",
  "contratos",
  "extrajudiciais",
  "outros",
];

export default function StepDocumentType({
  selectedType,
  onSelect,
}: StepDocumentTypeProps) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-foreground">
          Tipo de Documento
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Selecione o tipo de documento jurídico que deseja gerar.
        </p>
      </div>

      {CATEGORY_ORDER.map((catKey) => {
        const cat = DOCUMENT_CATEGORIES[catKey];
        const items = ALL_DOCUMENT_TYPES.filter((d) => d.category === catKey);
        if (items.length === 0) return null;

        return (
          <div key={catKey} className="space-y-3">
            <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
              {cat.label}
            </h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((docType) => {
                const Icon = ICON_MAP[docType.type] ?? MoreHorizontal;
                const isSelected = selectedType === docType.type;

                return (
                  <Card
                    key={docType.type}
                    role="button"
                    tabIndex={0}
                    aria-pressed={isSelected}
                    onClick={() => onSelect(docType.type)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        onSelect(docType.type);
                      }
                    }}
                    className={cn(
                      "cursor-pointer transition-all hover:border-primary/60 hover:shadow-md",
                      isSelected &&
                        "border-primary bg-primary/5 ring-2 ring-primary/30",
                    )}
                  >
                    <CardContent className="flex items-start gap-3 p-4">
                      <div
                        className={cn(
                          "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
                          isSelected
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted text-muted-foreground",
                        )}
                      >
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-medium text-foreground text-sm">
                            {docType.label}
                          </h3>
                          <Badge
                            variant="outline"
                            className={cn("text-[10px] px-1.5 py-0", cat.color)}
                          >
                            {cat.label}
                          </Badge>
                        </div>
                        <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">
                          {docType.description}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
