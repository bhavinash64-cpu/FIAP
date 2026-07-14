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
      assessment_responses: {
        Row: {
          answered_at: string
          id: string
          question_key: string
          session_id: string
          value_int: number | null
          value_json: Json | null
          value_text: string | null
        }
        Insert: {
          answered_at?: string
          id?: string
          question_key: string
          session_id: string
          value_int?: number | null
          value_json?: Json | null
          value_text?: string | null
        }
        Update: {
          answered_at?: string
          id?: string
          question_key?: string
          session_id?: string
          value_int?: number | null
          value_json?: Json | null
          value_text?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "assessment_responses_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "assessment_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      assessment_sessions: {
        Row: {
          completed_at: string | null
          created_by: string | null
          current_index: number
          id: string
          instrument: Database["public"]["Enums"]["instrument_type"]
          language: string
          participant_id: string
          score: Json | null
          started_at: string
          status: Database["public"]["Enums"]["session_status"]
          total_items: number
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          created_by?: string | null
          current_index?: number
          id?: string
          instrument: Database["public"]["Enums"]["instrument_type"]
          language?: string
          participant_id: string
          score?: Json | null
          started_at?: string
          status?: Database["public"]["Enums"]["session_status"]
          total_items?: number
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          created_by?: string | null
          current_index?: number
          id?: string
          instrument?: Database["public"]["Enums"]["instrument_type"]
          language?: string
          participant_id?: string
          score?: Json | null
          started_at?: string
          status?: Database["public"]["Enums"]["session_status"]
          total_items?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "assessment_sessions_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "participants"
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
      participants: {
        Row: {
          age: number | null
          age_band: string | null
          code: string
          consent_at: string | null
          consent_given: boolean
          consent_language: string | null
          created_at: string
          created_by: string | null
          district: string | null
          gender: string | null
          hospital: string | null
          id: string
          mandal: string | null
          notes: string | null
          owner_user_id: string | null
          study_group: Database["public"]["Enums"]["study_group"] | null
          updated_at: string
        }
        Insert: {
          age?: number | null
          age_band?: string | null
          code: string
          consent_at?: string | null
          consent_given?: boolean
          consent_language?: string | null
          created_at?: string
          created_by?: string | null
          district?: string | null
          gender?: string | null
          hospital?: string | null
          id?: string
          mandal?: string | null
          notes?: string | null
          owner_user_id?: string | null
          study_group?: Database["public"]["Enums"]["study_group"] | null
          updated_at?: string
        }
        Update: {
          age?: number | null
          age_band?: string | null
          code?: string
          consent_at?: string | null
          consent_given?: boolean
          consent_language?: string | null
          created_at?: string
          created_by?: string | null
          district?: string | null
          gender?: string | null
          hospital?: string | null
          id?: string
          mandal?: string | null
          notes?: string | null
          owner_user_id?: string | null
          study_group?: Database["public"]["Enums"]["study_group"] | null
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          district: string | null
          full_name: string | null
          id: string
          phone: string | null
          preferred_language: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          district?: string | null
          full_name?: string | null
          id: string
          phone?: string | null
          preferred_language?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          district?: string | null
          full_name?: string | null
          id?: string
          phone?: string | null
          preferred_language?: string
          updated_at?: string
        }
        Relationships: []
      }
      question_bank: {
        Row: {
          active: boolean
          created_at: string
          domain: string | null
          hint_en: string | null
          hint_te: string | null
          id: string
          instrument: string
          key: string
          kind: string
          order_index: number
          prompt_en: string
          prompt_te: string | null
          required: boolean
          reverse: boolean
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          domain?: string | null
          hint_en?: string | null
          hint_te?: string | null
          id?: string
          instrument: string
          key: string
          kind?: string
          order_index?: number
          prompt_en: string
          prompt_te?: string | null
          required?: boolean
          reverse?: boolean
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          domain?: string | null
          hint_en?: string | null
          hint_te?: string | null
          id?: string
          instrument?: string
          key?: string
          kind?: string
          order_index?: number
          prompt_en?: string
          prompt_te?: string | null
          required?: boolean
          reverse?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      question_option: {
        Row: {
          created_at: string
          id: string
          label_en: string
          label_te: string | null
          order_index: number
          question_id: string
          value_int: number | null
          value_text: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          label_en: string
          label_te?: string | null
          order_index?: number
          question_id: string
          value_int?: number | null
          value_text?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          label_en?: string
          label_te?: string | null
          order_index?: number
          question_id?: string
          value_int?: number | null
          value_text?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "question_option_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "question_bank"
            referencedColumns: ["id"]
          },
        ]
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
          source_ref?: string | null
          survey_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "survey_questions_survey_id_fkey"
            columns: ["survey_id"]
            isOneToOne: false
            referencedRelation: "surveys"
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
      survey_responses: {
        Row: {
          id: string
          ip_hash: string | null
          language: string
          started_at: string | null
          submitted_at: string
          survey_id: string
          user_agent: string | null
        }
        Insert: {
          id?: string
          ip_hash?: string | null
          language?: string
          started_at?: string | null
          submitted_at?: string
          survey_id: string
          user_agent?: string | null
        }
        Update: {
          id?: string
          ip_hash?: string | null
          language?: string
          started_at?: string | null
          submitted_at?: string
          survey_id?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "survey_responses_survey_id_fkey"
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
      survey_answers: {
        Row: {
          id: string
          question_id: string
          response_id: string
          value_int: number | null
          value_json: Json | null
          value_text: string | null
        }
        Insert: {
          id?: string
          question_id: string
          response_id: string
          value_int?: number | null
          value_json?: Json | null
          value_text?: string | null
        }
        Update: {
          id?: string
          question_id?: string
          response_id?: string
          value_int?: number | null
          value_json?: Json | null
          value_text?: string | null
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      current_user_has_any_role: {
        Args: { _roles: Database["public"]["Enums"]["app_role"][] }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      survey_response_stats: {
        Args: { p_survey_id: string }
        Returns: {
          total_responses: number
          responses_today: number
          last_response_at: string | null
          avg_seconds_to_complete: number | null
          total_views: number
        }[]
      }
      survey_response_timeseries: {
        Args: { p_survey_id: string; p_granularity: string; p_since: string }
        Returns: { bucket: string; count: number }[]
      }
      question_value_counts: {
        Args: { p_question_id: string; p_since?: string | null }
        Returns: { value: string; count: number }[]
      }
      survey_period_comparison: {
        Args: { p_survey_id: string; p_period: string }
        Returns: { current_count: number; previous_count: number }[]
      }
    }
    Enums: {
      app_role:
        | "admin"
        | "police"
        | "researcher"
        | "analyst"
        | "user"
        | "super_admin"
      instrument_type:
        | "DEMOGRAPHIC"
        | "PID5BF"
        | "IRI"
        | "CIUS"
        | "DIGITAL_USE"
        | "SUICIDE_HISTORY"
      session_status: "in_progress" | "completed" | "abandoned"
      study_group: "case" | "control"
      survey_status: "draft" | "published" | "closed"
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
      app_role: [
        "admin",
        "police",
        "researcher",
        "analyst",
        "user",
        "super_admin",
      ],
      instrument_type: [
        "DEMOGRAPHIC",
        "PID5BF",
        "IRI",
        "CIUS",
        "DIGITAL_USE",
        "SUICIDE_HISTORY",
      ],
      session_status: ["in_progress", "completed", "abandoned"],
      study_group: ["case", "control"],
      survey_status: ["draft", "published", "closed"],
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
    },
  },
} as const
