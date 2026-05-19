/* eslint-disable @typescript-eslint/no-explicit-any */
export type UserRole = "admin" | "lawyer" | "secretary" | "intern";

export interface Organization {
  id: string;
  name: string;
  slug: string;
  llm_config: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface Profile {
  id: string;
  full_name: string;
  role: UserRole;
  organization_id: string;
  avatar_url: string | null;
  oab_number: string | null;
  phone: string | null;
  created_at: string;
  updated_at: string;
}

export type CaseStatus = "active" | "archived" | "closed";

export interface Case {
  id: string;
  organization_id: string;
  client_id: string | null;
  case_number: string;
  court: string;
  branch: string | null;
  subject: string | null;
  status: CaseStatus;
  opposing_party: string | null;
  assigned_to: string | null;
  created_at: string;
  updated_at: string;
}

// Flexible table definition for tables without full type coverage yet
interface FlexTable {
  Row: any;
  Insert: any;
  Update: any;
}

export interface Database {
  public: {
    Tables: {
      organizations: {
        Row: Organization;
        Insert: Partial<Organization>;
        Update: Partial<Organization>;
      };
      profiles: {
        Row: Profile;
        Insert: Partial<Profile>;
        Update: Partial<Profile>;
      };
      cases: {
        Row: Case;
        Insert: Partial<Case>;
        Update: Partial<Case>;
      };
      clients: FlexTable;
      client_files: FlexTable;
      client_interactions: FlexTable;
      documents: FlexTable;
      ai_usage_log: FlexTable;
      finances: FlexTable;
      tasks: FlexTable;
      case_movements: FlexTable;
      publications: FlexTable;
      notification_preferences: FlexTable;
    };
  };
}
