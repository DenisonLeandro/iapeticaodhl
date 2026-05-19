export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      ai_usage_log: {
        Row: {
          cost_estimated: number
          created_at: string
          document_id: string | null
          id: string
          model: string
          organization_id: string
          profile_id: string
          prompt_summary: string
          provider: string
          tokens_input: number
          tokens_output: number
        }
        Insert: {
          cost_estimated?: number
          created_at?: string
          document_id?: string | null
          id?: string
          model: string
          organization_id: string
          profile_id: string
          prompt_summary?: string
          provider: string
          tokens_input?: number
          tokens_output?: number
        }
        Update: {
          cost_estimated?: number
          created_at?: string
          document_id?: string | null
          id?: string
          model?: string
          organization_id?: string
          profile_id?: string
          prompt_summary?: string
          provider?: string
          tokens_input?: number
          tokens_output?: number
        }
        Relationships: [
          {
            foreignKeyName: "ai_usage_log_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_usage_log_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_usage_log_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      case_movements: {
        Row: {
          case_id: string
          created_at: string
          created_by: string | null
          description: string
          id: string
          movement_date: string
          organization_id: string
          type: string
        }
        Insert: {
          case_id: string
          created_at?: string
          created_by?: string | null
          description: string
          id?: string
          movement_date: string
          organization_id: string
          type: string
        }
        Update: {
          case_id?: string
          created_at?: string
          created_by?: string | null
          description?: string
          id?: string
          movement_date?: string
          organization_id?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "case_movements_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_movements_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_movements_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      cases: {
        Row: {
          assigned_to: string | null
          branch: string | null
          case_number: string
          client_id: string | null
          court: string
          created_at: string
          id: string
          opposing_party: string | null
          organization_id: string
          status: Database["public"]["Enums"]["case_status"]
          subject: string | null
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          branch?: string | null
          case_number: string
          client_id?: string | null
          court: string
          created_at?: string
          id?: string
          opposing_party?: string | null
          organization_id: string
          status?: Database["public"]["Enums"]["case_status"]
          subject?: string | null
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          branch?: string | null
          case_number?: string
          client_id?: string | null
          court?: string
          created_at?: string
          id?: string
          opposing_party?: string | null
          organization_id?: string
          status?: Database["public"]["Enums"]["case_status"]
          subject?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cases_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cases_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      client_files: {
        Row: {
          client_id: string
          created_at: string
          description: string | null
          file_name: string
          file_size: number | null
          file_type: string | null
          id: string
          organization_id: string
          storage_path: string
          uploaded_by: string | null
        }
        Insert: {
          client_id: string
          created_at?: string
          description?: string | null
          file_name: string
          file_size?: number | null
          file_type?: string | null
          id?: string
          organization_id: string
          storage_path: string
          uploaded_by?: string | null
        }
        Update: {
          client_id?: string
          created_at?: string
          description?: string | null
          file_name?: string
          file_size?: number | null
          file_type?: string | null
          id?: string
          organization_id?: string
          storage_path?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_files_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_files_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      client_interactions: {
        Row: {
          client_id: string
          created_at: string
          created_by: string | null
          id: string
          interaction_date: string
          notes: string | null
          organization_id: string
          subject: string
          updated_at: string
        }
        Insert: {
          client_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          interaction_date: string
          notes?: string | null
          organization_id: string
          subject: string
          updated_at?: string
        }
        Update: {
          client_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          interaction_date?: string
          notes?: string | null
          organization_id?: string
          subject?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_interactions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_interactions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          address: Json | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          document_number: string | null
          document_type: string | null
          email: string | null
          full_name: string
          id: string
          notes: string | null
          organization_id: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          address?: Json | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          document_number?: string | null
          document_type?: string | null
          email?: string | null
          full_name: string
          id?: string
          notes?: string | null
          organization_id: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          address?: Json | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          document_number?: string | null
          document_type?: string | null
          email?: string | null
          full_name?: string
          id?: string
          notes?: string | null
          organization_id?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "clients_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clients_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          case_id: string | null
          client_id: string | null
          content: string
          created_at: string
          created_by: string
          id: string
          llm_model: string
          llm_provider: Database["public"]["Enums"]["llm_provider_type"]
          organization_id: string
          prompt_used: string
          status: Database["public"]["Enums"]["document_status"]
          storage_path: string | null
          title: string
          tokens_used: number
          type: Database["public"]["Enums"]["document_type"]
        }
        Insert: {
          case_id?: string | null
          client_id?: string | null
          content?: string
          created_at?: string
          created_by: string
          id?: string
          llm_model: string
          llm_provider: Database["public"]["Enums"]["llm_provider_type"]
          organization_id: string
          prompt_used?: string
          status?: Database["public"]["Enums"]["document_status"]
          storage_path?: string | null
          title: string
          tokens_used?: number
          type?: Database["public"]["Enums"]["document_type"]
        }
        Update: {
          case_id?: string | null
          client_id?: string | null
          content?: string
          created_at?: string
          created_by?: string
          id?: string
          llm_model?: string
          llm_provider?: Database["public"]["Enums"]["llm_provider_type"]
          organization_id?: string
          prompt_used?: string
          status?: Database["public"]["Enums"]["document_status"]
          storage_path?: string | null
          title?: string
          tokens_used?: number
          type?: Database["public"]["Enums"]["document_type"]
        }
        Relationships: [
          {
            foreignKeyName: "documents_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      finances: {
        Row: {
          amount: number
          case_id: string | null
          category: string
          client_id: string | null
          created_at: string
          created_by: string
          due_date: string
          id: string
          notes: string | null
          organization_id: string
          payment_date: string | null
          payment_method: string | null
          status: string
          type: string
          updated_at: string
        }
        Insert: {
          amount: number
          case_id?: string | null
          category: string
          client_id?: string | null
          created_at?: string
          created_by: string
          due_date: string
          id?: string
          notes?: string | null
          organization_id: string
          payment_date?: string | null
          payment_method?: string | null
          status?: string
          type: string
          updated_at?: string
        }
        Update: {
          amount?: number
          case_id?: string | null
          category?: string
          client_id?: string | null
          created_at?: string
          created_by?: string
          due_date?: string
          id?: string
          notes?: string | null
          organization_id?: string
          payment_date?: string | null
          payment_method?: string | null
          status?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "finances_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      jurisprudence_cache: {
        Row: {
          cached_at: string
          court: string
          expires_at: string
          id: string
          query_hash: string
          results: Json
        }
        Insert: {
          cached_at?: string
          court: string
          expires_at?: string
          id?: string
          query_hash: string
          results?: Json
        }
        Update: {
          cached_at?: string
          court?: string
          expires_at?: string
          id?: string
          query_hash?: string
          results?: Json
        }
        Relationships: []
      }
      notification_preferences: {
        Row: {
          created_at: string
          email_enabled: boolean
          id: string
          notify_deadlines: boolean
          notify_publications: boolean
          notify_tasks: boolean
          profile_id: string
          updated_at: string
          whatsapp_enabled: boolean
          whatsapp_number: string | null
        }
        Insert: {
          created_at?: string
          email_enabled?: boolean
          id?: string
          notify_deadlines?: boolean
          notify_publications?: boolean
          notify_tasks?: boolean
          profile_id: string
          updated_at?: string
          whatsapp_enabled?: boolean
          whatsapp_number?: string | null
        }
        Update: {
          created_at?: string
          email_enabled?: boolean
          id?: string
          notify_deadlines?: boolean
          notify_publications?: boolean
          notify_tasks?: boolean
          profile_id?: string
          updated_at?: string
          whatsapp_enabled?: boolean
          whatsapp_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notification_preferences_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          branding: Json
          created_at: string
          features_enabled: Json
          id: string
          llm_config: Json
          name: string
          plan: Database["public"]["Enums"]["organization_plan"]
          publication_config: Json
          slug: string
          updated_at: string
        }
        Insert: {
          branding?: Json
          created_at?: string
          features_enabled?: Json
          id?: string
          llm_config?: Json
          name: string
          plan?: Database["public"]["Enums"]["organization_plan"]
          publication_config?: Json
          slug: string
          updated_at?: string
        }
        Update: {
          branding?: Json
          created_at?: string
          features_enabled?: Json
          id?: string
          llm_config?: Json
          name?: string
          plan?: Database["public"]["Enums"]["organization_plan"]
          publication_config?: Json
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string
          id: string
          oab_number: string | null
          organization_id: string
          phone: string | null
          role: Database["public"]["Enums"]["user_role"]
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name: string
          id: string
          oab_number?: string | null
          organization_id: string
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string
          id?: string
          oab_number?: string | null
          organization_id?: string
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      publications: {
        Row: {
          captured_at: string
          case_id: string | null
          content: string
          created_at: string
          external_id: string | null
          id: string
          lawyer_name: string
          matched_case_number: string | null
          organization_id: string
          publication_date: string
          read: boolean
          source: Database["public"]["Enums"]["publication_source"]
        }
        Insert: {
          captured_at?: string
          case_id?: string | null
          content: string
          created_at?: string
          external_id?: string | null
          id?: string
          lawyer_name: string
          matched_case_number?: string | null
          organization_id: string
          publication_date: string
          read?: boolean
          source?: Database["public"]["Enums"]["publication_source"]
        }
        Update: {
          captured_at?: string
          case_id?: string | null
          content?: string
          created_at?: string
          external_id?: string | null
          id?: string
          lawyer_name?: string
          matched_case_number?: string | null
          organization_id?: string
          publication_date?: string
          read?: boolean
          source?: Database["public"]["Enums"]["publication_source"]
        }
        Relationships: [
          {
            foreignKeyName: "publications_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "publications_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          assigned_by: string
          assigned_to: string | null
          case_id: string | null
          completed_at: string | null
          created_at: string
          description: string | null
          due_date: string | null
          id: string
          organization_id: string
          position: number
          priority: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          assigned_by: string
          assigned_to?: string | null
          case_id?: string | null
          completed_at?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          organization_id: string
          position?: number
          priority?: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          assigned_by?: string
          assigned_to?: string | null
          case_id?: string | null
          completed_at?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          organization_id?: string
          position?: number
          priority?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      bootstrap_current_user_profile: {
        Args: never
        Returns: {
          avatar_url: string | null
          created_at: string
          full_name: string
          id: string
          oab_number: string | null
          organization_id: string
          phone: string | null
          role: Database["public"]["Enums"]["user_role"]
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "profiles"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      cleanup_expired_jurisprudence_cache: { Args: never; Returns: undefined }
      get_my_organization_id: { Args: never; Returns: string }
      is_admin: { Args: never; Returns: boolean }
    }
    Enums: {
      case_status: "active" | "archived" | "closed"
      document_status: "draft" | "review" | "approved" | "signed"
      document_type:
        | "petition"
        | "appeal"
        | "contract"
        | "notification"
        | "opinion"
        | "power_of_attorney"
        | "other"
        | "contestation"
        | "reply"
        | "counterclaim"
        | "injunction_appeal"
        | "internal_appeal"
        | "declaration_objection"
        | "special_appeal"
        | "extraordinary_appeal"
        | "requirement"
        | "final_arguments"
        | "simple_petition"
      llm_provider_type: "lovable" | "openai" | "gemini" | "claude"
      organization_plan: "free" | "starter" | "professional" | "enterprise"
      publication_source: "djen" | "dje_pe" | "dje_sp" | "dje_rj"
      user_role: "admin" | "lawyer" | "secretary" | "intern"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      case_status: ["active", "archived", "closed"],
      document_status: ["draft", "review", "approved", "signed"],
      document_type: [
        "petition",
        "appeal",
        "contract",
        "notification",
        "opinion",
        "power_of_attorney",
        "other",
        "contestation",
        "reply",
        "counterclaim",
        "injunction_appeal",
        "internal_appeal",
        "declaration_objection",
        "special_appeal",
        "extraordinary_appeal",
        "requirement",
        "final_arguments",
        "simple_petition",
      ],
      llm_provider_type: ["lovable", "openai", "gemini", "claude"],
      organization_plan: ["free", "starter", "professional", "enterprise"],
      publication_source: ["djen", "dje_pe", "dje_sp", "dje_rj"],
      user_role: ["admin", "lawyer", "secretary", "intern"],
    },
  },
} as const
