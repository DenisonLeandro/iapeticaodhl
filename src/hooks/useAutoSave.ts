// =============================================================================
// useAutoSave — Auto-save hook with dirty detection and save indicator
// Story 2.3 — Legal Document Editor
// =============================================================================

import { useCallback, useEffect, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { updateDocumentContent } from "@/services/documents";

interface UseAutoSaveParams {
  documentId: string;
  content: string;
  interval?: number; // ms, default 30 000
}

interface UseAutoSaveReturn {
  isSaving: boolean;
  lastSavedAt: Date | null;
  saveNow: () => void;
}

export function useAutoSave({
  documentId,
  content,
  interval = 30_000,
}: UseAutoSaveParams): UseAutoSaveReturn {
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const lastSavedContentRef = useRef(content);
  const contentRef = useRef(content);

  // Keep contentRef in sync
  contentRef.current = content;

  const mutation = useMutation({
    mutationFn: (newContent: string) =>
      updateDocumentContent(documentId, newContent),
    onSuccess: () => {
      lastSavedContentRef.current = contentRef.current;
      setLastSavedAt(new Date());
    },
  });

  const saveNow = useCallback(() => {
    if (contentRef.current !== lastSavedContentRef.current) {
      mutation.mutate(contentRef.current);
    }
  }, [mutation]);

  // Auto-save interval
  useEffect(() => {
    const timer = setInterval(() => {
      if (contentRef.current !== lastSavedContentRef.current) {
        mutation.mutate(contentRef.current);
      }
    }, interval);
    return () => clearInterval(timer);
  }, [interval, mutation]);

  // Save on page unload
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (contentRef.current !== lastSavedContentRef.current) {
        // Use sendBeacon for reliable save on unload
        // Fallback: the mutation won't complete but we try
        mutation.mutate(contentRef.current);
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [mutation]);

  return {
    isSaving: mutation.isPending,
    lastSavedAt,
    saveNow,
  };
}
