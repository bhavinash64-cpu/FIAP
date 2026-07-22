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
      app_settings: {
        Row: {
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          value: Json
        }
        Update: {
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      assignments: {
        Row: {
          access_token: string
          available_at: string
          batch_id: string
          completed_at: string | null
          due_at: string
          id: string
          language: string | null
          participant_id: string
          started_at: string | null
          state: Database["public"]["Enums"]["assignment_state"]
        }
        Insert: {
          access_token?: string
          available_at: string
          batch_id: string
          completed_at?: string | null
          due_at: string
          id?: string
          language?: string | null
          participant_id: string
          started_at?: string | null
          state?: Database["public"]["Enums"]["assignment_state"]
        }
        Update: {
          access_token?: string
          available_at?: string
          batch_id?: string
          completed_at?: string | null
          due_at?: string
          id?: string
          language?: string | null
          participant_id?: string
          started_at?: string | null
          state?: Database["public"]["Enums"]["assignment_state"]
        }
        Relationships: [
          {
            foreignKeyName: "assignments_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignments_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "participants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignments_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "study_participants"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          entity: string | null
          entity_id: string | null
          id: string
          meta: Json | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          entity?: string | null
          entity_id?: string | null
          id?: string
          meta?: Json | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          entity?: string | null
          entity_id?: string | null
          id?: string
          meta?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          created_at: string
          entity: string | null
          entity_id: string | null
          id: string
          meta: Json | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          entity?: string | null
          entity_id?: string | null
          id?: string
          meta?: Json | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          entity?: string | null
          entity_id?: string | null
          id?: string
          meta?: Json | null
          user_id?: string | null
        }
        Relationships: []
      }
      batch_instruments: {
        Row: {
          batch_id: string
          instrument_id: string
          order_index: number
        }
        Insert: {
          batch_id: string
          instrument_id: string
          order_index?: number
        }
        Update: {
          batch_id?: string
          instrument_id?: string
          order_index?: number
        }
        Relationships: [
          {
            foreignKeyName: "batch_instruments_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "batch_instruments_instrument_id_fkey"
            columns: ["instrument_id"]
            isOneToOne: false
            referencedRelation: "instruments"
            referencedColumns: ["id"]
          },
        ]
      }
      batches: {
        Row: {
          applies_to: Database["public"]["Enums"]["study_arm"] | null
          code: string
          created_at: string
          description: Json
          id: string
          is_active: boolean
          name: Json
          offset_days: number
          sequence: number
          window_days: number
        }
        Insert: {
          applies_to?: Database["public"]["Enums"]["study_arm"] | null
          code: string
          created_at?: string
          description?: Json
          id?: string
          is_active?: boolean
          name?: Json
          offset_days: number
          sequence: number
          window_days?: number
        }
        Update: {
          applies_to?: Database["public"]["Enums"]["study_arm"] | null
          code?: string
          created_at?: string
          description?: Json
          id?: string
          is_active?: boolean
          name?: Json
          offset_days?: number
          sequence?: number
          window_days?: number
        }
        Relationships: []
      }
      consents: {
        Row: {
          consented: boolean
          document_url: string | null
          id: string
          language: string
          method: string
          participant_id: string
          recorded_at: string
          recorded_by: string | null
          version: string
          witness_name: string | null
        }
        Insert: {
          consented: boolean
          document_url?: string | null
          id?: string
          language?: string
          method?: string
          participant_id: string
          recorded_at?: string
          recorded_by?: string | null
          version: string
          witness_name?: string | null
        }
        Update: {
          consented?: boolean
          document_url?: string | null
          id?: string
          language?: string
          method?: string
          participant_id?: string
          recorded_at?: string
          recorded_by?: string | null
          version?: string
          witness_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "consents_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "participants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consents_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "study_participants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consents_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      family_case_events: {
        Row: {
          actor: string
          case_id: string
          created_at: string
          detail: Json
          event: string
          id: string
        }
        Insert: {
          actor?: string
          case_id: string
          created_at?: string
          detail?: Json
          event: string
          id?: string
        }
        Update: {
          actor?: string
          case_id?: string
          created_at?: string
          detail?: Json
          event?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "family_case_events_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "family_cases"
            referencedColumns: ["id"]
          },
        ]
      }
      family_case_sessions: {
        Row: {
          case_id: string
          expires_at: string
          id: string
          ip_hash: string | null
          issued_at: string
          last_seen_at: string
          revoked_at: string | null
          token_hash: string
          user_agent: string | null
        }
        Insert: {
          case_id: string
          expires_at: string
          id?: string
          ip_hash?: string | null
          issued_at?: string
          last_seen_at?: string
          revoked_at?: string | null
          token_hash: string
          user_agent?: string | null
        }
        Update: {
          case_id?: string
          expires_at?: string
          id?: string
          ip_hash?: string | null
          issued_at?: string
          last_seen_at?: string
          revoked_at?: string | null
          token_hash?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "family_case_sessions_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "family_cases"
            referencedColumns: ["id"]
          },
        ]
      }
      family_cases: {
        Row: {
          access_token: string
          completed_at: string | null
          created_at: string
          deceased_name: string
          district: string
          draft: Json | null
          draft_updated_at: string | null
          expires_at: string
          failed_attempts: number
          family_head_name: string
          id: string
          locked_until: string | null
          notes: string | null
          officer_id: string | null
          officer_name: string | null
          opened_at: string | null
          phone: string
          pin: string | null
          pin_issued_at: string
          preferred_language: string
          reference_id: string
          relationship: string
          response_id: string | null
          started_at: string | null
          status: Database["public"]["Enums"]["family_case_status"]
          survey_id: string
          updated_at: string
          village: string | null
        }
        Insert: {
          access_token: string
          completed_at?: string | null
          created_at?: string
          deceased_name: string
          district: string
          draft?: Json | null
          draft_updated_at?: string | null
          expires_at?: string
          failed_attempts?: number
          family_head_name: string
          id?: string
          locked_until?: string | null
          notes?: string | null
          officer_id?: string | null
          officer_name?: string | null
          opened_at?: string | null
          phone: string
          pin?: string | null
          pin_issued_at?: string
          preferred_language?: string
          reference_id?: string
          relationship: string
          response_id?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["family_case_status"]
          survey_id: string
          updated_at?: string
          village?: string | null
        }
        Update: {
          access_token?: string
          completed_at?: string | null
          created_at?: string
          deceased_name?: string
          district?: string
          draft?: Json | null
          draft_updated_at?: string | null
          expires_at?: string
          failed_attempts?: number
          family_head_name?: string
          id?: string
          locked_until?: string | null
          notes?: string | null
          officer_id?: string | null
          officer_name?: string | null
          opened_at?: string | null
          phone?: string
          pin?: string | null
          pin_issued_at?: string
          preferred_language?: string
          reference_id?: string
          relationship?: string
          response_id?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["family_case_status"]
          survey_id?: string
          updated_at?: string
          village?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "family_cases_response_id_fkey"
            columns: ["response_id"]
            isOneToOne: false
            referencedRelation: "survey_responses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "family_cases_survey_id_fkey"
            columns: ["survey_id"]
            isOneToOne: false
            referencedRelation: "surveys"
            referencedColumns: ["id"]
          },
        ]
      }
      family_login_attempts: {
        Row: {
          attempts: number
          ip_hash: string
          last_attempt_at: string
          window_started_at: string
        }
        Insert: {
          attempts?: number
          ip_hash: string
          last_attempt_at?: string
          window_started_at?: string
        }
        Update: {
          attempts?: number
          ip_hash?: string
          last_attempt_at?: string
          window_started_at?: string
        }
        Relationships: []
      }
      import_batches: {
        Row: {
          created_at: string
          created_by: string | null
          file_name: string | null
          id: string
          question_count: number
          source_type: Database["public"]["Enums"]["question_origin"]
          survey_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          file_name?: string | null
          id?: string
          question_count?: number
          source_type: Database["public"]["Enums"]["question_origin"]
          survey_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          file_name?: string | null
          id?: string
          question_count?: number
          source_type?: Database["public"]["Enums"]["question_origin"]
          survey_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "import_batches_survey_id_fkey"
            columns: ["survey_id"]
            isOneToOne: false
            referencedRelation: "surveys"
            referencedColumns: ["id"]
          },
        ]
      }
      instrument_items: {
        Row: {
          created_at: string
          help_text: Json
          id: string
          instrument_id: string
          item_no: number
          options: Json | null
          order_index: number
          required: boolean
          reverse_scored: boolean
          scale_id: string | null
          source_no: number | null
          subscale: string | null
          text: Json
          type: Database["public"]["Enums"]["item_type"]
        }
        Insert: {
          created_at?: string
          help_text?: Json
          id?: string
          instrument_id: string
          item_no: number
          options?: Json | null
          order_index?: number
          required?: boolean
          reverse_scored?: boolean
          scale_id?: string | null
          source_no?: number | null
          subscale?: string | null
          text?: Json
          type?: Database["public"]["Enums"]["item_type"]
        }
        Update: {
          created_at?: string
          help_text?: Json
          id?: string
          instrument_id?: string
          item_no?: number
          options?: Json | null
          order_index?: number
          required?: boolean
          reverse_scored?: boolean
          scale_id?: string | null
          source_no?: number | null
          subscale?: string | null
          text?: Json
          type?: Database["public"]["Enums"]["item_type"]
        }
        Relationships: [
          {
            foreignKeyName: "instrument_items_instrument_id_fkey"
            columns: ["instrument_id"]
            isOneToOne: false
            referencedRelation: "instruments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "instrument_items_scale_id_fkey"
            columns: ["scale_id"]
            isOneToOne: false
            referencedRelation: "scales"
            referencedColumns: ["id"]
          },
        ]
      }
      instruments: {
        Row: {
          citation: string | null
          code: string
          created_at: string
          description: Json
          id: string
          instructions: Json
          is_active: boolean
          name: Json
          scoring: Json
          updated_at: string
          version: number
        }
        Insert: {
          citation?: string | null
          code: string
          created_at?: string
          description?: Json
          id?: string
          instructions?: Json
          is_active?: boolean
          name?: Json
          scoring?: Json
          updated_at?: string
          version?: number
        }
        Update: {
          citation?: string | null
          code?: string
          created_at?: string
          description?: Json
          id?: string
          instructions?: Json
          is_active?: boolean
          name?: Json
          scoring?: Json
          updated_at?: string
          version?: number
        }
        Relationships: []
      }
      notifications: {
        Row: {
          assignment_id: string | null
          channel: Database["public"]["Enums"]["notify_channel"]
          created_at: string
          created_by: string | null
          error: string | null
          id: string
          language: string
          participant_id: string
          provider_id: string | null
          scheduled_at: string
          sent_at: string | null
          state: Database["public"]["Enums"]["notify_state"]
          template: string
          trigger: Database["public"]["Enums"]["notify_trigger"]
        }
        Insert: {
          assignment_id?: string | null
          channel: Database["public"]["Enums"]["notify_channel"]
          created_at?: string
          created_by?: string | null
          error?: string | null
          id?: string
          language?: string
          participant_id: string
          provider_id?: string | null
          scheduled_at?: string
          sent_at?: string | null
          state?: Database["public"]["Enums"]["notify_state"]
          template: string
          trigger?: Database["public"]["Enums"]["notify_trigger"]
        }
        Update: {
          assignment_id?: string | null
          channel?: Database["public"]["Enums"]["notify_channel"]
          created_at?: string
          created_by?: string | null
          error?: string | null
          id?: string
          language?: string
          participant_id?: string
          provider_id?: string | null
          scheduled_at?: string
          sent_at?: string | null
          state?: Database["public"]["Enums"]["notify_state"]
          template?: string
          trigger?: Database["public"]["Enums"]["notify_trigger"]
        }
        Relationships: [
          {
            foreignKeyName: "notifications_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "study_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "participants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "study_participants"
            referencedColumns: ["id"]
          },
        ]
      }
      participant_counters: {
        Row: {
          arm: Database["public"]["Enums"]["study_arm"]
          next_val: number
          site_id: string
        }
        Insert: {
          arm: Database["public"]["Enums"]["study_arm"]
          next_val?: number
          site_id: string
        }
        Update: {
          arm?: Database["public"]["Enums"]["study_arm"]
          next_val?: number
          site_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "participant_counters_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      participants: {
        Row: {
          admitted_at: string | null
          age_stratum: Database["public"]["Enums"]["age_stratum"]
          area_of_residence: string | null
          arm: Database["public"]["Enums"]["study_arm"]
          attended_by: number | null
          created_at: string
          created_by: string | null
          currently_in_school: boolean | null
          date_of_birth: string
          discharged_at: string | null
          district: string | null
          email: string | null
          employment_status: number | null
          enrolled_at: string
          full_name: string
          highest_education: string | null
          id: string
          is_demo: boolean
          mandal: string | null
          marital_status: number | null
          matched_to: string | null
          occupation_category: number | null
          occupation_text: string | null
          participant_code: string
          phone: string | null
          pincode: string | null
          preferred_language: string
          rural_urban: string | null
          sex: Database["public"]["Enums"]["sex_at_intake"]
          site_id: string
          state: string | null
          state_: Database["public"]["Enums"]["participant_state"]
          updated_at: string
          village_town: string | null
          years_of_education: number | null
        }
        Insert: {
          admitted_at?: string | null
          age_stratum: Database["public"]["Enums"]["age_stratum"]
          area_of_residence?: string | null
          arm: Database["public"]["Enums"]["study_arm"]
          attended_by?: number | null
          created_at?: string
          created_by?: string | null
          currently_in_school?: boolean | null
          date_of_birth: string
          discharged_at?: string | null
          district?: string | null
          email?: string | null
          employment_status?: number | null
          enrolled_at?: string
          full_name: string
          highest_education?: string | null
          id?: string
          is_demo?: boolean
          mandal?: string | null
          marital_status?: number | null
          matched_to?: string | null
          occupation_category?: number | null
          occupation_text?: string | null
          participant_code: string
          phone?: string | null
          pincode?: string | null
          preferred_language?: string
          rural_urban?: string | null
          sex: Database["public"]["Enums"]["sex_at_intake"]
          site_id: string
          state?: string | null
          state_?: Database["public"]["Enums"]["participant_state"]
          updated_at?: string
          village_town?: string | null
          years_of_education?: number | null
        }
        Update: {
          admitted_at?: string | null
          age_stratum?: Database["public"]["Enums"]["age_stratum"]
          area_of_residence?: string | null
          arm?: Database["public"]["Enums"]["study_arm"]
          attended_by?: number | null
          created_at?: string
          created_by?: string | null
          currently_in_school?: boolean | null
          date_of_birth?: string
          discharged_at?: string | null
          district?: string | null
          email?: string | null
          employment_status?: number | null
          enrolled_at?: string
          full_name?: string
          highest_education?: string | null
          id?: string
          is_demo?: boolean
          mandal?: string | null
          marital_status?: number | null
          matched_to?: string | null
          occupation_category?: number | null
          occupation_text?: string | null
          participant_code?: string
          phone?: string | null
          pincode?: string | null
          preferred_language?: string
          rural_urban?: string | null
          sex?: Database["public"]["Enums"]["sex_at_intake"]
          site_id?: string
          state?: string | null
          state_?: Database["public"]["Enums"]["participant_state"]
          updated_at?: string
          village_town?: string | null
          years_of_education?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "participants_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "participants_matched_to_fkey"
            columns: ["matched_to"]
            isOneToOne: false
            referencedRelation: "participants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "participants_matched_to_fkey"
            columns: ["matched_to"]
            isOneToOne: false
            referencedRelation: "study_participants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "participants_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          active: boolean
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          role: Database["public"]["Enums"]["staff_role"]
          site_id: string | null
        }
        Insert: {
          active?: boolean
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          role?: Database["public"]["Enums"]["staff_role"]
          site_id?: string | null
        }
        Update: {
          active?: boolean
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          role?: Database["public"]["Enums"]["staff_role"]
          site_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      question_bank_instruments: {
        Row: {
          blurb_en: string | null
          blurb_te: string | null
          code: string
          created_at: string
          created_by: string | null
          id: string
          is_builtin: boolean
          name_en: string
          name_te: string | null
          order_index: number
          source: string | null
          source_item_count: number | null
          updated_at: string
        }
        Insert: {
          blurb_en?: string | null
          blurb_te?: string | null
          code: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_builtin?: boolean
          name_en: string
          name_te?: string | null
          order_index?: number
          source?: string | null
          source_item_count?: number | null
          updated_at?: string
        }
        Update: {
          blurb_en?: string | null
          blurb_te?: string | null
          code?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_builtin?: boolean
          name_en?: string
          name_te?: string | null
          order_index?: number
          source?: string | null
          source_item_count?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      question_bank_item_options: {
        Row: {
          created_at: string
          id: string
          item_id: string
          label_en: string
          label_te: string | null
          order_index: number
        }
        Insert: {
          created_at?: string
          id?: string
          item_id: string
          label_en: string
          label_te?: string | null
          order_index?: number
        }
        Update: {
          created_at?: string
          id?: string
          item_id?: string
          label_en?: string
          label_te?: string | null
          order_index?: number
        }
        Relationships: [
          {
            foreignKeyName: "question_bank_item_options_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "question_bank_items"
            referencedColumns: ["id"]
          },
        ]
      }
      question_bank_items: {
        Row: {
          created_at: string
          id: string
          instrument_id: string
          is_builtin: boolean
          kind: Database["public"]["Enums"]["question_kind"]
          order_index: number
          prompt_en: string
          prompt_te: string | null
          required: boolean
          source_snapshot: Json | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          instrument_id: string
          is_builtin?: boolean
          kind?: Database["public"]["Enums"]["question_kind"]
          order_index?: number
          prompt_en: string
          prompt_te?: string | null
          required?: boolean
          source_snapshot?: Json | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          instrument_id?: string
          is_builtin?: boolean
          kind?: Database["public"]["Enums"]["question_kind"]
          order_index?: number
          prompt_en?: string
          prompt_te?: string | null
          required?: boolean
          source_snapshot?: Json | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "question_bank_items_instrument_id_fkey"
            columns: ["instrument_id"]
            isOneToOne: false
            referencedRelation: "question_bank_instruments"
            referencedColumns: ["id"]
          },
        ]
      }
      responses: {
        Row: {
          answered_at: string
          assignment_id: string
          id: string
          input_method: string | null
          item_id: string
          language: string | null
          special_code: number | null
          updated_at: string
          value_int: number | null
          value_json: Json | null
          value_text: string | null
        }
        Insert: {
          answered_at?: string
          assignment_id: string
          id?: string
          input_method?: string | null
          item_id: string
          language?: string | null
          special_code?: number | null
          updated_at?: string
          value_int?: number | null
          value_json?: Json | null
          value_text?: string | null
        }
        Update: {
          answered_at?: string
          assignment_id?: string
          id?: string
          input_method?: string | null
          item_id?: string
          language?: string | null
          special_code?: number | null
          updated_at?: string
          value_int?: number | null
          value_json?: Json | null
          value_text?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "responses_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "responses_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "study_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "responses_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "instrument_items"
            referencedColumns: ["id"]
          },
        ]
      }
      scale_options: {
        Row: {
          id: string
          label: Json
          order_index: number
          scale_id: string
          value: number
        }
        Insert: {
          id?: string
          label?: Json
          order_index?: number
          scale_id: string
          value: number
        }
        Update: {
          id?: string
          label?: Json
          order_index?: number
          scale_id?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "scale_options_scale_id_fkey"
            columns: ["scale_id"]
            isOneToOne: false
            referencedRelation: "scales"
            referencedColumns: ["id"]
          },
        ]
      }
      scales: {
        Row: {
          code: string
          created_at: string
          id: string
          max_value: number | null
          min_value: number | null
          name: string
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          max_value?: number | null
          min_value?: number | null
          name: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          max_value?: number | null
          min_value?: number | null
          name?: string
        }
        Relationships: []
      }
      scores: {
        Row: {
          assignment_id: string
          average_score: number | null
          computable: boolean
          computed_at: string
          id: string
          instrument_id: string
          items_answered: number
          items_total: number
          prorated_score: number | null
          raw_score: number | null
          subscale: string | null
        }
        Insert: {
          assignment_id: string
          average_score?: number | null
          computable?: boolean
          computed_at?: string
          id?: string
          instrument_id: string
          items_answered?: number
          items_total?: number
          prorated_score?: number | null
          raw_score?: number | null
          subscale?: string | null
        }
        Update: {
          assignment_id?: string
          average_score?: number | null
          computable?: boolean
          computed_at?: string
          id?: string
          instrument_id?: string
          items_answered?: number
          items_total?: number
          prorated_score?: number | null
          raw_score?: number | null
          subscale?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "scores_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scores_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "study_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scores_instrument_id_fkey"
            columns: ["instrument_id"]
            isOneToOne: false
            referencedRelation: "instruments"
            referencedColumns: ["id"]
          },
        ]
      }
      sites: {
        Row: {
          code: string
          country: string
          created_at: string
          district: string | null
          id: string
          name: string
          state: string | null
        }
        Insert: {
          code: string
          country?: string
          created_at?: string
          district?: string | null
          id?: string
          name: string
          state?: string | null
        }
        Update: {
          code?: string
          country?: string
          created_at?: string
          district?: string | null
          id?: string
          name?: string
          state?: string | null
        }
        Relationships: []
      }
      survey_answers: {
        Row: {
          answered_at: string | null
          edited: boolean
          emoji: string | null
          id: string
          question_id: string
          response_id: string
          seconds_spent: number | null
          skipped: boolean
          value_int: number | null
          value_json: Json | null
          value_text: string | null
          voice_used: boolean
        }
        Insert: {
          answered_at?: string | null
          edited?: boolean
          emoji?: string | null
          id?: string
          question_id: string
          response_id: string
          seconds_spent?: number | null
          skipped?: boolean
          value_int?: number | null
          value_json?: Json | null
          value_text?: string | null
          voice_used?: boolean
        }
        Update: {
          answered_at?: string | null
          edited?: boolean
          emoji?: string | null
          id?: string
          question_id?: string
          response_id?: string
          seconds_spent?: number | null
          skipped?: boolean
          value_int?: number | null
          value_json?: Json | null
          value_text?: string | null
          voice_used?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "survey_answers_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "survey_questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "survey_answers_response_id_fkey"
            columns: ["response_id"]
            isOneToOne: false
            referencedRelation: "survey_responses"
            referencedColumns: ["id"]
          },
        ]
      }
      survey_question_options: {
        Row: {
          created_at: string
          id: string
          label_en: string
          label_te: string | null
          order_index: number
          question_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          label_en: string
          label_te?: string | null
          order_index?: number
          question_id: string
        }
        Update: {
          created_at?: string
          id?: string
          label_en?: string
          label_te?: string | null
          order_index?: number
          question_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "survey_question_options_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "survey_questions"
            referencedColumns: ["id"]
          },
        ]
      }
      survey_questions: {
        Row: {
          created_at: string
          id: string
          kind: Database["public"]["Enums"]["question_kind"]
          order_index: number
          origin: Database["public"]["Enums"]["question_origin"]
          prompt_en: string
          prompt_te: string | null
          required: boolean
          section_id: string | null
          source_ref: string | null
          survey_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["question_kind"]
          order_index?: number
          origin?: Database["public"]["Enums"]["question_origin"]
          prompt_en: string
          prompt_te?: string | null
          required?: boolean
          section_id?: string | null
          source_ref?: string | null
          survey_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["question_kind"]
          order_index?: number
          origin?: Database["public"]["Enums"]["question_origin"]
          prompt_en?: string
          prompt_te?: string | null
          required?: boolean
          section_id?: string | null
          source_ref?: string | null
          survey_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "survey_questions_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "survey_sections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "survey_questions_source_ref_fkey"
            columns: ["source_ref"]
            isOneToOne: false
            referencedRelation: "import_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "survey_questions_survey_id_fkey"
            columns: ["survey_id"]
            isOneToOne: false
            referencedRelation: "surveys"
            referencedColumns: ["id"]
          },
        ]
      }
      survey_responses: {
        Row: {
          answered_count: number | null
          completion_pct: number | null
          duration_seconds: number | null
          family_case_id: string | null
          id: string
          ip_hash: string | null
          language: string
          question_count: number | null
          reference_id: string | null
          started_at: string | null
          submitted_at: string
          survey_id: string
          user_agent: string | null
        }
        Insert: {
          answered_count?: number | null
          completion_pct?: number | null
          duration_seconds?: number | null
          family_case_id?: string | null
          id?: string
          ip_hash?: string | null
          language?: string
          question_count?: number | null
          reference_id?: string | null
          started_at?: string | null
          submitted_at?: string
          survey_id: string
          user_agent?: string | null
        }
        Update: {
          answered_count?: number | null
          completion_pct?: number | null
          duration_seconds?: number | null
          family_case_id?: string | null
          id?: string
          ip_hash?: string | null
          language?: string
          question_count?: number | null
          reference_id?: string | null
          started_at?: string | null
          submitted_at?: string
          survey_id?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "survey_responses_family_case_id_fkey"
            columns: ["family_case_id"]
            isOneToOne: false
            referencedRelation: "family_cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "survey_responses_survey_id_fkey"
            columns: ["survey_id"]
            isOneToOne: false
            referencedRelation: "surveys"
            referencedColumns: ["id"]
          },
        ]
      }
      survey_sections: {
        Row: {
          collapsed: boolean
          created_at: string
          description_en: string | null
          description_te: string | null
          id: string
          order_index: number
          survey_id: string
          title_en: string
          title_te: string | null
          updated_at: string
        }
        Insert: {
          collapsed?: boolean
          created_at?: string
          description_en?: string | null
          description_te?: string | null
          id?: string
          order_index?: number
          survey_id: string
          title_en?: string
          title_te?: string | null
          updated_at?: string
        }
        Update: {
          collapsed?: boolean
          created_at?: string
          description_en?: string | null
          description_te?: string | null
          id?: string
          order_index?: number
          survey_id?: string
          title_en?: string
          title_te?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "survey_sections_survey_id_fkey"
            columns: ["survey_id"]
            isOneToOne: false
            referencedRelation: "surveys"
            referencedColumns: ["id"]
          },
        ]
      }
      survey_submission_rate_limits: {
        Row: {
          daily_count: number
          daily_window_started_at: string
          ip_hash: string
          last_submitted_at: string
          survey_id: string
        }
        Insert: {
          daily_count?: number
          daily_window_started_at?: string
          ip_hash: string
          last_submitted_at?: string
          survey_id: string
        }
        Update: {
          daily_count?: number
          daily_window_started_at?: string
          ip_hash?: string
          last_submitted_at?: string
          survey_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "survey_submission_rate_limits_survey_id_fkey"
            columns: ["survey_id"]
            isOneToOne: false
            referencedRelation: "surveys"
            referencedColumns: ["id"]
          },
        ]
      }
      survey_views: {
        Row: {
          id: string
          survey_id: string
          viewed_at: string
        }
        Insert: {
          id?: string
          survey_id: string
          viewed_at?: string
        }
        Update: {
          id?: string
          survey_id?: string
          viewed_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "survey_views_survey_id_fkey"
            columns: ["survey_id"]
            isOneToOne: false
            referencedRelation: "surveys"
            referencedColumns: ["id"]
          },
        ]
      }
      surveys: {
        Row: {
          created_at: string
          created_by: string | null
          description_en: string | null
          description_te: string | null
          id: string
          published_at: string | null
          slug: string | null
          status: Database["public"]["Enums"]["survey_status"]
          title_en: string
          title_te: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description_en?: string | null
          description_te?: string | null
          id?: string
          published_at?: string | null
          slug?: string | null
          status?: Database["public"]["Enums"]["survey_status"]
          title_en: string
          title_te?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description_en?: string | null
          description_te?: string | null
          id?: string
          published_at?: string | null
          slug?: string | null
          status?: Database["public"]["Enums"]["survey_status"]
          title_en?: string
          title_te?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      study_assignments: {
        Row: {
          access_token: string | null
          available_at: string | null
          batch_id: string | null
          completed_at: string | null
          due_at: string | null
          id: string | null
          language: string | null
          participant_id: string | null
          started_at: string | null
          state: Database["public"]["Enums"]["assignment_state"] | null
        }
        Relationships: [
          {
            foreignKeyName: "assignments_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignments_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "participants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignments_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "study_participants"
            referencedColumns: ["id"]
          },
        ]
      }
      study_participants: {
        Row: {
          admitted_at: string | null
          age_stratum: Database["public"]["Enums"]["age_stratum"] | null
          area_of_residence: string | null
          arm: Database["public"]["Enums"]["study_arm"] | null
          attended_by: number | null
          created_at: string | null
          created_by: string | null
          currently_in_school: boolean | null
          date_of_birth: string | null
          discharged_at: string | null
          district: string | null
          email: string | null
          employment_status: number | null
          enrolled_at: string | null
          full_name: string | null
          highest_education: string | null
          id: string | null
          is_demo: boolean | null
          mandal: string | null
          marital_status: number | null
          matched_to: string | null
          occupation_category: number | null
          occupation_text: string | null
          participant_code: string | null
          phone: string | null
          pincode: string | null
          preferred_language: string | null
          rural_urban: string | null
          sex: Database["public"]["Enums"]["sex_at_intake"] | null
          site_id: string | null
          state: string | null
          state_: Database["public"]["Enums"]["participant_state"] | null
          updated_at: string | null
          village_town: string | null
          years_of_education: number | null
        }
        Insert: {
          admitted_at?: string | null
          age_stratum?: Database["public"]["Enums"]["age_stratum"] | null
          area_of_residence?: string | null
          arm?: Database["public"]["Enums"]["study_arm"] | null
          attended_by?: number | null
          created_at?: string | null
          created_by?: string | null
          currently_in_school?: boolean | null
          date_of_birth?: string | null
          discharged_at?: string | null
          district?: string | null
          email?: string | null
          employment_status?: number | null
          enrolled_at?: string | null
          full_name?: string | null
          highest_education?: string | null
          id?: string | null
          is_demo?: boolean | null
          mandal?: string | null
          marital_status?: number | null
          matched_to?: string | null
          occupation_category?: number | null
          occupation_text?: string | null
          participant_code?: string | null
          phone?: string | null
          pincode?: string | null
          preferred_language?: string | null
          rural_urban?: string | null
          sex?: Database["public"]["Enums"]["sex_at_intake"] | null
          site_id?: string | null
          state?: string | null
          state_?: Database["public"]["Enums"]["participant_state"] | null
          updated_at?: string | null
          village_town?: string | null
          years_of_education?: number | null
        }
        Update: {
          admitted_at?: string | null
          age_stratum?: Database["public"]["Enums"]["age_stratum"] | null
          area_of_residence?: string | null
          arm?: Database["public"]["Enums"]["study_arm"] | null
          attended_by?: number | null
          created_at?: string | null
          created_by?: string | null
          currently_in_school?: boolean | null
          date_of_birth?: string | null
          discharged_at?: string | null
          district?: string | null
          email?: string | null
          employment_status?: number | null
          enrolled_at?: string | null
          full_name?: string | null
          highest_education?: string | null
          id?: string | null
          is_demo?: boolean | null
          mandal?: string | null
          marital_status?: number | null
          matched_to?: string | null
          occupation_category?: number | null
          occupation_text?: string | null
          participant_code?: string | null
          phone?: string | null
          pincode?: string | null
          preferred_language?: string | null
          rural_urban?: string | null
          sex?: Database["public"]["Enums"]["sex_at_intake"] | null
          site_id?: string | null
          state?: string | null
          state_?: Database["public"]["Enums"]["participant_state"] | null
          updated_at?: string | null
          village_town?: string | null
          years_of_education?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "participants_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "participants_matched_to_fkey"
            columns: ["matched_to"]
            isOneToOne: false
            referencedRelation: "participants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "participants_matched_to_fkey"
            columns: ["matched_to"]
            isOneToOne: false
            referencedRelation: "study_participants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "participants_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      study_scores: {
        Row: {
          assignment_id: string | null
          average_score: number | null
          computable: boolean | null
          computed_at: string | null
          id: string | null
          instrument_id: string | null
          items_answered: number | null
          items_total: number | null
          prorated_score: number | null
          raw_score: number | null
          subscale: string | null
        }
        Relationships: [
          {
            foreignKeyName: "scores_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scores_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "study_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scores_instrument_id_fkey"
            columns: ["instrument_id"]
            isOneToOne: false
            referencedRelation: "instruments"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      allocate_participant_code: {
        Args: {
          p_arm: Database["public"]["Enums"]["study_arm"]
          p_site: string
        }
        Returns: string
      }
      assignment_for_token: {
        Args: { p_token: string }
        Returns: {
          access_token: string
          available_at: string
          batch_id: string
          completed_at: string | null
          due_at: string
          id: string
          language: string | null
          participant_id: string
          started_at: string | null
          state: Database["public"]["Enums"]["assignment_state"]
        }
        SetofOptions: {
          from: "*"
          to: "assignments"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      can_see_participant: { Args: { p_site: string }; Returns: boolean }
      check_cron_secret: { Args: { p_secret: string }; Returns: boolean }
      claim_family_login_attempt: {
        Args: {
          p_ip_hash: string
          p_max_attempts?: number
          p_window_seconds?: number
        }
        Returns: boolean
      }
      claim_survey_submission_slot: {
        Args: {
          p_ip_hash: string
          p_max_per_day?: number
          p_min_interval_seconds?: number
          p_survey_id: string
        }
        Returns: boolean
      }
      complete_survey: { Args: { p_token: string }; Returns: Json }
      compute_scores: { Args: { p_assignment: string }; Returns: number }
      current_staff_role: {
        Args: never
        Returns: Database["public"]["Enums"]["staff_role"]
      }
      demo_batches: { Args: never; Returns: Json }
      demo_catalogue: { Args: never; Returns: Json }
      demo_consent: {
        Args: { p_consented: boolean; p_participant: string }
        Returns: Json
      }
      demo_register:
        | {
            Args: {
              p_area?: string
              p_arm?: string
              p_district?: string
              p_dob: string
              p_education?: string
              p_email?: string
              p_full_name: string
              p_language?: string
              p_occupation?: string
              p_phone?: string
              p_rural_urban?: string
              p_sex: string
              p_state?: string
            }
            Returns: Json
          }
        | {
            Args: {
              p_area?: string
              p_arm?: string
              p_district?: string
              p_dob: string
              p_education?: string
              p_email?: string
              p_full_name: string
              p_language?: string
              p_occupation?: string
              p_participant_code?: string
              p_phone?: string
              p_rural_urban?: string
              p_sex: string
              p_state?: string
            }
            Returns: Json
          }
      due_reminders: { Args: { p_secret: string }; Returns: Json }
      expire_stale_family_cases: { Args: never; Returns: number }
      family_case_stats: {
        Args: never
        Returns: {
          avg_completion_seconds: number
          completed: number
          completed_today: number
          expired: number
          in_progress: number
          not_started: number
          opened: number
          total: number
        }[]
      }
      get_survey: { Args: { p_token: string }; Returns: Json }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: never; Returns: boolean }
      is_staff: { Args: never; Returns: boolean }
      log_notification: {
        Args: {
          p_assignment: string
          p_channel: Database["public"]["Enums"]["notify_channel"]
          p_error?: string
          p_language: string
          p_participant: string
          p_provider_id?: string
          p_secret: string
          p_state: Database["public"]["Enums"]["notify_state"]
          p_template: string
          p_trigger?: Database["public"]["Enums"]["notify_trigger"]
        }
        Returns: string
      }
      next_family_reference_id: { Args: never; Returns: string }
      participant_anchor: {
        Args: { p: Database["public"]["Tables"]["participants"]["Row"] }
        Returns: string
      }
      participant_has_consent: { Args: { p_id: string }; Returns: boolean }
      patient_portal: { Args: { p_code: string; p_dob: string }; Returns: Json }
      purge_demo_data: { Args: { p_older_than?: string }; Returns: number }
      question_value_counts: {
        Args: { p_question_id: string; p_since?: string }
        Returns: {
          count: number
          value: string
        }[]
      }
      refresh_assignment_states: {
        Args: never
        Returns: {
          became_available: number
          became_missed: number
        }[]
      }
      reorder_question_bank_items: {
        Args: { p_ids: string[] }
        Returns: undefined
      }
      reorder_survey_options: { Args: { items: Json }; Returns: undefined }
      reorder_survey_questions: { Args: { items: Json }; Returns: undefined }
      reorder_survey_sections: { Args: { items: Json }; Returns: undefined }
      save_response: {
        Args: {
          p_input_method?: string
          p_item: string
          p_language?: string
          p_token: string
          p_value_int?: number
          p_value_text?: string
        }
        Returns: Json
      }
      schedule_participant: { Args: { p_id: string }; Returns: number }
      set_cron_secret: { Args: { p_secret: string }; Returns: undefined }
      survey_list_counts: {
        Args: never
        Returns: {
          question_count: number
          response_count: number
          survey_id: string
        }[]
      }
      survey_period_comparison: {
        Args: { p_period: string; p_survey_id: string }
        Returns: {
          current_count: number
          previous_count: number
        }[]
      }
      survey_response_stats: {
        Args: { p_survey_id: string }
        Returns: {
          avg_seconds_to_complete: number
          last_response_at: string
          responses_today: number
          total_responses: number
          total_views: number
        }[]
      }
      survey_response_timeseries: {
        Args: { p_granularity: string; p_since: string; p_survey_id: string }
        Returns: {
          bucket: string
          count: number
        }[]
      }
    }
    Enums: {
      age_stratum: "A_18_24" | "B_25_39"
      app_role: "user" | "super_admin"
      assignment_state:
        | "scheduled"
        | "available"
        | "in_progress"
        | "completed"
        | "missed"
        | "skipped"
      family_case_status:
        | "not_started"
        | "opened"
        | "in_progress"
        | "completed"
        | "expired"
        | "reopened"
      item_type:
        | "single_choice"
        | "multi_choice"
        | "likert"
        | "yes_no"
        | "short_text"
        | "long_text"
        | "integer"
        | "decimal"
        | "date"
        | "time"
        | "datetime"
        | "grid"
        | "icd10_selfharm"
      notify_channel: "email" | "whatsapp" | "sms"
      notify_state:
        | "pending"
        | "queued"
        | "sent"
        | "delivered"
        | "failed"
        | "cancelled"
      notify_trigger: "auto" | "manual"
      participant_state:
        | "registered"
        | "consented"
        | "declined"
        | "active"
        | "completed"
        | "withdrawn"
        | "lost_to_followup"
        | "deceased"
      question_kind:
        | "multiple_choice"
        | "checkboxes"
        | "likert5"
        | "yes_no"
        | "rating5"
        | "short_text"
        | "long_text"
        | "dropdown"
      question_origin: "manual" | "voice" | "pdf"
      sex_at_intake: "male" | "female" | "transsexual"
      staff_role: "participant" | "interviewer" | "investigator" | "admin"
      study_arm: "case" | "control"
      survey_status: "draft" | "published" | "closed"
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
      age_stratum: ["A_18_24", "B_25_39"],
      app_role: ["user", "super_admin"],
      assignment_state: [
        "scheduled",
        "available",
        "in_progress",
        "completed",
        "missed",
        "skipped",
      ],
      family_case_status: [
        "not_started",
        "opened",
        "in_progress",
        "completed",
        "expired",
        "reopened",
      ],
      item_type: [
        "single_choice",
        "multi_choice",
        "likert",
        "yes_no",
        "short_text",
        "long_text",
        "integer",
        "decimal",
        "date",
        "time",
        "datetime",
        "grid",
        "icd10_selfharm",
      ],
      notify_channel: ["email", "whatsapp", "sms"],
      notify_state: [
        "pending",
        "queued",
        "sent",
        "delivered",
        "failed",
        "cancelled",
      ],
      notify_trigger: ["auto", "manual"],
      participant_state: [
        "registered",
        "consented",
        "declined",
        "active",
        "completed",
        "withdrawn",
        "lost_to_followup",
        "deceased",
      ],
      question_kind: [
        "multiple_choice",
        "checkboxes",
        "likert5",
        "yes_no",
        "rating5",
        "short_text",
        "long_text",
        "dropdown",
      ],
      question_origin: ["manual", "voice", "pdf"],
      sex_at_intake: ["male", "female", "transsexual"],
      staff_role: ["participant", "interviewer", "investigator", "admin"],
      study_arm: ["case", "control"],
      survey_status: ["draft", "published", "closed"],
    },
  },
} as const
