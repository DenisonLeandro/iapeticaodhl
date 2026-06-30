// =============================================================================
// PR-4.3A — Exibição das sugestões da IA (não sobrescreve campos)
// =============================================================================
import { Sparkles, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { CaseIntakeForm } from "@/types/caseIntake";
import { LEGAL_AREA_OPTIONS } from "@/types/caseIntake";

interface Props {
  intake: CaseIntakeForm | null;
  currentLegalArea: string | null | undefined;
  onApplyArea: (area: string) => void;
}

function Section({ title, items }: { title: string; items: string[] | null | undefined }) {
  if (!items || items.length === 0) return null;
  return (
    <div>
      <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h4>
      <ul className="list-disc space-y-1 pl-5 text-sm">
        {items.map((it, i) => (
          <li key={i}>{it}</li>
        ))}
      </ul>
    </div>
  );
}

export default function CaseIntakeAISuggestions({
  intake,
  currentLegalArea,
  onApplyArea,
}: Props) {
  if (!intake?.ai_suggested_at) return null;

  const suggestedArea = intake.ai_suggested_area;
  const areaOption = LEGAL_AREA_OPTIONS.find(
    (o) => o.value === suggestedArea || o.label.toLowerCase() === (suggestedArea ?? "").toLowerCase(),
  );
  const areaToApply = areaOption?.value ?? null;
  const canApplyArea = !!areaToApply && areaToApply !== currentLegalArea;

  return (
    <div className="space-y-4 rounded-xl border border-primary/30 bg-primary/5 p-5">
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-primary" />
        <h3 className="font-display text-base font-semibold">Sugestão preliminar da IA</h3>
      </div>

      {(suggestedArea || intake.ai_suggested_subtype) && (
        <div className="rounded-lg border border-border bg-card p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-sm">
              <p>
                <span className="text-muted-foreground">Área provável:</span>{" "}
                <strong>{areaOption?.label ?? suggestedArea ?? "—"}</strong>
              </p>
              {intake.ai_suggested_subtype && (
                <p>
                  <span className="text-muted-foreground">Subtipo provável:</span>{" "}
                  <strong>{intake.ai_suggested_subtype}</strong>
                </p>
              )}
            </div>
            {canApplyArea && (
              <Button size="sm" variant="outline" onClick={() => onApplyArea(areaToApply!)}>
                <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
                Aplicar área sugerida
              </Button>
            )}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Section title="Informações faltantes" items={intake.ai_missing_information} />
        <Section title="Perguntas complementares" items={intake.ai_complementary_questions} />
        <Section title="Documentos recomendados" items={intake.ai_recommended_documents} />
        <Section title="Riscos iniciais" items={intake.ai_initial_risks} />
        <Section title="Próximos passos" items={intake.ai_next_steps} />
      </div>

      <p className="text-xs text-muted-foreground">
        Esta é apenas uma sugestão preliminar. Confirme manualmente antes de aplicar à ficha.
      </p>
    </div>
  );
}
