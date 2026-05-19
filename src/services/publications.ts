import { supabase } from "@/integrations/supabase/client";
import type {
  Publication,
  PublicationWithCase,
  PublicationFilters,
} from "@/types/publication";

const PAGE_SIZE = 20;

export async function listPublications(
  organizationId: string,
  filters: PublicationFilters = {},
  page = 0,
): Promise<{ data: PublicationWithCase[]; count: number }> {
  let query = supabase
    .from("publications")
    .select("*", { count: "exact" })
    .eq("organization_id", organizationId)
    .order("publication_date", { ascending: false })
    .order("captured_at", { ascending: false });

  if (filters.read === "unread") query = query.eq("read", false);
  if (filters.read === "read") query = query.eq("read", true);
  if (filters.source && filters.source !== "all") {
    query = query.eq("source", filters.source);
  }
  if (filters.search?.trim()) {
    query = query.ilike("content", `%${filters.search.trim()}%`);
  }
  if (filters.dateFrom) query = query.gte("publication_date", filters.dateFrom);
  if (filters.dateTo) query = query.lte("publication_date", filters.dateTo);

  const from = page * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;
  query = query.range(from, to);

  const { data, error, count } = await query;
  if (error) throw error;

  const pubs = (data ?? []) as Publication[];

  // Fetch related cases (split-query)
  const caseIds = Array.from(
    new Set(pubs.map((p) => p.case_id).filter((v): v is string => !!v)),
  );
  let casesMap: Record<string, { id: string; case_number: string; court: string }> = {};
  if (caseIds.length > 0) {
    const { data: cases } = await supabase
      .from("cases")
      .select("id, case_number, court")
      .in("id", caseIds);
    casesMap = Object.fromEntries((cases ?? []).map((c) => [c.id, c]));
  }

  const enriched: PublicationWithCase[] = pubs.map((p) => ({
    ...p,
    case: p.case_id ? casesMap[p.case_id] ?? null : null,
  }));

  return { data: enriched, count: count ?? 0 };
}

export async function getUnreadCount(organizationId: string): Promise<number> {
  const { count, error } = await supabase
    .from("publications")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId)
    .eq("read", false);
  if (error) throw error;
  return count ?? 0;
}

export async function markAsRead(id: string, read = true): Promise<void> {
  const { error } = await supabase
    .from("publications")
    .update({ read })
    .eq("id", id);
  if (error) throw error;
}

export async function markAllAsRead(organizationId: string): Promise<void> {
  const { error } = await supabase
    .from("publications")
    .update({ read: true })
    .eq("organization_id", organizationId)
    .eq("read", false);
  if (error) throw error;
}

export async function triggerScraper(): Promise<{
  publications_found: number;
  publications_saved: number;
  errors?: string[];
}> {
  const { data, error } = await supabase.functions.invoke("djen-scraper", {
    body: {},
  });
  if (error) throw error;
  return data;
}

export const PUBLICATIONS_PAGE_SIZE = PAGE_SIZE;
