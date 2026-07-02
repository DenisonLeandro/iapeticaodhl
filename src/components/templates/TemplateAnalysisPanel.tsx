import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import type { LegalTemplate } from "@/types/legalTemplate";

interface Props {
  template: LegalTemplate;
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      <div className="text-sm text-muted-foreground leading-relaxed">
        {children}
      </div>
    </div>
  );
}

export function TemplateAnalysisPanel({ template }: Props) {
  if (template.analysis_status !== "done") {
    return (
      <Card className="p-6">
        <p className="text-sm text-muted-foreground">
          {template.analysis_status === "processing" && "Análise em andamento…"}
          {template.analysis_status === "pending" && "Análise ainda não iniciada."}
          {template.analysis_status === "error" && (
            <>
              Erro na análise:{" "}
              <span className="text-destructive">
                {template.analysis_error ?? "erro desconhecido"}
              </span>
            </>
          )}
        </p>
      </Card>
    );
  }

  return (
    <Card className="p-6 space-y-6">
      {template.structure_summary && (
        <Section title="Resumo da estrutura">{template.structure_summary}</Section>
      )}
      {template.style_summary && (
        <>
          <Separator />
          <Section title="Estilo de escrita">{template.style_summary}</Section>
        </>
      )}
      {template.standard_sections?.length ? (
        <>
          <Separator />
          <Section title="Seções padrão">
            <ul className="list-disc pl-5 space-y-1">
              {template.standard_sections.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ul>
          </Section>
        </>
      ) : null}
      {template.writing_patterns && (
        <>
          <Separator />
          <Section title="Padrões de redação">
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {Object.entries(template.writing_patterns).map(([k, v]) => (
                <div key={k}>
                  <dt className="text-xs font-medium text-foreground">{k}</dt>
                  <dd>{String(v)}</dd>
                </div>
              ))}
            </dl>
          </Section>
        </>
      )}
      {template.request_patterns?.length ? (
        <>
          <Separator />
          <Section title="Padrões de pedidos">
            <ul className="list-disc pl-5 space-y-1">
              {template.request_patterns.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ul>
          </Section>
        </>
      ) : null}
      {template.risk_notes?.length ? (
        <>
          <Separator />
          <Section title="Cuidados e riscos">
            <ul className="list-disc pl-5 space-y-1">
              {template.risk_notes.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ul>
          </Section>
        </>
      ) : null}
      {template.usage_guidelines && (
        <>
          <Separator />
          <Section title="Diretrizes de uso">{template.usage_guidelines}</Section>
        </>
      )}
    </Card>
  );
}
