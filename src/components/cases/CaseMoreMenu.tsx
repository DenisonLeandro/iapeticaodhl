// =============================================================================
// CaseMoreMenu — PR-4.0A
// Dropdown "Mais opções" no header do caso.
// =============================================================================

import { ChevronDown, DollarSign, MessageSquare, MoreHorizontal, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface Props {
  isAdmin: boolean;
  onOpenAdvancedChat: () => void;
  onOpenTechnical: () => void;
  onOpenCosts: () => void;
}

export default function CaseMoreMenu({
  isAdmin,
  onOpenAdvancedChat,
  onOpenTechnical,
  onOpenCosts,
}: Props) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm">
          <MoreHorizontal className="mr-2 h-4 w-4" />
          Mais opções
          <ChevronDown className="ml-2 h-3.5 w-3.5 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Avançado</DropdownMenuLabel>
        <DropdownMenuItem onClick={onOpenAdvancedChat}>
          <MessageSquare className="mr-2 h-4 w-4" />
          Chat IA avançado
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onOpenTechnical}>
          <Wrench className="mr-2 h-4 w-4" />
          Status técnico
        </DropdownMenuItem>
        {isAdmin && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel>Administração</DropdownMenuLabel>
            <DropdownMenuItem onClick={onOpenCosts}>
              <DollarSign className="mr-2 h-4 w-4" />
              Custos IA
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
