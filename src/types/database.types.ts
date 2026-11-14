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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      appointments: {
        Row: {
          business_id: string
          cancel_reason: string | null
          created_at: string
          created_by: string | null
          customer_name: string
          customer_note: string | null
          customer_phone: string
          ends_at: string
          id: string
          price_uzs: number
          service_id: string
          source: Database["public"]["Enums"]["appointment_source"]
          staff_id: string
          starts_at: string
          status: Database["public"]["Enums"]["appointment_status"]
          status_changed_at: string | null
          status_changed_by: string | null
          updated_at: string
        }
        Insert: {
          business_id: string
          cancel_reason?: string | null
          created_at?: string
          created_by?: string | null
          customer_name: string
          customer_note?: string | null
          customer_phone: string
          ends_at: string
          id?: string
          price_uzs: number
          service_id: string
          source: Database["public"]["Enums"]["appointment_source"]
          staff_id: string
          starts_at: string
          status?: Database["public"]["Enums"]["appointment_status"]
          status_changed_at?: string | null
          status_changed_by?: string | null
          updated_at?: string
        }
        Update: {
          business_id?: string
          cancel_reason?: string | null
          created_at?: string
          created_by?: string | null
          customer_name?: string
          customer_note?: string | null
          customer_phone?: string
          ends_at?: string
          id?: string
          price_uzs?: number
          service_id?: string
          source?: Database["public"]["Enums"]["appointment_source"]
          staff_id?: string
          starts_at?: string
          status?: Database["public"]["Enums"]["appointment_status"]
          status_changed_at?: string | null
          status_changed_by?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointments_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_service_id_business_id_fkey"
            columns: ["service_id", "business_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id", "business_id"]
          },
          {
            foreignKeyName: "appointments_staff_id_business_id_fkey"
            columns: ["staff_id", "business_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id", "business_id"]
          },
        ]
      }
      business_members: {
        Row: {
          business_id: string
          created_at: string
          id: string
          role: Database["public"]["Enums"]["member_role"]
          staff_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          business_id: string
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["member_role"]
          staff_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          business_id?: string
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["member_role"]
          staff_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "business_members_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "business_members_staff_id_business_id_fkey"
            columns: ["staff_id", "business_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id", "business_id"]
          },
        ]
      }
      business_telegram_settings: {
        Row: {
          business_id: string
          chat_id: string | null
          chat_title: string | null
          created_at: string
          is_enabled: boolean
          last_error: string | null
          last_error_at: string | null
          linked_at: string | null
          updated_at: string
        }
        Insert: {
          business_id: string
          chat_id?: string | null
          chat_title?: string | null
          created_at?: string
          is_enabled?: boolean
          last_error?: string | null
          last_error_at?: string | null
          linked_at?: string | null
          updated_at?: string
        }
        Update: {
          business_id?: string
          chat_id?: string | null
          chat_title?: string | null
          created_at?: string
          is_enabled?: boolean
          last_error?: string | null
          last_error_at?: string | null
          linked_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "business_telegram_settings_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: true
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      businesses: {
        Row: {
          address: string | null
          auto_confirm: boolean
          booking_horizon_days: number
          cover_path: string | null
          created_at: string
          default_locale: string
          id: string
          is_active: boolean
          logo_path: string | null
          max_active_bookings_per_phone: number
          min_notice_minutes: number
          name: string
          phone: string | null
          slot_step_minutes: number
          slug: string
          timezone: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          auto_confirm?: boolean
          booking_horizon_days?: number
          cover_path?: string | null
          created_at?: string
          default_locale?: string
          id?: string
          is_active?: boolean
          logo_path?: string | null
          max_active_bookings_per_phone?: number
          min_notice_minutes?: number
          name: string
          phone?: string | null
          slot_step_minutes?: number
          slug: string
          timezone?: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          auto_confirm?: boolean
          booking_horizon_days?: number
          cover_path?: string | null
          created_at?: string
          default_locale?: string
          id?: string
          is_active?: boolean
          logo_path?: string | null
          max_active_bookings_per_phone?: number
          min_notice_minutes?: number
          name?: string
          phone?: string | null
          slot_step_minutes?: number
          slug?: string
          timezone?: string
          updated_at?: string
        }
        Relationships: []
      }
      salon_photos: {
        Row: {
          business_id: string
          created_at: string
          id: string
          path: string
        }
        Insert: {
          business_id: string
          created_at?: string
          id?: string
          path: string
        }
        Update: {
          business_id?: string
          created_at?: string
          id?: string
          path?: string
        }
        Relationships: [
          {
            foreignKeyName: "salon_photos_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      services: {
        Row: {
          business_id: string
          created_at: string
          description: string | null
          duration_minutes: number
          id: string
          is_active: boolean
          name: string
          photo_path: string | null
          price_uzs: number
          sort_order: number
          updated_at: string
        }
        Insert: {
          business_id: string
          created_at?: string
          description?: string | null
          duration_minutes: number
          id?: string
          is_active?: boolean
          name: string
          photo_path?: string | null
          price_uzs: number
          sort_order?: number
          updated_at?: string
        }
        Update: {
          business_id?: string
          created_at?: string
          description?: string | null
          duration_minutes?: number
          id?: string
          is_active?: boolean
          name?: string
          photo_path?: string | null
          price_uzs?: number
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "services_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      staff: {
        Row: {
          bio: string | null
          business_id: string
          created_at: string
          full_name: string
          id: string
          is_active: boolean
          photo_path: string | null
          sort_order: number
          updated_at: string
        }
        Insert: {
          bio?: string | null
          business_id: string
          created_at?: string
          full_name: string
          id?: string
          is_active?: boolean
          photo_path?: string | null
          sort_order?: number
          updated_at?: string
        }
        Update: {
          bio?: string | null
          business_id?: string
          created_at?: string
          full_name?: string
          id?: string
          is_active?: boolean
          photo_path?: string | null
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_services: {
        Row: {
          business_id: string
          created_at: string
          service_id: string
          staff_id: string
        }
        Insert: {
          business_id: string
          created_at?: string
          service_id: string
          staff_id: string
        }
        Update: {
          business_id?: string
          created_at?: string
          service_id?: string
          staff_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_services_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_services_service_id_business_id_fkey"
            columns: ["service_id", "business_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id", "business_id"]
          },
          {
            foreignKeyName: "staff_services_staff_id_business_id_fkey"
            columns: ["staff_id", "business_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id", "business_id"]
          },
        ]
      }
      time_off: {
        Row: {
          business_id: string
          created_at: string
          ends_at: string
          id: string
          reason: string | null
          staff_id: string | null
          starts_at: string
          updated_at: string
        }
        Insert: {
          business_id: string
          created_at?: string
          ends_at: string
          id?: string
          reason?: string | null
          staff_id?: string | null
          starts_at: string
          updated_at?: string
        }
        Update: {
          business_id?: string
          created_at?: string
          ends_at?: string
          id?: string
          reason?: string | null
          staff_id?: string | null
          starts_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "time_off_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_off_staff_id_business_id_fkey"
            columns: ["staff_id", "business_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id", "business_id"]
          },
        ]
      }
      working_hours: {
        Row: {
          business_id: string
          created_at: string
          end_time: string
          id: string
          staff_id: string
          start_time: string
          updated_at: string
          weekday: number
        }
        Insert: {
          business_id: string
          created_at?: string
          end_time: string
          id?: string
          staff_id: string
          start_time: string
          updated_at?: string
          weekday: number
        }
        Update: {
          business_id?: string
          created_at?: string
          end_time?: string
          id?: string
          staff_id?: string
          start_time?: string
          updated_at?: string
          weekday?: number
        }
        Relationships: [
          {
            foreignKeyName: "working_hours_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "working_hours_staff_id_business_id_fkey"
            columns: ["staff_id", "business_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id", "business_id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_create_appointment: {
        Args: {
          p_customer_name: string
          p_customer_note?: string
          p_customer_phone: string
          p_service_id: string
          p_staff_id: string
          p_starts_at: string
        }
        Returns: {
          business_id: string
          cancel_reason: string | null
          created_at: string
          created_by: string | null
          customer_name: string
          customer_note: string | null
          customer_phone: string
          ends_at: string
          id: string
          price_uzs: number
          service_id: string
          source: Database["public"]["Enums"]["appointment_source"]
          staff_id: string
          starts_at: string
          status: Database["public"]["Enums"]["appointment_status"]
          status_changed_at: string | null
          status_changed_by: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "appointments"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      count_bookings_outside_new_hours: {
        Args: { p_staff_id: string; p_week: Json }
        Returns: number
      }
      create_booking: {
        Args: {
          p_business_id: string
          p_customer_name: string
          p_customer_note: string
          p_customer_phone: string
          p_ip_hash: string
          p_service_id: string
          p_staff_id: string
          p_starts_at: string
        }
        Returns: Json
      }
      get_available_slots: {
        Args: {
          p_business_id: string
          p_date: string
          p_service_id: string
          p_staff_id: string
        }
        Returns: string[]
      }
      get_salon_hours: {
        Args: { p_business_id: string }
        Returns: {
          closes: string
          opens: string
          weekday: number
        }[]
      }
      list_orphan_salon_images: {
        Args: { p_older_than?: string }
        Returns: {
          created_at: string
          name: string
        }[]
      }
      replace_working_hours: {
        Args: { p_staff_id: string; p_week: Json }
        Returns: {
          business_id: string
          created_at: string
          end_time: string
          id: string
          staff_id: string
          start_time: string
          updated_at: string
          weekday: number
        }[]
        SetofOptions: {
          from: "*"
          to: "working_hours"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      set_appointment_status: {
        Args: {
          p_appointment_id: string
          p_cancel_reason?: string
          p_status: Database["public"]["Enums"]["appointment_status"]
        }
        Returns: {
          business_id: string
          cancel_reason: string | null
          created_at: string
          created_by: string | null
          customer_name: string
          customer_note: string | null
          customer_phone: string
          ends_at: string
          id: string
          price_uzs: number
          service_id: string
          source: Database["public"]["Enums"]["appointment_source"]
          staff_id: string
          starts_at: string
          status: Database["public"]["Enums"]["appointment_status"]
          status_changed_at: string | null
          status_changed_by: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "appointments"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      telegram_create_link_code: {
        Args: { p_business_id: string; p_code: string }
        Returns: string
      }
      telegram_link_chat: {
        Args: { p_chat_id: string; p_chat_title: string; p_code: string }
        Returns: string
      }
      telegram_unlink: { Args: { p_business_id: string }; Returns: undefined }
    }
    Enums: {
      appointment_source: "online" | "admin"
      appointment_status: "pending" | "confirmed" | "cancelled"
      member_role: "owner" | "staff"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      appointment_source: ["online", "admin"],
      appointment_status: ["pending", "confirmed", "cancelled"],
      member_role: ["owner", "staff"],
    },
  },
} as const
