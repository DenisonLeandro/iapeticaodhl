import { useEffect } from "react";
import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import {
  getUnreadCount,
  listPublications,
  markAllAsRead,
  markAsRead,
  triggerScraper,
} from "@/services/publications";
import type { PublicationFilters } from "@/types/publication";

export function usePublications(filters: PublicationFilters, page: number) {
  const { profile } = useAuth();
  const orgId = profile?.organization_id;

  return useQuery({
    queryKey: ["publications", orgId, filters, page],
    queryFn: () => listPublications(orgId!, filters, page),
    enabled: !!orgId,
  });
}

export function useUnreadPublicationsCount() {
  const { profile } = useAuth();
  const orgId = profile?.organization_id;
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["publications", "unread-count", orgId],
    queryFn: () => getUnreadCount(orgId!),
    enabled: !!orgId,
    staleTime: 30_000,
  });

  // Realtime: invalidate on insert/update
  useEffect(() => {
    if (!orgId) return;
    const channel = supabase
      .channel(`publications-${orgId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "publications",
          filter: `organization_id=eq.${orgId}`,
        },
        () => {
          qc.invalidateQueries({ queryKey: ["publications"] });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [orgId, qc]);

  return query;
}

export function useMarkPublicationRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, read = true }: { id: string; read?: boolean }) =>
      markAsRead(id, read),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["publications"] });
    },
  });
}

export function useMarkAllPublicationsRead() {
  const { profile } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => markAllAsRead(profile!.organization_id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["publications"] });
    },
  });
}

export function useTriggerScraper() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: triggerScraper,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["publications"] });
    },
  });
}
