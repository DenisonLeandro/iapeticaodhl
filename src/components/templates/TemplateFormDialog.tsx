import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  LEGAL_AREAS,
  PIECE_TYPES,
  PROCEDURAL_STAGES,
  REPRESENTED_PARTIES,
} from "@/types/legalTemplate";
import {
  useCreateLegalTemplate,
  useUploadLegalTemplateFile,
  useAnalyzeLegalTemplate,
} from "@/hooks/useLegalTemplates";
import { useNavigate } from "react-router-dom";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TemplateFormDialog({ open, onOpenChange }: Props) {
  const { toast } = useToast();
  const navigate = useNavigate();
  const create = useCreateLegalTemplate();
  const upload = useUploadLegalTemplateFile();
  const analyze = useAnalyzeLegalTemplate();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [legalArea, setLegalArea] = useState<string>("");
  const [pieceType, setPieceType] = useState<string>("");
  const [mainTopic, setMainTopic] = useState("");
  const [subtopic, setSubtopic] = useState("");
  const [party, setParty] = useState<string>("");
  const [stage, setStage] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  const reset = () => {
    setName("");
    setDescription("");
    setLegalArea("");
    setPieceType("");
    setMainTopic("");
    setSubtopic("");
    setParty("");
    setStage("");
    setNotes("");
    setFile(null);
  };

  const submit = async () => {
    if (!name.trim()) {
      toast({ title: "Nome obrigatório", variant: "destructive" });
      return;
    }
    if (!file) {
      toast({ title: "Envie o arquivo do modelo", variant: "destructive" });
      return;
    }
    setBusy(true);
    try {
      const tpl = await create.mutateAsync({
        name: name.trim(),
        description: description.trim() || null,
        internal_notes: notes.trim() || null,
        legal_area: legalArea || null,
        piece_type: pieceType || null,
        main_topic: mainTopic.trim() || null,
        subtopic: subtopic.trim() || null,
        represented_party: party || null,
        procedural_stage: stage || null,
        status: "active",
      });
      try {
        await upload.mutateAsync({ id: tpl.id, file });
      } catch (uploadErr) {
        toast({
          title: "Falha no upload",
          description: `Modelo criado, mas o arquivo não foi enviado: ${(uploadErr as Error).message}. Abra o modelo e envie novamente.`,
          variant: "destructive",
        });
        onOpenChange(false);
        reset();
        navigate(`/templates/${tpl.id}`);
        return;
      }
      // Fire-and-forget analyze
      analyze.mutate(tpl.id);
      toast({
        title: "Modelo cadastrado",
        description: "A análise foi iniciada em segundo plano.",
      });
      onOpenChange(false);
      reset();
      navigate(`/templates/${tpl.id}`);
    } catch (e) {
      toast({ title: "Erro", description: (e as Error).message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Novo modelo</DialogTitle>
          <DialogDescription>
            Cadastre um modelo do escritório. A IA analisará apenas estrutura,
            estilo e padrões — nunca fatos, nomes ou valores de clientes antigos.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label htmlFor="tpl-name">Nome do modelo *</Label>
            <Input
              id="tpl-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex.: Inicial trabalhista — horas extras"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>Área jurídica</Label>
              <Select value={legalArea} onValueChange={setLegalArea}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {LEGAL_AREAS.map((a) => (
                    <SelectItem key={a} value={a}>{a}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Tipo de peça</Label>
              <Select value={pieceType} onValueChange={setPieceType}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {PIECE_TYPES.map((p) => (
                    <SelectItem key={p} value={p}>{p}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="tpl-topic">Tema/tese principal</Label>
              <Input
                id="tpl-topic"
                value={mainTopic}
                onChange={(e) => setMainTopic(e.target.value)}
                placeholder="Ex.: Horas extras"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="tpl-subtopic">Subtema</Label>
              <Input
                id="tpl-subtopic"
                value={subtopic}
                onChange={(e) => setSubtopic(e.target.value)}
                placeholder="Opcional"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>Polo representado</Label>
              <Select value={party} onValueChange={setParty}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {REPRESENTED_PARTIES.map((p) => (
                    <SelectItem key={p} value={p}>{p}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Fase processual</Label>
              <Select value={stage} onValueChange={setStage}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {PROCEDURAL_STAGES.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="tpl-desc">Descrição de uso</Label>
            <Textarea
              id="tpl-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="Quando usar este modelo"
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="tpl-notes">Observações internas</Label>
            <Textarea
              id="tpl-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="tpl-file">Arquivo do modelo *</Label>
            <Input
              id="tpl-file"
              type="file"
              accept=".docx,.pdf,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
            <p className="text-xs text-muted-foreground">
              Aceita .docx, .pdf ou .txt (até 20 MB). PDFs escaneados sem texto
              não serão analisados neste PR.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={busy}>
            {busy ? "Salvando…" : "Salvar e analisar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
