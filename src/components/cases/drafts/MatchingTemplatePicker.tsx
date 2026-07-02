import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { RankedTemplate } from "@/services/templateMatching";

interface Props {
  templates: RankedTemplate[];
  value: string | null;
  onChange: (id: string | null) => void;
  loading?: boolean;
}

const NO_TEMPLATE = "__none__";

export default function MatchingTemplatePicker({
  templates,
  value,
  onChange,
  loading,
}: Props) {
  return (
    <div className="space-y-2">
      <Label>Modelo do Escritório</Label>
      <Select
        value={value ?? NO_TEMPLATE}
        onValueChange={(v) => onChange(v === NO_TEMPLATE ? null : v)}
      >
        <SelectTrigger>
          <SelectValue
            placeholder={loading ? "Buscando modelos compatíveis…" : "Selecione um modelo"}
          />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NO_TEMPLATE}>Sem modelo específico</SelectItem>
          {templates.map((r) => (
            <SelectItem key={r.template.id} value={r.template.id}>
              {r.template.name}
              {r.reasons.length > 0 ? ` — ${r.reasons.join(" · ")}` : ""}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {!loading && templates.length === 0 && (
        <Card className="border-dashed p-3 text-xs text-muted-foreground">
          Nenhum modelo compatível encontrado. A minuta será gerada sem referência
          de modelo do escritório.
        </Card>
      )}
    </div>
  );
}
