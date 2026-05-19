export type PublicationSource = "djen" | "dje_pe" | "dje_sp" | "dje_rj";

export interface Publication {
  id: string;
  organization_id: string;
  case_id: string | null;
  lawyer_name: string;
  publication_date: string; // ISO date
  content: string;
  source: PublicationSource;
  read: boolean;
  external_id: string | null;
  matched_case_number: string | null;
  captured_at: string;
  created_at: string;
}

export interface PublicationWithCase extends Publication {
  case?: {
    id: string;
    case_number: string;
    court: string;
  } | null;
}

export type PublicationReadFilter = "all" | "unread" | "read";

export interface PublicationFilters {
  read?: PublicationReadFilter;
  source?: PublicationSource | "all";
  search?: string;
  dateFrom?: string;
  dateTo?: string;
}
