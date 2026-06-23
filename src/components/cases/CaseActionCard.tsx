// =============================================================================
// CaseActionCard — PR-4.0A
// Card grande de ação principal (Analisar, Gerar, Revisar, Conversar).
// =============================================================================

import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  icon: LucideIcon;
  title: string;
  description: string;
  onClick: () => void;
  disabled?: boolean;
  disabledHint?: string;
  comingSoon?: boolean;
}

export default function CaseActionCard({
  icon: Icon,
  title,
  description,
  onClick,
  disabled,
  disabledHint,
  comingSoon,
}: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={disabled ? disabledHint : undefined}
      className={cn(
        "group relative flex h-full flex-col items-start gap-2 rounded-xl border border-border bg-card p-5 text-left transition-all",
        "hover:border-primary/60 hover:bg-accent/40 hover:shadow-sm",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        disabled && "cursor-not-allowed opacity-60 hover:border-border hover:bg-card hover:shadow-none",
      )}
    >
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary transition-colors group-hover:bg-primary/15">
        <Icon className="h-5 w-5" />
      </div>
      <div className="flex w-full items-center justify-between gap-2">
        <h3 className="font-display text-base font-semibold text-foreground">{title}</h3>
        {comingSoon && (
          <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            em breve
          </span>
        )}
      </div>
      <p className="text-sm text-muted-foreground">{description}</p>
    </button>
  );
}
