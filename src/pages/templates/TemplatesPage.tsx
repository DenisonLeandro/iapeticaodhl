import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Search } from "lucide-react";
import { useLegalTemplates } from "@/hooks/useLegalTemplates";
import { TemplateFormDialog } from "@/components/templates/TemplateFormDialog";
import {
  AnalysisBadge,
  StatusBadge,
} from "@/components/templates/TemplateStatusBadge";
import {
  LEGAL_AREAS,
  PIECE_TYPES,
  type LegalTemplateStatus,
} from "@/types/legalTemplate";

export default function TemplatesPage() {
  const [search, setSearch] = useState("");
  const [area, setArea] = useState<string>("all");
  const [pieceType, setPieceType] = useState<string>("all");
  const [status, setStatus] = useState<LegalTemplateStatus | "all">("all");
  const [openNew, setOpenNew] = useState(false);

  const filters = useMemo(
    () => ({
      status,
      legal_area: area === "all" ? undefined : area,
      piece_type: pieceType === "all" ? undefined : pieceType,
      search: search.trim() || undefined,
    }),
    [status, area, pieceType, search],
  );
  const { data: templates = [], isLoading } = useLegalTemplates(filters);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Modelos do Escritório</h1>
          <p className="text-muted-foreground">
            Biblioteca de modelos jurídicos usada como referência de estrutura e
            estilo — nunca como fonte de fatos.
          </p>
        </div>
        <Button onClick={() => setOpenNew(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Novo modelo
        </Button>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={area} onValueChange={setArea}>
          <SelectTrigger className="w-[200px]"><SelectValue placeholder="Área" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as áreas</SelectItem>
            {LEGAL_AREAS.map((a) => (
              <SelectItem key={a} value={a}>{a}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={pieceType} onValueChange={setPieceType}>
          <SelectTrigger className="w-[200px]"><SelectValue placeholder="Tipo de peça" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os tipos</SelectItem>
            {PIECE_TYPES.map((p) => (
              <SelectItem key={p} value={p}>{p}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={(v) => setStatus(v as LegalTemplateStatus | "all")}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            <SelectItem value="active">Ativos</SelectItem>
            <SelectItem value="inactive">Inativos</SelectItem>
            <SelectItem value="in_review">Em revisão</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Área</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Tema</TableHead>
              <TableHead>Polo</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Análise</TableHead>
              <TableHead className="w-[100px]">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-6">Carregando…</TableCell></TableRow>
            )}
            {!isLoading && templates.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground py-6">
                  Nenhum modelo cadastrado ainda.
                </TableCell>
              </TableRow>
            )}
            {templates.map((t) => (
              <TableRow key={t.id}>
                <TableCell className="font-medium">{t.name}</TableCell>
                <TableCell>{t.legal_area ?? "—"}</TableCell>
                <TableCell>{t.piece_type ?? "—"}</TableCell>
                <TableCell>{t.main_topic ?? "—"}</TableCell>
                <TableCell>{t.represented_party ?? "—"}</TableCell>
                <TableCell><StatusBadge status={t.status} /></TableCell>
                <TableCell><AnalysisBadge status={t.analysis_status} /></TableCell>
                <TableCell>
                  <Button variant="ghost" size="sm" asChild>
                    <Link to={`/templates/${t.id}`}>Abrir</Link>
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <TemplateFormDialog open={openNew} onOpenChange={setOpenNew} />
    </div>
  );
}
