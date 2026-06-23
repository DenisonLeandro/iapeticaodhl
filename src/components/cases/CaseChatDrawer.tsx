// =============================================================================
// CaseChatDrawer — PR-4.0A
// Wrapper Sheet que renderiza o CaseChatPanel existente sem alterar sua lógica.
// =============================================================================

import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import CaseChatPanel from "./CaseChatPanel";

interface Props {
  caseId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function CaseChatDrawer({ caseId, open, onOpenChange }: Props) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full max-w-full overflow-y-auto p-0 sm:max-w-xl md:max-w-2xl"
      >
        <SheetHeader className="border-b border-border px-6 py-4">
          <SheetTitle>Conversar com IA</SheetTitle>
        </SheetHeader>
        <div className="px-4 py-4 sm:px-6">
          <CaseChatPanel caseId={caseId} />
        </div>
      </SheetContent>
    </Sheet>
  );
}
