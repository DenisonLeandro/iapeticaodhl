import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { PublicationFilters } from "@/types/publication";

interface PublicationFiltersBarProps {
  value: PublicationFilters;
  onChange: (next: PublicationFilters) => void;
}

export default function PublicationFiltersBar({
  value,
  onChange,
}: PublicationFiltersBarProps) {
  return (
    <div className="grid gap-3 md:grid-cols-4">
      <div className="md:col-span-2 space-y-1">
        <Label className="text-xs">Buscar no conteúdo</Label>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Palavra-chave, número, parte..."
            value={value.search ?? ""}
            onChange={(e) => onChange({ ...value, search: e.target.value })}
            className="pl-9"
          />
        </div>
      </div>

      <div className="space-y-1">
        <Label className="text-xs">Status</Label>
        <Select
          value={value.read ?? "all"}
          onValueChange={(v) =>
            onChange({ ...value, read: v as PublicationFilters["read"] })
          }
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            <SelectItem value="unread">Não lidas</SelectItem>
            <SelectItem value="read">Lidas</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1">
        <Label className="text-xs">Fonte</Label>
        <Select
          value={value.source ?? "all"}
          onValueChange={(v) =>
            onChange({ ...value, source: v as PublicationFilters["source"] })
          }
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            <SelectItem value="djen">DJEN</SelectItem>
            <SelectItem value="dje_sp">DJE-SP</SelectItem>
            <SelectItem value="dje_rj">DJE-RJ</SelectItem>
            <SelectItem value="dje_pe">DJE-PE</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
