// =============================================================================
// useJurisprudenceSearch — React Query hook with debounced search + pagination
// Story 3.2 — Jurisprudence Search Integration
// =============================================================================

import { useCallback, useEffect, useRef, useState } from "react";
import { searchJurisprudence } from "@/services/jurisprudence";
import type {
  CourtId,
  JurisprudenceResult,
  JurisprudenceSearchWarning,
} from "@/types/jurisprudence";

const DEBOUNCE_MS = 500;
const PAGE_SIZE = 3;

interface UseJurisprudenceSearchReturn {
  query: string;
  setQuery: (q: string) => void;
  courts: CourtId[];
  toggleCourt: (court: CourtId) => void;
  setCourts: (courts: CourtId[]) => void;
  results: JurisprudenceResult[];
  warnings: JurisprudenceSearchWarning[];
  fromCache: boolean;
  isLoading: boolean;
  error: Error | null;
  search: () => void;
  loadMore: () => void;
  hasMore: boolean;
  selectedResults: JurisprudenceResult[];
  addResult: (result: JurisprudenceResult) => void;
  removeResult: (caseNumber: string) => void;
  clearSelected: () => void;
}

export function useJurisprudenceSearch(): UseJurisprudenceSearchReturn {
  const [query, setQueryRaw] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [courts, setCourts] = useState<CourtId[]>(["STF", "STJ", "TJPE"]);
  const [selectedResults, setSelectedResults] = useState<JurisprudenceResult[]>([]);

  // Pagination state
  const [allResults, setAllResults] = useState<JurisprudenceResult[]>([]);
  const [warnings, setWarnings] = useState<JurisprudenceSearchWarning[]>([]);
  const [fromCache, setFromCache] = useState(false);
  const [offset, setOffset] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [hasMore, setHasMore] = useState(false);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounced query setter
  const setQuery = useCallback((q: string) => {
    setQueryRaw(q);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setDebouncedQuery(q);
    }, DEBOUNCE_MS);
  }, []);

  // Cleanup timer
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  // Toggle a court on/off
  const toggleCourt = useCallback((court: CourtId) => {
    setCourts((prev) =>
      prev.includes(court) ? prev.filter((c) => c !== court) : [...prev, court],
    );
  }, []);

  // Fetch results for a given offset, appending or replacing
  const fetchResults = useCallback(
    async (searchQuery: string, searchCourts: CourtId[], searchOffset: number, append: boolean) => {
      if (searchQuery.trim().length < 3 || searchCourts.length === 0) return;

      setIsLoading(true);
      setError(null);

      try {
        const response = await searchJurisprudence({
          query: searchQuery,
          courts: searchCourts,
          limit: PAGE_SIZE,
          offset: searchOffset,
        });

        if (append) {
          setAllResults((prev) => [...prev, ...response.results]);
        } else {
          setAllResults(response.results);
        }

        setWarnings(response.warnings);
        setFromCache(response.fromCache);
        // If we got fewer results than PAGE_SIZE, no more to load
        setHasMore(response.results.length >= PAGE_SIZE);
      } catch (err) {
        setError(err instanceof Error ? err : new Error("Erro na busca"));
        if (!append) {
          setAllResults([]);
        }
        setHasMore(false);
      } finally {
        setIsLoading(false);
      }
    },
    [],
  );

  // Manual search trigger (resets pagination)
  const search = useCallback(() => {
    const q = query.trim();
    setDebouncedQuery(q);
    setOffset(0);
    setAllResults([]);
    fetchResults(q, courts, 0, false);
  }, [query, courts, fetchResults]);

  // Load more results
  const loadMore = useCallback(() => {
    const newOffset = offset + PAGE_SIZE;
    setOffset(newOffset);
    fetchResults(debouncedQuery, courts, newOffset, true);
  }, [offset, debouncedQuery, courts, fetchResults]);

  // Selection management
  const addResult = useCallback((result: JurisprudenceResult) => {
    setSelectedResults((prev) => {
      if (prev.some((r) => r.caseNumber === result.caseNumber)) return prev;
      return [...prev, result];
    });
  }, []);

  const removeResult = useCallback((caseNumber: string) => {
    setSelectedResults((prev) => prev.filter((r) => r.caseNumber !== caseNumber));
  }, []);

  const clearSelected = useCallback(() => {
    setSelectedResults([]);
  }, []);

  return {
    query,
    setQuery,
    courts,
    toggleCourt,
    setCourts,
    results: allResults,
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
    clearSelected,
  };
}
