// =============================================================================
// CaseChatDrawer — PR-4.0A (ajuste visual)
// Wrapper Sheet que renderiza o CaseChatPanel existente sem alterar sua lógica.
// =============================================================================

import { useState, useEffect } from "react";
import { Maximize2, Minimize2 } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import CaseChatPanel from "./CaseChatPanel";

interface Props {
  caseId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function CaseChatDrawer({ caseId, open, onOpenChange }: Props) {
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!open) setExpanded(false);
  }, [open]);

  const widthClasses = expanded
    ? "w-screen max-w-full sm:max-w-full lg:!max-w-[98vw] xl:!max-w-[1600px]"
    : "w-screen max-w-full sm:!max-w-full lg:w-[70vw] lg:!max-w-[1100px] lg:min-w-[720px] xl:w-[70vw] xl:!max-w-[1200px]";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className={cn("overflow-y-auto p-0", widthClasses)}
      >
        <SheetHeader className="border-b border-border px-6 py-4">
          <div className="flex items-center justify-between gap-2 pr-8">
            <SheetTitle>Conversar com IA</SheetTitle>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="hidden h-8 gap-1.5 text-xs text-muted-foreground lg:inline-flex"
              onClick={() => setExpanded((v) => !v)}
            >
              {expanded ? (
                <>
                  <Minimize2 className="h-3.5 w-3.5" />
                  Recolher
                </>
              ) : (
                <>
                  <Maximize2 className="h-3.5 w-3.5" />
                  Expandir
                </>
              )}
            </Button>
          </div>
        </SheetHeader>
        <div className="px-4 py-4 sm:px-6">
          <CaseChatPanel caseId={caseId} />
        </div>
      </SheetContent>
    </Sheet>
  );
}
