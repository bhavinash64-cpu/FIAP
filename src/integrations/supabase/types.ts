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
        Relationships: [
          {
            foreignKeyName: "question_bank_instruments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
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
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      question_value_counts: {
        Args: { p_question_id: string; p_since?: string }
        Returns: {
          count: number
          value: string
        }[]
      }
      reorder_question_bank_items: { Args: { p_ids: string[] }; Returns: undefined }
      reorder_survey_options: { Args: { items: Json }; Returns: undefined }
      reorder_survey_questions: { Args: { items: Json }; Returns: undefined }
      reorder_survey_sections: { Args: { items: Json }; Returns: undefined }
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
      app_role: "user" | "super_admin"
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
      app_role: ["user", "super_admin"],
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
      survey_status: ["draft", "published", "closed"],
    },
  },
} as const
