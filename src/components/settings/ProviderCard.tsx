// =============================================================================
// ProviderCard — Selectable card for each AI provider
// Story 3.3 — AI Provider Settings
// =============================================================================

import { Bot, Sparkles, Brain, Zap } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { LLMProviderId } from "@/types/ai";
import type { ProviderOption } from "@/lib/ai/pricing";

interface ProviderCardProps {
  provider: ProviderOption;
  selected: boolean;
  onSelect: (id: LLMProviderId) => void;
}

const providerIcons: Record<LLMProviderId, React.ElementType> = {
  lovable: Zap,
  openai: Bot,
  gemini: Sparkles,
  claude: Brain,
};

const providerColors: Record<LLMProviderId, string> = {
  lovable: "border-primary/50 bg-primary/5",
  openai: "border-green-500/50 bg-green-500/5",
  gemini: "border-blue-500/50 bg-blue-500/5",
  claude: "border-orange-500/50 bg-orange-500/5",
};

const providerIconColors: Record<LLMProviderId, string> = {
  lovable: "text-primary",
  openai: "text-green-500",
  gemini: "text-blue-500",
  claude: "text-orange-500",
};

export default function ProviderCard({
  provider,
  selected,
  onSelect,
}: ProviderCardProps) {
  const Icon = providerIcons[provider.id];

  return (
    <Card
      role="radio"
      aria-checked={selected}
      tabIndex={0}
      className={cn(
        "cursor-pointer transition-all hover:shadow-md",
        selected
          ? cn(providerColors[provider.id], "ring-2 ring-primary")
          : "border-border hover:border-primary/30",
      )}
      onClick={() => onSelect(provider.id)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect(provider.id);
        }
      }}
    >
      <CardContent className="flex items-start gap-4 p-4">
        <div
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted",
            providerIconColors[provider.id],
          )}
        >
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-foreground">{provider.name}</h3>
            {provider.id === "lovable" && (
              <Badge variant="default" className="text-[10px] px-1.5 py-0">Recomendado</Badge>
            )}
          </div>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {provider.description}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
