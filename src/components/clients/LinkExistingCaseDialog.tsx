import { useState } from "react";
import { Loader2, Link as LinkIcon } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useUnlinkedCases, useLinkCaseToClient } from "@/hooks/useCases";

interface LinkExistingCaseDialogProps {
  clientId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function LinkExistingCaseDialog({
  clientId,
  open,
  onOpenChange,
}: LinkExistingCaseDialogProps) {
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { cases, isLoading } = useUnlinkedCases(search);
  const linkMutation = useLinkCaseToClient();

  const handleLink = async () => {
    if (!selectedId) return;
    try {
      await linkMutation.mutateAsync({ caseId: selectedId, clientId });
      toast.success("Processo vinculado ao cliente");
      setSelectedId(null);
      setSearch("");
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao vincular");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Vincular processo existente</DialogTitle>
          <DialogDescription>
            Selecione um processo da sua organização que ainda não está vinculado a nenhum
            cliente.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <Input
            placeholder="Buscar por número do processo..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          <ScrollArea className="h-72 rounded-md border border-border">
            {isLoading ? (
              <div className="flex items-center justify-center p-8 text-sm text-muted-foreground">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Carregando...
              </div>
            ) : cases.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-8 text-center text-sm text-muted-foreground">
                Nenhum processo sem cliente encontrado.
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {cases.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(c.id)}
                      className={`flex w-full items-start gap-3 p-3 text-left transition-colors hover:bg-muted/60 ${
                        selectedId === c.id ? "bg-muted" : ""
                      }`}
                    >
                      <div className="flex-1 space-y-1">
                        <div className="font-medium">{c.case_number}</div>
                        <div className="text-xs text-muted-foreground">
                          {c.court}
                          {c.subject ? ` · ${c.subject}` : ""}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Criado em{" "}
                          {format(new Date(c.created_at), "dd/MM/yyyy", { locale: ptBR })}
                        </div>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </ScrollArea>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleLink}
            disabled={!selectedId || linkMutation.isPending}
          >
            {linkMutation.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <LinkIcon className="mr-2 h-4 w-4" />
            )}
            Vincular processo
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
