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
          case_id: string | null
          client_id: string | null
          cost_estimated: number
          created_at: string
          document_id: string | null
          file_id: string | null
          id: string
          metadata: Json
          model: string
          operation: string
          organization_id: string
          processing_time_ms: number | null
          profile_id: string
          prompt_summary: string
          provider: string
          tokens_input: number
          tokens_output: number
          units: number | null
        }
        Insert: {
          case_id?: string | null
          client_id?: string | null
          cost_estimated?: number
          created_at?: string
          document_id?: string | null
          file_id?: string | null
          id?: string
          metadata?: Json
          model: string
          operation?: string
          organization_id: string
          processing_time_ms?: number | null
          profile_id: string
          prompt_summary?: string
          provider: string
          tokens_input?: number
          tokens_output?: number
          units?: number | null
        }
        Update: {
          case_id?: string | null
          client_id?: string | null
          cost_estimated?: number
          created_at?: string
          document_id?: string | null
          file_id?: string | null
          id?: string
          metadata?: Json
          model?: string
          operation?: string
          organization_id?: string
          processing_time_ms?: number | null
          profile_id?: string
          prompt_summary?: string
          provider?: string
          tokens_input?: number
          tokens_output?: number
          units?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_usage_log_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_usage_log_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_usage_log_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_usage_log_file_id_fkey"
            columns: ["file_id"]
            isOneToOne: false
            referencedRelation: "client_files"
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
      case_analyses: {
        Row: {
          analysis_type: string
          case_id: string
          client_id: string | null
          content_json: Json
          created_at: string
          created_by: string | null
          id: string
          metadata: Json
          model_task: string | null
          model_used: string | null
          organization_id: string
          provider: string | null
          status: string
          summary: string | null
          updated_at: string
        }
        Insert: {
          analysis_type?: string
          case_id: string
          client_id?: string | null
          content_json?: Json
          created_at?: string
          created_by?: string | null
          id?: string
          metadata?: Json
          model_task?: string | null
          model_used?: string | null
          organization_id: string
          provider?: string | null
          status?: string
          summary?: string | null
          updated_at?: string
        }
        Update: {
          analysis_type?: string
          case_id?: string
          client_id?: string | null
          content_json?: Json
          created_at?: string
          created_by?: string | null
          id?: string
          metadata?: Json
          model_task?: string | null
          model_used?: string | null
          organization_id?: string
          provider?: string | null
          status?: string
          summary?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "case_analyses_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_analyses_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_analyses_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_analyses_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      case_chat_feedback: {
        Row: {
          case_id: string
          comment: string | null
          created_at: string
          created_by: string | null
          feedback: string
          id: string
          message_id: string
          organization_id: string
          updated_at: string
        }
        Insert: {
          case_id: string
          comment?: string | null
          created_at?: string
          created_by?: string | null
          feedback: string
          id?: string
          message_id: string
          organization_id: string
          updated_at?: string
        }
        Update: {
          case_id?: string
          comment?: string | null
          created_at?: string
          created_by?: string | null
          feedback?: string
          id?: string
          message_id?: string
          organization_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "case_chat_feedback_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_chat_feedback_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "case_chat_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_chat_feedback_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      case_chat_messages: {
        Row: {
          case_id: string
          content: string
          created_at: string
          created_by: string | null
          id: string
          is_pinned: boolean
          message_kind: string
          metadata: Json
          organization_id: string
          role: string
        }
        Insert: {
          case_id: string
          content: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_pinned?: boolean
          message_kind?: string
          metadata?: Json
          organization_id: string
          role: string
        }
        Update: {
          case_id?: string
          content?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_pinned?: boolean
          message_kind?: string
          metadata?: Json
          organization_id?: string
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "case_chat_messages_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_chat_messages_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
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
          case_number: string | null
          client_id: string | null
          court: string | null
          created_at: string
          executive_summary: Json | null
          executive_summary_updated_at: string | null
          executive_summary_version: number
          id: string
          opposing_party: string | null
          organization_id: string
          represented_party: string | null
          status: Database["public"]["Enums"]["case_status"]
          subject: string | null
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          branch?: string | null
          case_number?: string | null
          client_id?: string | null
          court?: string | null
          created_at?: string
          executive_summary?: Json | null
          executive_summary_updated_at?: string | null
          executive_summary_version?: number
          id?: string
          opposing_party?: string | null
          organization_id: string
          represented_party?: string | null
          status?: Database["public"]["Enums"]["case_status"]
          subject?: string | null
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          branch?: string | null
          case_number?: string | null
          client_id?: string | null
          court?: string | null
          created_at?: string
          executive_summary?: Json | null
          executive_summary_updated_at?: string | null
          executive_summary_version?: number
          id?: string
          opposing_party?: string | null
          organization_id?: string
          represented_party?: string | null
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
          analysis_at: string | null
          analysis_json: Json | null
          analysis_model: string | null
          analysis_summary: string | null
          analysis_version: string | null
          case_id: string | null
          classification: string | null
          classification_at: string | null
          classification_confidence: number | null
          classification_model: string | null
          classification_source: string | null
          classification_version: string | null
          client_id: string
          content_hash: string | null
          created_at: string
          description: string | null
          document_kind: string | null
          embedding_at: string | null
          embedding_model: string | null
          embedding_version: string | null
          error_message: string | null
          extracted_text: string | null
          extraction_at: string | null
          extraction_model: string | null
          extraction_version: string | null
          file_name: string
          file_size: number | null
          file_type: string | null
          id: string
          logical_file_name: string | null
          media_type: string
          organization_id: string
          page_count: number | null
          page_from: number | null
          page_to: number | null
          parent_file_id: string | null
          part_index: number | null
          petition_id: string | null
          pipeline_attempts: number
          pipeline_last_error: string | null
          pipeline_stage: string | null
          processed_at: string | null
          processing_status: string | null
          represented_party: string | null
          storage_path: string | null
          total_parts: number | null
          updated_at: string
          uploaded_by: string | null
        }
        Insert: {
          analysis_at?: string | null
          analysis_json?: Json | null
          analysis_model?: string | null
          analysis_summary?: string | null
          analysis_version?: string | null
          case_id?: string | null
          classification?: string | null
          classification_at?: string | null
          classification_confidence?: number | null
          classification_model?: string | null
          classification_source?: string | null
          classification_version?: string | null
          client_id: string
          content_hash?: string | null
          created_at?: string
          description?: string | null
          document_kind?: string | null
          embedding_at?: string | null
          embedding_model?: string | null
          embedding_version?: string | null
          error_message?: string | null
          extracted_text?: string | null
          extraction_at?: string | null
          extraction_model?: string | null
          extraction_version?: string | null
          file_name: string
          file_size?: number | null
          file_type?: string | null
          id?: string
          logical_file_name?: string | null
          media_type?: string
          organization_id: string
          page_count?: number | null
          page_from?: number | null
          page_to?: number | null
          parent_file_id?: string | null
          part_index?: number | null
          petition_id?: string | null
          pipeline_attempts?: number
          pipeline_last_error?: string | null
          pipeline_stage?: string | null
          processed_at?: string | null
          processing_status?: string | null
          represented_party?: string | null
          storage_path?: string | null
          total_parts?: number | null
          updated_at?: string
          uploaded_by?: string | null
        }
        Update: {
          analysis_at?: string | null
          analysis_json?: Json | null
          analysis_model?: string | null
          analysis_summary?: string | null
          analysis_version?: string | null
          case_id?: string | null
          classification?: string | null
          classification_at?: string | null
          classification_confidence?: number | null
          classification_model?: string | null
          classification_source?: string | null
          classification_version?: string | null
          client_id?: string
          content_hash?: string | null
          created_at?: string
          description?: string | null
          document_kind?: string | null
          embedding_at?: string | null
          embedding_model?: string | null
          embedding_version?: string | null
          error_message?: string | null
          extracted_text?: string | null
          extraction_at?: string | null
          extraction_model?: string | null
          extraction_version?: string | null
          file_name?: string
          file_size?: number | null
          file_type?: string | null
          id?: string
          logical_file_name?: string | null
          media_type?: string
          organization_id?: string
          page_count?: number | null
          page_from?: number | null
          page_to?: number | null
          parent_file_id?: string | null
          part_index?: number | null
          petition_id?: string | null
          pipeline_attempts?: number
          pipeline_last_error?: string | null
          pipeline_stage?: string | null
          processed_at?: string | null
          processing_status?: string | null
          represented_party?: string | null
          storage_path?: string | null
          total_parts?: number | null
          updated_at?: string
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
          {
            foreignKeyName: "client_files_parent_file_id_fkey"
            columns: ["parent_file_id"]
            isOneToOne: false
            referencedRelation: "client_files"
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
      document_chat_messages: {
        Row: {
          content: string
          created_at: string
          created_by: string | null
          document_id: string
          id: string
          metadata: Json
          organization_id: string
          role: string
        }
        Insert: {
          content: string
          created_at?: string
          created_by?: string | null
          document_id: string
          id?: string
          metadata?: Json
          organization_id: string
          role: string
        }
        Update: {
          content?: string
          created_at?: string
          created_by?: string | null
          document_id?: string
          id?: string
          metadata?: Json
          organization_id?: string
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_chat_messages_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      document_chunks: {
        Row: {
          case_id: string | null
          chunk_index: number
          chunking_version: string
          content: string
          content_hash: string | null
          created_at: string
          extraction_version: string | null
          file_id: string
          id: string
          metadata: Json
          organization_id: string
          page_from: number | null
          page_to: number | null
          token_count: number | null
        }
        Insert: {
          case_id?: string | null
          chunk_index: number
          chunking_version: string
          content: string
          content_hash?: string | null
          created_at?: string
          extraction_version?: string | null
          file_id: string
          id?: string
          metadata?: Json
          organization_id: string
          page_from?: number | null
          page_to?: number | null
          token_count?: number | null
        }
        Update: {
          case_id?: string | null
          chunk_index?: number
          chunking_version?: string
          content?: string
          content_hash?: string | null
          created_at?: string
          extraction_version?: string | null
          file_id?: string
          id?: string
          metadata?: Json
          organization_id?: string
          page_from?: number | null
          page_to?: number | null
          token_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "document_chunks_file_id_fkey"
            columns: ["file_id"]
            isOneToOne: false
            referencedRelation: "client_files"
            referencedColumns: ["id"]
          },
        ]
      }
      document_embeddings: {
        Row: {
          case_id: string | null
          chunk_id: string | null
          chunk_index: number
          content: string
          content_hash: string | null
          created_at: string
          embedding: string
          embedding_version: string
          file_id: string | null
          id: string
          metadata: Json
          model_name: string | null
          model_version: string
          organization_id: string
          page_from: number | null
          page_to: number | null
          source_kind: string
          token_count: number | null
        }
        Insert: {
          case_id?: string | null
          chunk_id?: string | null
          chunk_index?: number
          content: string
          content_hash?: string | null
          created_at?: string
          embedding: string
          embedding_version?: string
          file_id?: string | null
          id?: string
          metadata?: Json
          model_name?: string | null
          model_version: string
          organization_id: string
          page_from?: number | null
          page_to?: number | null
          source_kind?: string
          token_count?: number | null
        }
        Update: {
          case_id?: string | null
          chunk_id?: string | null
          chunk_index?: number
          content?: string
          content_hash?: string | null
          created_at?: string
          embedding?: string
          embedding_version?: string
          file_id?: string | null
          id?: string
          metadata?: Json
          model_name?: string | null
          model_version?: string
          organization_id?: string
          page_from?: number | null
          page_to?: number | null
          source_kind?: string
          token_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "document_embeddings_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_embeddings_file_id_fkey"
            columns: ["file_id"]
            isOneToOne: false
            referencedRelation: "client_files"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_embeddings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      document_versions: {
        Row: {
          change_summary: string | null
          content: string
          created_at: string
          created_by: string | null
          document_id: string
          id: string
          organization_id: string
          source: string
          version: number
        }
        Insert: {
          change_summary?: string | null
          content: string
          created_at?: string
          created_by?: string | null
          document_id: string
          id?: string
          organization_id: string
          source?: string
          version: number
        }
        Update: {
          change_summary?: string | null
          content?: string
          created_at?: string
          created_by?: string | null
          document_id?: string
          id?: string
          organization_id?: string
          source?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "document_versions_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          approval_notes: string | null
          approved_at: string | null
          approved_by: string | null
          case_id: string | null
          client_id: string | null
          content: string
          created_at: string
          created_by: string
          id: string
          is_approved_template: boolean
          llm_model: string
          llm_provider: Database["public"]["Enums"]["llm_provider_type"]
          organization_id: string
          parent_document_id: string | null
          prompt_used: string
          represented_party: string | null
          source_file_ids: string[] | null
          status: Database["public"]["Enums"]["document_status"]
          storage_path: string | null
          template_id: string | null
          title: string
          tokens_used: number
          type: Database["public"]["Enums"]["document_type"]
          version: number
        }
        Insert: {
          approval_notes?: string | null
          approved_at?: string | null
          approved_by?: string | null
          case_id?: string | null
          client_id?: string | null
          content?: string
          created_at?: string
          created_by: string
          id?: string
          is_approved_template?: boolean
          llm_model: string
          llm_provider: Database["public"]["Enums"]["llm_provider_type"]
          organization_id: string
          parent_document_id?: string | null
          prompt_used?: string
          represented_party?: string | null
          source_file_ids?: string[] | null
          status?: Database["public"]["Enums"]["document_status"]
          storage_path?: string | null
          template_id?: string | null
          title: string
          tokens_used?: number
          type?: Database["public"]["Enums"]["document_type"]
          version?: number
        }
        Update: {
          approval_notes?: string | null
          approved_at?: string | null
          approved_by?: string | null
          case_id?: string | null
          client_id?: string | null
          content?: string
          created_at?: string
          created_by?: string
          id?: string
          is_approved_template?: boolean
          llm_model?: string
          llm_provider?: Database["public"]["Enums"]["llm_provider_type"]
          organization_id?: string
          parent_document_id?: string | null
          prompt_used?: string
          represented_party?: string | null
          source_file_ids?: string[] | null
          status?: Database["public"]["Enums"]["document_status"]
          storage_path?: string | null
          template_id?: string | null
          title?: string
          tokens_used?: number
          type?: Database["public"]["Enums"]["document_type"]
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "documents_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
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
          {
            foreignKeyName: "documents_parent_document_id_fkey"
            columns: ["parent_document_id"]
            isOneToOne: false
            referencedRelation: "documents"
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
      processing_jobs: {
        Row: {
          attempts: number
          case_id: string | null
          created_at: string
          file_id: string
          finished_at: string | null
          heartbeat_at: string | null
          id: string
          job_type: string
          last_error: string | null
          max_attempts: number
          organization_id: string
          payload: Json
          priority: number
          scheduled_at: string
          started_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          attempts?: number
          case_id?: string | null
          created_at?: string
          file_id: string
          finished_at?: string | null
          heartbeat_at?: string | null
          id?: string
          job_type: string
          last_error?: string | null
          max_attempts?: number
          organization_id: string
          payload?: Json
          priority?: number
          scheduled_at?: string
          started_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          attempts?: number
          case_id?: string | null
          created_at?: string
          file_id?: string
          finished_at?: string | null
          heartbeat_at?: string | null
          id?: string
          job_type?: string
          last_error?: string | null
          max_attempts?: number
          organization_id?: string
          payload?: Json
          priority?: number
          scheduled_at?: string
          started_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "processing_jobs_file_id_fkey"
            columns: ["file_id"]
            isOneToOne: false
            referencedRelation: "client_files"
            referencedColumns: ["id"]
          },
        ]
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
      bootstrap_service_key_vault: {
        Args: { p_key: string }
        Returns: undefined
      }
      claim_processing_jobs: {
        Args: { p_limit?: number }
        Returns: {
          attempts: number
          case_id: string | null
          created_at: string
          file_id: string
          finished_at: string | null
          heartbeat_at: string | null
          id: string
          job_type: string
          last_error: string | null
          max_attempts: number
          organization_id: string
          payload: Json
          priority: number
          scheduled_at: string
          started_at: string | null
          status: string
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "processing_jobs"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      cleanup_expired_jurisprudence_cache: { Args: never; Returns: undefined }
      get_my_organization_id: { Args: never; Returns: string }
      is_admin: { Args: never; Returns: boolean }
      match_case_chunks: {
        Args: {
          p_case_id: string
          p_embedding_version?: string
          p_match_count?: number
          p_query_embedding: string
        }
        Returns: {
          content: string
          embedding_version: string
          file_id: string
          id: string
          metadata: Json
          model_name: string
          page_from: number
          page_to: number
          similarity: number
          source_kind: string
        }[]
      }
      reap_orphan_processing_jobs: {
        Args: { p_stale_minutes?: number }
        Returns: {
          action: string
          reaped_id: string
        }[]
      }
      reconcile_pipeline_stages: {
        Args: never
        Returns: {
          action: string
          file_id: string
        }[]
      }
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
