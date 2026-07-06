// =============================================================================
// PR-4.5A — Editor de Playbook em Dialog (MVP).
// Cards por seção + JSON avançado opcional.
// =============================================================================
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Plus, Trash2 } from "lucide-react";
import type {
  LegalPlaybook,
  PlaybookChecklistItem,
  PlaybookConfig,
  PlaybookDocumentItem,
  PlaybookRequiredItem,
  PlaybookSensitiveThesis,
} from "@/types/legalPlaybook";
import { useCreatePlaybook, useUpdatePlaybook } from "@/hooks/useLegalPlaybooks";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  playbook: LegalPlaybook | null;
}

const EMPTY_CFG: PlaybookConfig = {
  required_blocks: [],
  required_requests: [],
  document_requests: [],
  sensitive_theses: [],
  review_checklist: [],
  drafting_instructions: [],
};

export default function PlaybookEditorDialog({ open, onOpenChange, playbook }: Props) {
  const create = useCreatePlaybook();
  const update = useUpdatePlaybook();

  const [name, setName] = useState("");
  const [legalArea, setLegalArea] = useState("trabalhista");
  const [documentType, setDocumentType] = useState("peticao_inicial");
  const [caseSubtype, setCaseSubtype] = useState("");
  const [description, setDescription] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [config, setConfig] = useState<PlaybookConfig>(EMPTY_CFG);
  const [jsonText, setJsonText] = useState("");
  const [jsonError, setJsonError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    if (playbook) {
      setName(playbook.name);
      setLegalArea(playbook.legal_area);
      setDocumentType(playbook.document_type);
      setCaseSubtype(playbook.case_subtype ?? "");
      setDescription(playbook.description ?? "");
      setIsActive(playbook.is_active);
      setConfig({ ...EMPTY_CFG, ...(playbook.config ?? {}) });
    } else {
      setName(""); setLegalArea("trabalhista"); setDocumentType("peticao_inicial");
      setCaseSubtype(""); setDescription(""); setIsActive(true); setConfig(EMPTY_CFG);
    }
    setJsonError(null);
  }, [open, playbook]);

  useEffect(() => {
    setJsonText(JSON.stringify(config, null, 2));
  }, [config]);

  const handleSave = async () => {
    if (!name.trim() || !legalArea.trim() || !documentType.trim()) {
      toast.error("Preencha nome, área e tipo de peça.");
      return;
    }
    try {
      const patch = {
        name: name.trim(),
        legal_area: legalArea.trim().toLowerCase(),
        document_type: documentType.trim().toLowerCase(),
        case_subtype: caseSubtype.trim() ? caseSubtype.trim().toLowerCase() : null,
        description: description.trim() || null,
        is_active: isActive,
        config,
      };
      if (playbook) {
        await update.mutateAsync({ id: playbook.id, patch });
        toast.success("Playbook atualizado.");
      } else {
        await create.mutateAsync(patch);
        toast.success("Playbook criado.");
      }
      onOpenChange(false);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const applyJson = () => {
    try {
      const parsed = JSON.parse(jsonText);
      if (typeof parsed !== "object" || parsed === null) throw new Error("JSON precisa ser um objeto");
      setConfig({ ...EMPTY_CFG, ...parsed });
      setJsonError(null);
      toast.success("JSON aplicado às seções.");
    } catch (e) {
      setJsonError((e as Error).message);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{playbook ? "Editar playbook" : "Novo playbook"}</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="general">
          <TabsList className="flex flex-wrap h-auto gap-1">
            <TabsTrigger value="general">Dados gerais</TabsTrigger>
            <TabsTrigger value="blocks">Blocos ({config.required_blocks?.length ?? 0})</TabsTrigger>
            <TabsTrigger value="requests">Pedidos ({config.required_requests?.length ?? 0})</TabsTrigger>
            <TabsTrigger value="docs">Documentos ({config.document_requests?.length ?? 0})</TabsTrigger>
            <TabsTrigger value="theses">Teses sensíveis ({config.sensitive_theses?.length ?? 0})</TabsTrigger>
            <TabsTrigger value="checklist">Checklist ({config.review_checklist?.length ?? 0})</TabsTrigger>
            <TabsTrigger value="instructions">Instruções</TabsTrigger>
            <TabsTrigger value="json">JSON avançado</TabsTrigger>
          </TabsList>

          <TabsContent value="general" className="space-y-3">
            <div className="grid gap-3 md:grid-cols-2">
              <div><Label>Nome</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
              <div className="flex items-end gap-2">
                <Switch checked={isActive} onCheckedChange={setIsActive} />
                <Label>Ativo</Label>
              </div>
              <div><Label>Área jurídica</Label><Input value={legalArea} onChange={(e) => setLegalArea(e.target.value)} placeholder="ex: trabalhista" /></div>
              <div><Label>Tipo de peça</Label><Input value={documentType} onChange={(e) => setDocumentType(e.target.value)} placeholder="ex: peticao_inicial" /></div>
              <div><Label>Subtipo (opcional)</Label><Input value={caseSubtype} onChange={(e) => setCaseSubtype(e.target.value)} placeholder="ex: motorista_profissional" /></div>
            </div>
            <div><Label>Descrição</Label><Textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} /></div>
          </TabsContent>

          <TabsContent value="blocks">
            <RequiredItemsEditor
              items={config.required_blocks ?? []}
              onChange={(v) => setConfig((c) => ({ ...c, required_blocks: v }))}
              placementSupported
            />
          </TabsContent>
          <TabsContent value="requests">
            <RequiredItemsEditor
              items={config.required_requests ?? []}
              onChange={(v) => setConfig((c) => ({ ...c, required_requests: v }))}
            />
          </TabsContent>
          <TabsContent value="docs">
            <DocumentsEditor
              items={config.document_requests ?? []}
              onChange={(v) => setConfig((c) => ({ ...c, document_requests: v }))}
            />
          </TabsContent>
          <TabsContent value="theses">
            <ThesesEditor
              items={config.sensitive_theses ?? []}
              onChange={(v) => setConfig((c) => ({ ...c, sensitive_theses: v }))}
            />
          </TabsContent>
          <TabsContent value="checklist">
            <ChecklistEditor
              items={config.review_checklist ?? []}
              onChange={(v) => setConfig((c) => ({ ...c, review_checklist: v }))}
            />
          </TabsContent>
          <TabsContent value="instructions">
            <InstructionsEditor
              items={config.drafting_instructions ?? []}
              onChange={(v) => setConfig((c) => ({ ...c, drafting_instructions: v }))}
            />
          </TabsContent>
          <TabsContent value="json" className="space-y-2">
            <p className="text-xs text-muted-foreground">
              Edição avançada opcional. Aplique para propagar às seções.
            </p>
            <Textarea rows={20} value={jsonText} onChange={(e) => setJsonText(e.target.value)} className="font-mono text-xs" />
            {jsonError && <p className="text-xs text-red-600">Erro: {jsonError}</p>}
            <Button size="sm" variant="outline" onClick={applyJson}>Aplicar JSON</Button>
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave} disabled={create.isPending || update.isPending}>
            Salvar playbook
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// -------------------- sub-editores --------------------

function csvToArr(v: string): string[] {
  return v.split(",").map((s) => s.trim()).filter(Boolean);
}
function arrToCsv(v: string[] | undefined): string { return (v ?? []).join(", "); }

function SeveritySelect({ value, onChange }: { value: string | undefined; onChange: (v: string) => void }) {
  return (
    <Select value={value ?? "atencao"} onValueChange={onChange}>
      <SelectTrigger><SelectValue /></SelectTrigger>
      <SelectContent>
        <SelectItem value="risco_alto">Risco alto</SelectItem>
        <SelectItem value="atencao">Atenção</SelectItem>
        <SelectItem value="pendencia_documental">Pendência documental</SelectItem>
        <SelectItem value="sugestao_estrategica">Sugestão estratégica</SelectItem>
      </SelectContent>
    </Select>
  );
}

function RequiredItemsEditor({
  items, onChange, placementSupported,
}: { items: PlaybookRequiredItem[]; onChange: (v: PlaybookRequiredItem[]) => void; placementSupported?: boolean }) {
  const add = () => onChange([...items, { key: `novo_${Date.now()}`, title: "", required: true, applicability: "always", keywords: [], severity_if_missing: "atencao" }]);
  const upd = (i: number, patch: Partial<PlaybookRequiredItem>) => onChange(items.map((it, idx) => idx === i ? { ...it, ...patch } : it));
  const del = (i: number) => onChange(items.filter((_, idx) => idx !== i));
  return (
    <div className="space-y-2">
      <Button size="sm" variant="outline" onClick={add}><Plus className="mr-1 h-3 w-3" /> Adicionar</Button>
      {items.map((it, i) => (
        <Card key={i} className="space-y-2 p-3">
          <div className="grid gap-2 md:grid-cols-2">
            <div><Label>Key</Label><Input value={it.key} onChange={(e) => upd(i, { key: e.target.value })} /></div>
            <div><Label>Título</Label><Input value={it.title} onChange={(e) => upd(i, { title: e.target.value })} /></div>
            <div className="flex items-end gap-2">
              <Switch checked={it.required} onCheckedChange={(v) => upd(i, { required: v })} />
              <Label>Obrigatório</Label>
            </div>
            <div>
              <Label>Applicability</Label>
              <Select value={it.applicability ?? "always"} onValueChange={(v) => upd(i, { applicability: v as PlaybookRequiredItem["applicability"] })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="always">Sempre</SelectItem>
                  <SelectItem value="if_claim_present">Se pedido presente</SelectItem>
                  <SelectItem value="optional">Opcional</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-2">
              <Label>Keywords (CSV)</Label>
              <Input value={arrToCsv(it.keywords)} onChange={(e) => upd(i, { keywords: csvToArr(e.target.value) })} />
            </div>
            {placementSupported && (
              <div className="md:col-span-2">
                <Label>Placement</Label>
                <Input value={it.placement ?? ""} onChange={(e) => upd(i, { placement: e.target.value })} placeholder="ex: before_requests" />
              </div>
            )}
            <div>
              <Label>Severidade se ausente</Label>
              <SeveritySelect value={it.severity_if_missing} onChange={(v) => upd(i, { severity_if_missing: v as PlaybookRequiredItem["severity_if_missing"] })} />
            </div>
            <div className="md:col-span-2">
              <Label>Texto padrão (sugestão copiável)</Label>
              <Textarea rows={2} value={it.default_text ?? ""} onChange={(e) => upd(i, { default_text: e.target.value })} />
            </div>
          </div>
          <Button size="sm" variant="ghost" onClick={() => del(i)}><Trash2 className="mr-1 h-3 w-3" /> Remover</Button>
        </Card>
      ))}
    </div>
  );
}

function DocumentsEditor({ items, onChange }: { items: PlaybookDocumentItem[]; onChange: (v: PlaybookDocumentItem[]) => void }) {
  const add = () => onChange([...items, { key: `doc_${Date.now()}`, label: "", importance: "obrigatorio", keywords: [] }]);
  const upd = (i: number, patch: Partial<PlaybookDocumentItem>) => onChange(items.map((it, idx) => idx === i ? { ...it, ...patch } : it));
  const del = (i: number) => onChange(items.filter((_, idx) => idx !== i));
  return (
    <div className="space-y-2">
      <Button size="sm" variant="outline" onClick={add}><Plus className="mr-1 h-3 w-3" /> Adicionar</Button>
      {items.map((it, i) => (
        <Card key={i} className="space-y-2 p-3">
          <div className="grid gap-2 md:grid-cols-2">
            <div><Label>Key</Label><Input value={it.key} onChange={(e) => upd(i, { key: e.target.value })} /></div>
            <div><Label>Nome</Label><Input value={it.label} onChange={(e) => upd(i, { label: e.target.value })} /></div>
            <div>
              <Label>Importância</Label>
              <Select value={it.importance} onValueChange={(v) => upd(i, { importance: v as PlaybookDocumentItem["importance"] })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="obrigatorio">Obrigatório</SelectItem>
                  <SelectItem value="recomendado">Recomendado</SelectItem>
                  <SelectItem value="se_aplicavel">Se aplicável</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-2">
              <Label>Keywords (CSV)</Label>
              <Input value={arrToCsv(it.keywords)} onChange={(e) => upd(i, { keywords: csvToArr(e.target.value) })} />
            </div>
            <div className="md:col-span-2">
              <Label>Observação</Label>
              <Input value={it.observation ?? ""} onChange={(e) => upd(i, { observation: e.target.value })} />
            </div>
          </div>
          <Button size="sm" variant="ghost" onClick={() => del(i)}><Trash2 className="mr-1 h-3 w-3" /> Remover</Button>
        </Card>
      ))}
    </div>
  );
}

function ThesesEditor({ items, onChange }: { items: PlaybookSensitiveThesis[]; onChange: (v: PlaybookSensitiveThesis[]) => void }) {
  const add = () => onChange([...items, { key: `tese_${Date.now()}`, label: "", warning: "", required_marker: "", keywords: [], severity: "atencao" }]);
  const upd = (i: number, patch: Partial<PlaybookSensitiveThesis>) => onChange(items.map((it, idx) => idx === i ? { ...it, ...patch } : it));
  const del = (i: number) => onChange(items.filter((_, idx) => idx !== i));
  return (
    <div className="space-y-2">
      <Button size="sm" variant="outline" onClick={add}><Plus className="mr-1 h-3 w-3" /> Adicionar</Button>
      {items.map((it, i) => (
        <Card key={i} className="space-y-2 p-3">
          <div className="grid gap-2 md:grid-cols-2">
            <div><Label>Key</Label><Input value={it.key} onChange={(e) => upd(i, { key: e.target.value })} /></div>
            <div><Label>Tema</Label><Input value={it.label} onChange={(e) => upd(i, { label: e.target.value })} /></div>
            <div className="md:col-span-2"><Label>Warning</Label><Textarea rows={2} value={it.warning} onChange={(e) => upd(i, { warning: e.target.value })} /></div>
            <div className="md:col-span-2"><Label>Marcador obrigatório</Label><Input value={it.required_marker ?? ""} onChange={(e) => upd(i, { required_marker: e.target.value })} /></div>
            <div className="md:col-span-2"><Label>Keywords (CSV)</Label><Input value={arrToCsv(it.keywords)} onChange={(e) => upd(i, { keywords: csvToArr(e.target.value) })} /></div>
            <div><Label>Severidade</Label><SeveritySelect value={it.severity} onChange={(v) => upd(i, { severity: v as PlaybookSensitiveThesis["severity"] })} /></div>
          </div>
          <Button size="sm" variant="ghost" onClick={() => del(i)}><Trash2 className="mr-1 h-3 w-3" /> Remover</Button>
        </Card>
      ))}
    </div>
  );
}

function ChecklistEditor({ items, onChange }: { items: PlaybookChecklistItem[]; onChange: (v: PlaybookChecklistItem[]) => void }) {
  const add = () => onChange([...items, { key: `chk_${Date.now()}`, label: "", required: true, severity: "atencao" }]);
  const upd = (i: number, patch: Partial<PlaybookChecklistItem>) => onChange(items.map((it, idx) => idx === i ? { ...it, ...patch } : it));
  const del = (i: number) => onChange(items.filter((_, idx) => idx !== i));
  return (
    <div className="space-y-2">
      <Button size="sm" variant="outline" onClick={add}><Plus className="mr-1 h-3 w-3" /> Adicionar</Button>
      {items.map((it, i) => (
        <Card key={i} className="space-y-2 p-3">
          <div className="grid gap-2 md:grid-cols-2">
            <div><Label>Key</Label><Input value={it.key} onChange={(e) => upd(i, { key: e.target.value })} /></div>
            <div><Label>Pergunta</Label><Input value={it.label} onChange={(e) => upd(i, { label: e.target.value })} /></div>
            <div className="flex items-end gap-2"><Switch checked={it.required} onCheckedChange={(v) => upd(i, { required: v })} /><Label>Obrigatório</Label></div>
            <div><Label>Severidade</Label><SeveritySelect value={it.severity} onChange={(v) => upd(i, { severity: v as PlaybookChecklistItem["severity"] })} /></div>
          </div>
          <Button size="sm" variant="ghost" onClick={() => del(i)}><Trash2 className="mr-1 h-3 w-3" /> Remover</Button>
        </Card>
      ))}
    </div>
  );
}

function InstructionsEditor({ items, onChange }: { items: string[]; onChange: (v: string[]) => void }) {
  const text = useMemo(() => items.join("\n"), [items]);
  return (
    <div className="space-y-2">
      <Label>Uma instrução por linha</Label>
      <Textarea rows={10} value={text} onChange={(e) => onChange(e.target.value.split("\n").map((s) => s.trim()).filter(Boolean))} />
    </div>
  );
}
