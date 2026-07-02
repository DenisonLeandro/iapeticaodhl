import { useQuery } from "@tanstack/react-query";
import {
  findMatchingTemplatesForCase,
  type RankedTemplate,
} from "@/services/templateMatching";
import type { CaseDraftType } from "@/types/caseDraft";

export function useMatchingTemplates(ctx: {
  legal_area?: string | null;
  represented_party?: string | null;
  main_topic?: string | null;
  procedural_stage?: string | null;
  draft_type: CaseDraftType | null;
  enabled?: boolean;
}) {
  return useQuery<RankedTemplate[]>({
    queryKey: [
      "matching_templates",
      ctx.legal_area,
      ctx.represented_party,
      ctx.main_topic,
      ctx.procedural_stage,
      ctx.draft_type,
    ],
    queryFn: () =>
      findMatchingTemplatesForCase({
        legal_area: ctx.legal_area,
        represented_party: ctx.represented_party,
        main_topic: ctx.main_topic,
        procedural_stage: ctx.procedural_stage,
        draft_type: ctx.draft_type,
      }),
    enabled: ctx.enabled !== false && !!ctx.draft_type,
  });
}
