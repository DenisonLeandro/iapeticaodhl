// =============================================================================
// JurisprudenceSearch — Search and select jurisprudence from Brazilian courts
// Story 3.2 — Jurisprudence Search Integration
// =============================================================================

import { useCallback } from "react";
import {
  Search,
  Plus,
  X,
  AlertTriangle,
  ExternalLink,
  Scale,
  Loader2,
  Database,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";
import { useJurisprudenceSearch } from "@/hooks/useJurisprudenceSearch";
import { COURTS } from "@/types/jurisprudence";
import type { CourtId, JurisprudenceResult } from "@/types/jurisprudence";

// ---------------------------------------------------------------------------
// Court badge color mapping
// ---------------------------------------------------------------------------
const COURT_BADGE_VARIANT: Record<CourtId, "default" | "secondary" | "outline"> = {
  STF: "default",
  STJ: "secondary",
  TJPE: "outline",
};

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------
interface JurisprudenceSearchProps {
  /** Callback when selected results change */
  onSelectionChange?: (results: JurisprudenceResult[]) => void;
  /** Initial selected results */
  initialSelected?: JurisprudenceResult[];
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function JurisprudenceSearch({
  onSelectionChange,
  initialSelected,
}: JurisprudenceSearchProps) {
  const {
    query,
    setQuery,
    courts,
    toggleCourt,
    results,
    warnings,
    fromCache,
    isLoading,
    error,
    search,
    loadMore,
    hasMore,
    selectedResults,
    addResult,
    removeResult,
  } = useJurisprudenceSearch();

  // Sync initial selection
  // (We use the hook's internal state but also notify parent)
  const handleAdd = useCallback(
    (result: JurisprudenceResult) => {
      addResult(result);
      onSelectionChange?.([...selectedResults, result]);
    },
    [addResult, selectedResults, onSelectionChange],
  );

  const handleRemove = useCallback(
    (caseNumber: string) => {
      removeResult(caseNumber);
      onSelectionChange?.(
        selectedResults.filter((r) => r.caseNumber !== caseNumber),
      );
    },
    [removeResult, selectedResults, onSelectionChange],
  );

  const isSelected = (caseNumber: string) =>
    selectedResults.some((r) => r.caseNumber === caseNumber) ||
    initialSelected?.some((r) => r.caseNumber === caseNumber);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      search();
    }
  };

  return (
    <div className="space-y-6">
      {/* Search Input */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Scale className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold">Busca de Jurisprudência</h3>
        </div>

        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar jurisprudência (ex: dano moral, responsabilidade civil...)"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              className="pl-10"
            />
          </div>
          <Button
            onClick={search}
            disabled={isLoading || query.trim().length < 3}
          >
            {isLoading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Search className="mr-2 h-4 w-4" />
            )}
            Buscar
          </Button>
        </div>

        {/* Court Filters */}
        <div className="flex items-center gap-4">
          <span className="text-sm font-medium text-muted-foreground">
            Tribunais:
          </span>
          {COURTS.map((court) => (
            <label
              key={court.id}
              className="flex items-center gap-2 cursor-pointer"
            >
              <Checkbox
                checked={courts.includes(court.id)}
                onCheckedChange={() => toggleCourt(court.id)}
              />
              <span className="text-sm" title={court.fullName}>
                {court.name}
              </span>
            </label>
          ))}
        </div>
      </div>

      {/* Warnings */}
      {warnings.length > 0 && (
        <div className="space-y-2">
          {warnings.map((warning) => (
            <Alert key={warning.court} variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>{warning.court}</AlertTitle>
              <AlertDescription>{warning.message}</AlertDescription>
            </Alert>
          ))}
        </div>
      )}

      {/* Error */}
      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Erro na busca</AlertTitle>
          <AlertDescription>{error.message}</AlertDescription>
        </Alert>
      )}

      {/* Cache indicator */}
      {fromCache && results.length > 0 && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Database className="h-3.5 w-3.5" />
          <span>Resultados do cache (atualizado nas últimas 24h)</span>
        </div>
      )}

      {/* Loading */}
      {isLoading && (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <Loader2 className="h-8 w-8 animate-spin mb-3" />
          <p className="text-sm">Consultando tribunais...</p>
        </div>
      )}

      {/* Empty state */}
      {!isLoading && !error && query.trim().length >= 3 && results.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <Scale className="h-8 w-8 mb-3" />
          <p className="text-sm">Nenhum resultado encontrado.</p>
          <p className="text-xs">Tente termos diferentes ou selecione outros tribunais.</p>
        </div>
      )}

      {/* Initial state */}
      {!isLoading && query.trim().length < 3 && results.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <Search className="h-8 w-8 mb-3" />
          <p className="text-sm">
            Digite pelo menos 3 caracteres para buscar jurisprudência.
          </p>
        </div>
      )}

      {!isLoading && results.length > 0 && (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Exibindo {results.length} resultado{results.length !== 1 ? "s" : ""}
          </p>
          {results.map((result) => (
            <Card key={`${result.court}-${result.caseNumber}`} className="overflow-hidden">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0 space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant={COURT_BADGE_VARIANT[result.court]}>
                        {result.court}
                      </Badge>
                      <span className="font-mono text-sm font-medium">
                        {result.caseNumber}
                      </span>
                      {result.date && (
                        <span className="text-xs text-muted-foreground">
                          {formatDate(result.date)}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-3">
                      {result.summary}
                    </p>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      {result.relator && (
                        <span>Relator(a): {result.relator}</span>
                      )}
                      {result.orgaoJulgador && (
                        <span>{result.orgaoJulgador}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col gap-2 shrink-0">
                    {isSelected(result.caseNumber) ? (
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleRemove(result.caseNumber)}
                      >
                        <X className="mr-1 h-3.5 w-3.5" />
                        Remover
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleAdd(result)}
                      >
                        <Plus className="mr-1 h-3.5 w-3.5" />
                        Adicionar
                      </Button>
                    )}
                    {result.link && (
                      <Button
                        size="sm"
                        variant="ghost"
                        asChild
                      >
                        <a
                          href={result.link}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <ExternalLink className="mr-1 h-3.5 w-3.5" />
                          Ver
                        </a>
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
          {hasMore && (
            <div className="flex justify-center pt-2">
              <Button
                variant="outline"
                onClick={loadMore}
                disabled={isLoading}
              >
                {isLoading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Search className="mr-2 h-4 w-4" />
                )}
                Buscar mais
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Selected Results Summary */}
      {selectedResults.length > 0 && (
        <>
          <Separator />
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">
                Jurisprudência Selecionada ({selectedResults.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {selectedResults.map((result) => (
                <div
                  key={`selected-${result.court}-${result.caseNumber}`}
                  className="flex items-center justify-between rounded-md border p-2"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Badge
                      variant={COURT_BADGE_VARIANT[result.court]}
                      className="shrink-0"
                    >
                      {result.court}
                    </Badge>
                    <span className="text-sm font-mono truncate">
                      {result.caseNumber}
                    </span>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="shrink-0 text-destructive hover:text-destructive"
                    onClick={() => handleRemove(result.caseNumber)}
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function formatDate(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
}
