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
      accounts: {
        Row: {
          category: Database["public"]["Enums"]["account_category"]
          created_at: string
          created_by: string
          household_id: string
          id: string
          include_in_net_worth: boolean
          institution: string | null
          is_active: boolean
          member_id: string | null
          name: string
          ownership: Database["public"]["Enums"]["ownership_type"]
        }
        Insert: {
          category: Database["public"]["Enums"]["account_category"]
          created_at?: string
          created_by?: string
          household_id: string
          id?: string
          include_in_net_worth?: boolean
          institution?: string | null
          is_active?: boolean
          member_id?: string | null
          name: string
          ownership?: Database["public"]["Enums"]["ownership_type"]
        }
        Update: {
          category?: Database["public"]["Enums"]["account_category"]
          created_at?: string
          created_by?: string
          household_id?: string
          id?: string
          include_in_net_worth?: boolean
          institution?: string | null
          is_active?: boolean
          member_id?: string | null
          name?: string
          ownership?: Database["public"]["Enums"]["ownership_type"]
        }
        Relationships: [
          {
            foreignKeyName: "accounts_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounts_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "household_members"
            referencedColumns: ["id"]
          },
        ]
      }
      budgets: {
        Row: {
          budget_type: Database["public"]["Enums"]["budget_type"]
          created_at: string
          created_by: string
          daily_limit: number
          end_date: string | null
          household_id: string
          id: string
          is_active: boolean
          member_id: string | null
          name: string
          period: Database["public"]["Enums"]["budget_period"]
          start_date: string
        }
        Insert: {
          budget_type: Database["public"]["Enums"]["budget_type"]
          created_at?: string
          created_by?: string
          daily_limit: number
          end_date?: string | null
          household_id: string
          id?: string
          is_active?: boolean
          member_id?: string | null
          name: string
          period?: Database["public"]["Enums"]["budget_period"]
          start_date?: string
        }
        Update: {
          budget_type?: Database["public"]["Enums"]["budget_type"]
          created_at?: string
          created_by?: string
          daily_limit?: number
          end_date?: string | null
          household_id?: string
          id?: string
          is_active?: boolean
          member_id?: string | null
          name?: string
          period?: Database["public"]["Enums"]["budget_period"]
          start_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "budgets_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budgets_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "household_members"
            referencedColumns: ["id"]
          },
        ]
      }
      connected_accounts: {
        Row: {
          account_id: string | null
          available_balance: number | null
          created_at: string
          currency: string | null
          current_balance: number | null
          external_account_id: string | null
          household_id: string
          id: string
          institution_id: string
          last_synced_at: string | null
          mask: string | null
          name: string
          subtype: string | null
          type: string | null
        }
        Insert: {
          account_id?: string | null
          available_balance?: number | null
          created_at?: string
          currency?: string | null
          current_balance?: number | null
          external_account_id?: string | null
          household_id: string
          id?: string
          institution_id: string
          last_synced_at?: string | null
          mask?: string | null
          name: string
          subtype?: string | null
          type?: string | null
        }
        Update: {
          account_id?: string | null
          available_balance?: number | null
          created_at?: string
          currency?: string | null
          current_balance?: number | null
          external_account_id?: string | null
          household_id?: string
          id?: string
          institution_id?: string
          last_synced_at?: string | null
          mask?: string | null
          name?: string
          subtype?: string | null
          type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "connected_accounts_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "connected_accounts_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "connected_institutions"
            referencedColumns: ["id"]
          },
        ]
      }
      connected_institutions: {
        Row: {
          access_token_ref: string | null
          created_at: string
          created_by: string
          household_id: string
          id: string
          institution_id: string | null
          institution_name: string
          last_synced_at: string | null
          provider: string
          status: string
        }
        Insert: {
          access_token_ref?: string | null
          created_at?: string
          created_by?: string
          household_id: string
          id?: string
          institution_id?: string | null
          institution_name: string
          last_synced_at?: string | null
          provider?: string
          status?: string
        }
        Update: {
          access_token_ref?: string | null
          created_at?: string
          created_by?: string
          household_id?: string
          id?: string
          institution_id?: string | null
          institution_name?: string
          last_synced_at?: string | null
          provider?: string
          status?: string
        }
        Relationships: []
      }
      household_goals: {
        Row: {
          created_at: string
          created_by: string
          household_id: string
          id: string
          label: string
          target: number
          type: string
        }
        Insert: {
          created_at?: string
          created_by?: string
          household_id: string
          id?: string
          label: string
          target: number
          type: string
        }
        Update: {
          created_at?: string
          created_by?: string
          household_id?: string
          id?: string
          label?: string
          target?: number
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "household_goals_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      household_invites: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          access_level: string
          created_at: string
          expires_at: string
          household_id: string
          id: string
          invite_code: string | null
          invite_token: string
          invited_by: string
          invited_email: string | null
          role: Database["public"]["Enums"]["member_role"]
          status: Database["public"]["Enums"]["invite_status"]
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          access_level?: string
          created_at?: string
          expires_at?: string
          household_id: string
          id?: string
          invite_code?: string | null
          invite_token?: string
          invited_by?: string
          invited_email?: string | null
          role?: Database["public"]["Enums"]["member_role"]
          status?: Database["public"]["Enums"]["invite_status"]
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          access_level?: string
          created_at?: string
          expires_at?: string
          household_id?: string
          id?: string
          invite_code?: string | null
          invite_token?: string
          invited_by?: string
          invited_email?: string | null
          role?: Database["public"]["Enums"]["member_role"]
          status?: Database["public"]["Enums"]["invite_status"]
        }
        Relationships: []
      }
      household_members: {
        Row: {
          access_level: string
          color: string | null
          created_at: string
          created_by: string
          household_id: string
          id: string
          invited_by: string | null
          name: string
          relationship: string | null
          role: Database["public"]["Enums"]["member_role"]
          user_id: string | null
        }
        Insert: {
          access_level?: string
          color?: string | null
          created_at?: string
          created_by?: string
          household_id: string
          id?: string
          invited_by?: string | null
          name: string
          relationship?: string | null
          role?: Database["public"]["Enums"]["member_role"]
          user_id?: string | null
        }
        Update: {
          access_level?: string
          color?: string | null
          created_at?: string
          created_by?: string
          household_id?: string
          id?: string
          invited_by?: string | null
          name?: string
          relationship?: string | null
          role?: Database["public"]["Enums"]["member_role"]
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "household_members_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      households: {
        Row: {
          created_at: string
          created_by: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          currency: string | null
          date_format: string | null
          display_name: string | null
          id: string
          theme: string | null
          user_timezone: string | null
          week_start: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          currency?: string | null
          date_format?: string | null
          display_name?: string | null
          id: string
          theme?: string | null
          user_timezone?: string | null
          week_start?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          currency?: string | null
          date_format?: string | null
          display_name?: string | null
          id?: string
          theme?: string | null
          user_timezone?: string | null
          week_start?: string | null
        }
        Relationships: []
      }
      spending_entries: {
        Row: {
          amount: number
          category: Database["public"]["Enums"]["spending_category"]
          created_at: string
          created_by: string
          household_id: string
          id: string
          member_id: string | null
          notes: string | null
          payment_method: string | null
          spent_at: string
          spent_local_date: string | null
          user_timezone: string | null
        }
        Insert: {
          amount: number
          category?: Database["public"]["Enums"]["spending_category"]
          created_at?: string
          created_by?: string
          household_id: string
          id?: string
          member_id?: string | null
          notes?: string | null
          payment_method?: string | null
          spent_at?: string
          spent_local_date?: string | null
          user_timezone?: string | null
        }
        Update: {
          amount?: number
          category?: Database["public"]["Enums"]["spending_category"]
          created_at?: string
          created_by?: string
          household_id?: string
          id?: string
          member_id?: string | null
          notes?: string | null
          payment_method?: string | null
          spent_at?: string
          spent_local_date?: string | null
          user_timezone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "spending_entries_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "spending_entries_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "household_members"
            referencedColumns: ["id"]
          },
        ]
      }
      support_messages: {
        Row: {
          created_at: string
          email: string | null
          id: string
          message: string
          status: string
          subject: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: string
          message: string
          status?: string
          subject: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          message?: string
          status?: string
          subject?: string
          user_id?: string | null
        }
        Relationships: []
      }
      transaction_categories: {
        Row: {
          category_type: Database["public"]["Enums"]["txn_category_type"]
          color: string | null
          created_at: string
          created_by: string
          household_id: string
          icon: string | null
          id: string
          is_active: boolean
          name: string
        }
        Insert: {
          category_type?: Database["public"]["Enums"]["txn_category_type"]
          color?: string | null
          created_at?: string
          created_by?: string
          household_id: string
          icon?: string | null
          id?: string
          is_active?: boolean
          name: string
        }
        Update: {
          category_type?: Database["public"]["Enums"]["txn_category_type"]
          color?: string | null
          created_at?: string
          created_by?: string
          household_id?: string
          icon?: string | null
          id?: string
          is_active?: boolean
          name?: string
        }
        Relationships: []
      }
      weekly_snapshots: {
        Row: {
          account_id: string
          balance: number
          contribution: number | null
          created_at: string
          created_by: string
          household_id: string
          id: string
          notes: string | null
          payment: number | null
          week_ending: string
        }
        Insert: {
          account_id: string
          balance?: number
          contribution?: number | null
          created_at?: string
          created_by?: string
          household_id: string
          id?: string
          notes?: string | null
          payment?: number | null
          week_ending: string
        }
        Update: {
          account_id?: string
          balance?: number
          contribution?: number | null
          created_at?: string
          created_by?: string
          household_id?: string
          id?: string
          notes?: string | null
          payment?: number | null
          week_ending?: string
        }
        Relationships: [
          {
            foreignKeyName: "weekly_snapshots_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "weekly_snapshots_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_household_invite: {
        Args: { _name: string; _token: string }
        Returns: string
      }
      admin_get_users: {
        Args: never
        Returns: {
          email: string
          last_active_at: string
          signed_up_at: string
          user_id: string
        }[]
      }
      admin_user_summary: {
        Args: never
        Returns: {
          email: string
          household_id: string
          household_name: string
          last_active_at: string
          member_count: number
          member_names: string
          signed_up_at: string
          user_id: string
        }[]
      }
      get_invite_preview: {
        Args: { _token: string }
        Returns: {
          access_level: string
          created_by: string
          expires_at: string
          household_id: string
          household_name: string
          status: string
        }[]
      }
      is_admin: { Args: never; Returns: boolean }
      is_household_member: { Args: { _household_id: string }; Returns: boolean }
      is_household_owner: { Args: { _household_id: string }; Returns: boolean }
    }
    Enums: {
      account_category:
        | "checking"
        | "savings"
        | "credit_card"
        | "retirement_401k"
        | "brokerage"
        | "ira"
        | "car_loan"
        | "mortgage"
        | "student_loan"
        | "personal_loan"
        | "other_asset"
        | "other_liability"
      budget_period: "daily" | "weekly" | "monthly"
      budget_type: "individual" | "combined"
      invite_status: "pending" | "accepted" | "revoked" | "expired"
      member_role: "owner" | "admin" | "member"
      ownership_type: "individual" | "joint"
      spending_category:
        | "food"
        | "coffee_snacks"
        | "groceries"
        | "gas_transportation"
        | "shopping"
        | "entertainment"
        | "bills"
        | "travel"
        | "other"
      txn_category_type: "expense" | "income"
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
      account_category: [
        "checking",
        "savings",
        "credit_card",
        "retirement_401k",
        "brokerage",
        "ira",
        "car_loan",
        "mortgage",
        "student_loan",
        "personal_loan",
        "other_asset",
        "other_liability",
      ],
      budget_period: ["daily", "weekly", "monthly"],
      budget_type: ["individual", "combined"],
      invite_status: ["pending", "accepted", "revoked", "expired"],
      member_role: ["owner", "admin", "member"],
      ownership_type: ["individual", "joint"],
      spending_category: [
        "food",
        "coffee_snacks",
        "groceries",
        "gas_transportation",
        "shopping",
        "entertainment",
        "bills",
        "travel",
        "other",
      ],
      txn_category_type: ["expense", "income"],
    },
  },
} as const
