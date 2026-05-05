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
      audit_log: {
        Row: {
          action: string
          actor_email: string | null
          actor_id: string | null
          created_at: string
          details: Json | null
          entity_id: string | null
          entity_type: string | null
          id: string
        }
        Insert: {
          action: string
          actor_email?: string | null
          actor_id?: string | null
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
        }
        Update: {
          action?: string
          actor_email?: string | null
          actor_id?: string | null
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
        }
        Relationships: []
      }
      branches: {
        Row: {
          code: string
          created_at: string
          display_order: number
          id: string
          is_hq: boolean
          name_ar: string
          name_en: string
          region: string
        }
        Insert: {
          code: string
          created_at?: string
          display_order?: number
          id?: string
          is_hq?: boolean
          name_ar: string
          name_en: string
          region: string
        }
        Update: {
          code?: string
          created_at?: string
          display_order?: number
          id?: string
          is_hq?: boolean
          name_ar?: string
          name_en?: string
          region?: string
        }
        Relationships: []
      }
      candidates: {
        Row: {
          applied_date: string
          candidate_code: string | null
          city: string | null
          created_at: string
          cv_text: string | null
          cv_url: string | null
          email: string
          full_name: string
          gender: string | null
          hired_date: string | null
          id: string
          job_id: string | null
          notes: string | null
          owner_id: string | null
          phone: string | null
          recommendation: string | null
          score: number
          screening_result: string | null
          source: string | null
          stage: string
          stage_entry_date: string
          status: string
          vision_used: boolean
        }
        Insert: {
          applied_date?: string
          candidate_code?: string | null
          city?: string | null
          created_at?: string
          cv_text?: string | null
          cv_url?: string | null
          email: string
          full_name: string
          gender?: string | null
          hired_date?: string | null
          id?: string
          job_id?: string | null
          notes?: string | null
          owner_id?: string | null
          phone?: string | null
          recommendation?: string | null
          score?: number
          screening_result?: string | null
          source?: string | null
          stage?: string
          stage_entry_date?: string
          status?: string
          vision_used?: boolean
        }
        Update: {
          applied_date?: string
          candidate_code?: string | null
          city?: string | null
          created_at?: string
          cv_text?: string | null
          cv_url?: string | null
          email?: string
          full_name?: string
          gender?: string | null
          hired_date?: string | null
          id?: string
          job_id?: string | null
          notes?: string | null
          owner_id?: string | null
          phone?: string | null
          recommendation?: string | null
          score?: number
          screening_result?: string | null
          source?: string | null
          stage?: string
          stage_entry_date?: string
          status?: string
          vision_used?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "candidates_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      committees: {
        Row: {
          active: boolean
          branch_id: string | null
          created_at: string
          id: string
          name_ar: string
          name_en: string | null
        }
        Insert: {
          active?: boolean
          branch_id?: string | null
          created_at?: string
          id?: string
          name_ar: string
          name_en?: string | null
        }
        Update: {
          active?: boolean
          branch_id?: string | null
          created_at?: string
          id?: string
          name_ar?: string
          name_en?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "committees_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      interview_schedule: {
        Row: {
          candidate_id: string | null
          committee_id: string | null
          committee_name: string
          created_at: string
          duration_minutes: number
          id: string
          interviewer_id: string | null
          notes: string | null
          region: string
          result: string | null
          scheduled_date: string
          scheduled_time: string | null
          status: string
        }
        Insert: {
          candidate_id?: string | null
          committee_id?: string | null
          committee_name: string
          created_at?: string
          duration_minutes?: number
          id?: string
          interviewer_id?: string | null
          notes?: string | null
          region: string
          result?: string | null
          scheduled_date: string
          scheduled_time?: string | null
          status?: string
        }
        Update: {
          candidate_id?: string | null
          committee_id?: string | null
          committee_name?: string
          created_at?: string
          duration_minutes?: number
          id?: string
          interviewer_id?: string | null
          notes?: string | null
          region?: string
          result?: string | null
          scheduled_date?: string
          scheduled_time?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "interview_schedule_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interview_schedule_committee_id_fkey"
            columns: ["committee_id"]
            isOneToOne: false
            referencedRelation: "committees"
            referencedColumns: ["id"]
          },
        ]
      }
      jobs: {
        Row: {
          branch: string
          branch_id: string | null
          created_at: string
          description: string | null
          headcount: number
          hired_count: number
          hiring_manager_id: string | null
          id: string
          job_code: string
          opened_at: string
          priority: string
          recruiter_id: string | null
          region: string
          status: string
          target_fill_date: string | null
          title: string
        }
        Insert: {
          branch: string
          branch_id?: string | null
          created_at?: string
          description?: string | null
          headcount?: number
          hired_count?: number
          hiring_manager_id?: string | null
          id?: string
          job_code: string
          opened_at?: string
          priority?: string
          recruiter_id?: string | null
          region: string
          status?: string
          target_fill_date?: string | null
          title: string
        }
        Update: {
          branch?: string
          branch_id?: string | null
          created_at?: string
          description?: string | null
          headcount?: number
          hired_count?: number
          hiring_manager_id?: string | null
          id?: string
          job_code?: string
          opened_at?: string
          priority?: string
          recruiter_id?: string | null
          region?: string
          status?: string
          target_fill_date?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "jobs_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      message_templates: {
        Row: {
          body_ar: string
          body_en: string
          channel: string
          created_at: string
          id: string
          name: string
          subject_ar: string | null
          subject_en: string | null
          template_key: string
        }
        Insert: {
          body_ar: string
          body_en: string
          channel?: string
          created_at?: string
          id?: string
          name: string
          subject_ar?: string | null
          subject_en?: string | null
          template_key: string
        }
        Update: {
          body_ar?: string
          body_en?: string
          channel?: string
          created_at?: string
          id?: string
          name?: string
          subject_ar?: string | null
          subject_en?: string | null
          template_key?: string
        }
        Relationships: []
      }
      offers: {
        Row: {
          candidate_id: string
          created_at: string
          currency: string
          expected_start_date: string | null
          id: string
          job_id: string | null
          notes: string | null
          responded_at: string | null
          salary: number | null
          sent_at: string | null
          status: string
        }
        Insert: {
          candidate_id: string
          created_at?: string
          currency?: string
          expected_start_date?: string | null
          id?: string
          job_id?: string | null
          notes?: string | null
          responded_at?: string | null
          salary?: number | null
          sent_at?: string | null
          status?: string
        }
        Update: {
          candidate_id?: string
          created_at?: string
          currency?: string
          expected_start_date?: string | null
          id?: string
          job_id?: string | null
          notes?: string | null
          responded_at?: string | null
          salary?: number | null
          sent_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "offers_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offers_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      pipeline_stages: {
        Row: {
          color: string | null
          display_order: number
          id: number
          is_terminal: boolean
          name: string
          name_ar: string | null
          sla_days: number
        }
        Insert: {
          color?: string | null
          display_order: number
          id?: number
          is_terminal?: boolean
          name: string
          name_ar?: string | null
          sla_days?: number
        }
        Update: {
          color?: string | null
          display_order?: number
          id?: number
          is_terminal?: boolean
          name?: string
          name_ar?: string | null
          sla_days?: number
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          preferred_language: Database["public"]["Enums"]["lang_code"]
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          preferred_language?: Database["public"]["Enums"]["lang_code"]
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          preferred_language?: Database["public"]["Enums"]["lang_code"]
        }
        Relationships: []
      }
      scorecards: {
        Row: {
          candidate_id: string
          comm_10: number
          comments: string | null
          created_at: string
          evaluator_id: string | null
          evaluator_name: string | null
          exp_20: number
          id: string
          learn_15: number
          pers_25: number
          rationale_ar: string | null
          rationale_en: string | null
          tech_30: number
          total: number | null
        }
        Insert: {
          candidate_id: string
          comm_10?: number
          comments?: string | null
          created_at?: string
          evaluator_id?: string | null
          evaluator_name?: string | null
          exp_20?: number
          id?: string
          learn_15?: number
          pers_25?: number
          rationale_ar?: string | null
          rationale_en?: string | null
          tech_30?: number
          total?: number | null
        }
        Update: {
          candidate_id?: string
          comm_10?: number
          comments?: string | null
          created_at?: string
          evaluator_id?: string | null
          evaluator_name?: string | null
          exp_20?: number
          id?: string
          learn_15?: number
          pers_25?: number
          rationale_ar?: string | null
          rationale_en?: string | null
          tech_30?: number
          total?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "scorecards_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
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
      is_authenticated: { Args: never; Returns: boolean }
      is_staff: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "recruiter" | "hiring_manager" | "interviewer"
      lang_code: "ar" | "en"
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
      app_role: ["admin", "recruiter", "hiring_manager", "interviewer"],
      lang_code: ["ar", "en"],
    },
  },
} as const
