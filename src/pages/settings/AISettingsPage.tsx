// =============================================================================
// AISettingsPage — /settings/integrations
// Story 3.3 — AI Provider Settings
// =============================================================================

import { useEffect, useState } from "react";
import { Eye, EyeOff, Loader2, Plug, Save } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";

import ProviderCard from "@/components/settings/ProviderCard";
import { useAISettings } from "@/hooks/useAISettings";
import { maskApiKey } from "@/services/aiSettings";
import { AI_PROVIDERS, getProviderOption } from "@/lib/ai/pricing";
import type { LLMProviderId } from "@/types/ai";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatNumber(n: number): string {
  return new Intl.NumberFormat("pt-BR").format(n);
}

function formatCurrency(n: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 4,
    maximumFractionDigits: 4,
  }).format(n);
}

const isExternalProvider = (p: LLMProviderId) => p !== "lovable";

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function AISettingsPage() {
  const {
    config,
    isLoadingConfig,
    saveConfig,
    isSaving,
    testConnection,
    isTesting,
    testResult,
    usageStats,
    isLoadingUsage,
  } = useAISettings();

  // Form state — default to Lovable AI
  const [provider, setProvider] = useState<LLMProviderId>("lovable");
  const [model, setModel] = useState("google/gemini-3-flash-preview");
  const [apiKey, setApiKey] = useState("");
  const [showApiKey, setShowApiKey] = useState(false);
  const [maxDocsPerMonth, setMaxDocsPerMonth] = useState<number | "">("");
  const [hasExistingKey, setHasExistingKey] = useState(false);

  // Sync form with fetched config
  useEffect(() => {
    if (config) {
      setProvider(config.provider);
      setModel(config.model);
      setMaxDocsPerMonth(config.max_docs_per_month ?? "");
      if (config.api_key) {
        setHasExistingKey(true);
        setApiKey("");
      }
    }
  }, [config]);

  // When provider changes, reset model to the first available
  const handleProviderChange = (newProvider: LLMProviderId) => {
    setProvider(newProvider);
    const providerInfo = getProviderOption(newProvider);
    if (providerInfo && providerInfo.models.length > 0) {
      setModel(providerInfo.models[0].id);
    }
    // Reset API key state when switching
    if (!isExternalProvider(newProvider)) {
      setApiKey("");
      setHasExistingKey(false);
    }
  };

  const currentProviderOption = getProviderOption(provider);
  const availableModels = currentProviderOption?.models ?? [];
  const needsApiKey = isExternalProvider(provider);

  // -------------------------------------------------------------------------
  // Save
  // -------------------------------------------------------------------------
  const handleSave = async () => {
    if (needsApiKey && !apiKey && !hasExistingKey) {
      toast.error("Informe a chave de API do provedor");
      return;
    }

    try {
      await saveConfig({
        provider,
        model,
        api_key: needsApiKey ? (apiKey || (config?.api_key ?? "")) : "",
        max_docs_per_month:
          maxDocsPerMonth === "" ? undefined : Number(maxDocsPerMonth),
      });
      toast.success("Configuração de IA salva com sucesso");
      if (apiKey) {
        setHasExistingKey(true);
        setApiKey("");
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro desconhecido";
      toast.error(`Erro ao salvar: ${message}`);
    }
  };

  // -------------------------------------------------------------------------
  // Test Connection
  // -------------------------------------------------------------------------
  const handleTestConnection = async () => {
    try {
      const result = await testConnection(provider, model);
      if (result.success) {
        toast.success(
          `Conexão bem-sucedida! Latência: ${result.latency_ms}ms`,
        );
      } else {
        toast.error(`Falha na conexão: ${result.error}`);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro desconhecido";
      toast.error(`Erro ao testar conexão: ${message}`);
    }
  };

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  if (isLoadingConfig) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">
            Integrações de IA
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Configure o provedor de inteligência artificial da sua organização
          </p>
        </div>
        <div className="space-y-4">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="font-display text-2xl font-bold text-foreground">
          Integrações de IA
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Configure o provedor de inteligência artificial da sua organização
        </p>
      </div>

      {/* Provider Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Provedor de IA</CardTitle>
          <CardDescription>
            Selecione qual provedor será utilizado para geração de documentos
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {AI_PROVIDERS.map((p) => (
            <ProviderCard
              key={p.id}
              provider={p}
              selected={provider === p.id}
              onSelect={handleProviderChange}
            />
          ))}
        </CardContent>
      </Card>

      {/* Model & API Key */}
      <Card className={!needsApiKey ? "opacity-60 pointer-events-none" : ""}>
        <CardHeader>
          <CardTitle className="text-lg">Configuração do Modelo</CardTitle>
          <CardDescription>
            {needsApiKey
              ? "Escolha o modelo e informe sua chave de API"
              : "Configuração automática — Lovable AI gerencia o modelo ideal"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">

          {/* Model selector */}
          <div className="space-y-2">
            <Label htmlFor="model-select">Modelo</Label>
            <Select value={model} onValueChange={setModel}>
              <SelectTrigger id="model-select">
                <SelectValue placeholder="Selecione um modelo" />
              </SelectTrigger>
              <SelectContent>
                {availableModels.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* API Key — only for external providers */}
          {needsApiKey && (
            <div className="space-y-2">
              <Label htmlFor="api-key">Chave de API</Label>
              <div className="relative">
                <Input
                  id="api-key"
                  type={showApiKey ? "text" : "password"}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder={
                    hasExistingKey
                      ? `Chave existente: ${maskApiKey(config?.api_key ?? "")}`
                      : "Insira a chave de API do provedor"
                  }
                  className="pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-10 w-10"
                  onClick={() => setShowApiKey(!showApiKey)}
                >
                  {showApiKey ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </Button>
              </div>
              {hasExistingKey && (
                <p className="text-xs text-muted-foreground">
                  Deixe em branco para manter a chave atual. Preencha para
                  substituir.
                </p>
              )}
            </div>
          )}

          {/* Max docs per month */}
          <div className="space-y-2">
            <Label htmlFor="max-docs">
              Limite mensal de documentos (opcional)
            </Label>
            <Input
              id="max-docs"
              type="number"
              min={0}
              value={maxDocsPerMonth}
              onChange={(e) =>
                setMaxDocsPerMonth(
                  e.target.value === "" ? "" : Number(e.target.value),
                )
              }
              placeholder="Sem limite"
            />
            <p className="text-xs text-muted-foreground">
              Defina um limite de documentos gerados por mês para controlar
              custos
            </p>
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap gap-3 pt-2">
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              Salvar Configuração
            </Button>

            <Button
              variant="outline"
              onClick={handleTestConnection}
              disabled={isTesting || (needsApiKey && !hasExistingKey && !apiKey)}
            >
              {isTesting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Plug className="mr-2 h-4 w-4" />
              )}
              Testar Conexão
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Usage Stats */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Uso Mensal</CardTitle>
          <CardDescription>
            Consumo de tokens e custo estimado no mês corrente
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoadingUsage ? (
            <div className="space-y-3">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          ) : !usageStats || usageStats.totals.calls === 0 ? (
            <div className="rounded-lg border border-border bg-muted/50 p-6 text-center text-sm text-muted-foreground">
              Nenhum uso registrado neste mês
            </div>
          ) : (
            <div className="space-y-4">
              {/* Totals */}
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <StatCard
                  label="Chamadas"
                  value={formatNumber(usageStats.totals.calls)}
                />
                <StatCard
                  label="Tokens de Entrada"
                  value={formatNumber(usageStats.totals.input_tokens)}
                />
                <StatCard
                  label="Tokens de Saída"
                  value={formatNumber(usageStats.totals.output_tokens)}
                />
                <StatCard
                  label="Custo Estimado"
                  value={formatCurrency(usageStats.totals.cost)}
                  highlight
                />
              </div>

              {/* Per provider */}
              {usageStats.byProvider.length > 1 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-medium text-foreground">
                    Por provedor
                  </h4>
                  <div className="divide-y divide-border rounded-lg border border-border">
                    {usageStats.byProvider.map((row) => (
                      <div
                        key={row.provider}
                        className="flex items-center justify-between px-4 py-3"
                      >
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">{row.provider}</Badge>
                          <span className="text-sm text-muted-foreground">
                            {formatNumber(row.total_calls)} chamadas
                          </span>
                        </div>
                        <div className="text-right text-sm">
                          <span className="font-medium">
                            {formatCurrency(row.cost_estimated)}
                          </span>
                          <span className="ml-2 text-muted-foreground">
                            ({formatNumber(row.total_input_tokens + row.total_output_tokens)}{" "}
                            tokens)
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// StatCard — small metrics card
// ---------------------------------------------------------------------------

function StatCard({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="rounded-lg border border-border bg-muted/30 p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p
        className={
          highlight
            ? "mt-1 text-lg font-bold text-primary"
            : "mt-1 text-lg font-semibold text-foreground"
        }
      >
        {value}
      </p>
    </div>
  );
}
