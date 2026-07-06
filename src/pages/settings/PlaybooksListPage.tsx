// =============================================================================
// PR-4.5A — Aba "Playbooks Jurídicos" (Settings).
// =============================================================================
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Copy, Pencil, Power, Download, Trash2 } from "lucide-react";
import {
  useDeletePlaybook,
  useDuplicatePlaybook,
  useInstallMotoristaPlaybook,
  useLegalPlaybooks,
  useTogglePlaybookActive,
} from "@/hooks/useLegalPlaybooks";
import PlaybookEditorDialog from "@/components/settings/playbooks/PlaybookEditorDialog";
import type { LegalPlaybook } from "@/types/legalPlaybook";

export default function PlaybooksListPage() {
  const { data, isLoading } = useLegalPlaybooks();
  const install = useInstallMotoristaPlaybook();
  const toggle = useTogglePlaybookActive();
  const duplicate = useDuplicatePlaybook();
  const del = useDeletePlaybook();
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<LegalPlaybook | null>(null);

  const handleInstall = async () => {
    try {
      const res = await install.mutateAsync();
      if (res.alreadyExists) toast.info("Playbook Motorista já está ativo nesta organização.");
      else toast.success("Playbook Motorista instalado com sucesso.");
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold">Playbooks Jurídicos</h2>
          <p className="text-sm text-muted-foreground">
            Regras de conteúdo obrigatório aplicadas à geração e revisão de peças. O playbook é a régua de conteúdo; o modelo do escritório continua sendo a régua de estilo.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleInstall} disabled={install.isPending}>
            <Download className="mr-1 h-4 w-4" /> Instalar playbook padrão: Motorista Profissional
          </Button>
          <Button size="sm" onClick={() => { setEditing(null); setEditorOpen(true); }}>
            <Plus className="mr-1 h-4 w-4" /> Novo playbook
          </Button>
        </div>
      </div>

      {isLoading ? (
        <Skeleton className="h-40 w-full" />
      ) : (data?.length ?? 0) === 0 ? (
        <Card className="p-6 text-sm text-muted-foreground">
          Nenhum playbook cadastrado ainda. Clique em "Instalar playbook padrão" para começar com o de Motorista Profissional.
        </Card>
      ) : (
        <div className="space-y-2">
          {data!.map((p) => (
            <Card key={p.id} className="p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-medium">{p.name}</h3>
                    <Badge variant={p.is_active ? "default" : "secondary"}>
                      {p.is_active ? "Ativo" : "Inativo"}
                    </Badge>
                    <Badge variant="outline">v{p.version}</Badge>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {p.legal_area} · {p.document_type}{p.case_subtype ? ` · ${p.case_subtype}` : ""}
                  </p>
                  {p.description && <p className="mt-1 text-xs text-muted-foreground">{p.description}</p>}
                </div>
                <div className="flex flex-wrap gap-1">
                  <Button size="sm" variant="ghost" onClick={() => { setEditing(p); setEditorOpen(true); }}>
                    <Pencil className="mr-1 h-3 w-3" /> Editar
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => duplicate.mutate(p)}>
                    <Copy className="mr-1 h-3 w-3" /> Duplicar
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => toggle.mutate({ id: p.id, is_active: !p.is_active })}
                  >
                    <Power className="mr-1 h-3 w-3" /> {p.is_active ? "Desativar" : "Ativar"}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      if (confirm(`Excluir "${p.name}"?`)) del.mutate(p.id);
                    }}
                  >
                    <Trash2 className="mr-1 h-3 w-3" /> Excluir
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <PlaybookEditorDialog
        open={editorOpen}
        onOpenChange={setEditorOpen}
        playbook={editing}
      />
    </div>
  );
}
