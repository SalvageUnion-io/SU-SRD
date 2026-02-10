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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      cargo: {
        Row: {
          amount: number | null
          crawler_id: string | null
          created_at: string
          id: string
          mech_id: string | null
          metadata: Json | null
          name: string
          schema_name: string | null
          schema_ref_id: string | null
          updated_at: string
        }
        Insert: {
          amount?: number | null
          crawler_id?: string | null
          created_at?: string
          id?: string
          mech_id?: string | null
          metadata?: Json | null
          name: string
          schema_name?: string | null
          schema_ref_id?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number | null
          crawler_id?: string | null
          created_at?: string
          id?: string
          mech_id?: string | null
          metadata?: Json | null
          name?: string
          schema_name?: string | null
          schema_ref_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cargo_crawler_id_fkey"
            columns: ["crawler_id"]
            isOneToOne: false
            referencedRelation: "crawlers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cargo_mech_id_fkey"
            columns: ["mech_id"]
            isOneToOne: false
            referencedRelation: "mechs"
            referencedColumns: ["id"]
          },
        ]
      }
      crawlers: {
        Row: {
          active: boolean
          created_at: string | null
          current_damage: number | null
          description: string | null
          game_id: string | null
          id: string
          name: string
          notes: string | null
          npc: Json | null
          private: boolean
          scrap_tl_five: number | null
          scrap_tl_four: number | null
          scrap_tl_one: number | null
          scrap_tl_six: number | null
          scrap_tl_three: number | null
          scrap_tl_two: number | null
          tech_level: number | null
          updated_at: string | null
          upgrade: number | null
          user_id: string
        }
        Insert: {
          active?: boolean
          created_at?: string | null
          current_damage?: number | null
          description?: string | null
          game_id?: string | null
          id?: string
          name: string
          notes?: string | null
          npc?: Json | null
          private?: boolean
          scrap_tl_five?: number | null
          scrap_tl_four?: number | null
          scrap_tl_one?: number | null
          scrap_tl_six?: number | null
          scrap_tl_three?: number | null
          scrap_tl_two?: number | null
          tech_level?: number | null
          updated_at?: string | null
          upgrade?: number | null
          user_id: string
        }
        Update: {
          active?: boolean
          created_at?: string | null
          current_damage?: number | null
          description?: string | null
          game_id?: string | null
          id?: string
          name?: string
          notes?: string | null
          npc?: Json | null
          private?: boolean
          scrap_tl_five?: number | null
          scrap_tl_four?: number | null
          scrap_tl_one?: number | null
          scrap_tl_six?: number | null
          scrap_tl_three?: number | null
          scrap_tl_two?: number | null
          tech_level?: number | null
          updated_at?: string | null
          upgrade?: number | null
          user_id?: string
        }
        Relationships: []
      }
      external_links: {
        Row: {
          created_at: string | null
          game_id: string
          id: string
          name: string
          updated_at: string | null
          url: string
        }
        Insert: {
          created_at?: string | null
          game_id: string
          id?: string
          name: string
          updated_at?: string | null
          url: string
        }
        Update: {
          created_at?: string | null
          game_id?: string
          id?: string
          name?: string
          updated_at?: string | null
          url?: string
        }
        Relationships: []
      }
      game_invites: {
        Row: {
          code: string
          created_at: string | null
          created_by: string
          expires_at: string | null
          game_id: string
          id: string
          max_uses: number | null
          uses: number | null
        }
        Insert: {
          code: string
          created_at?: string | null
          created_by: string
          expires_at?: string | null
          game_id: string
          id?: string
          max_uses?: number | null
          uses?: number | null
        }
        Update: {
          code?: string
          created_at?: string | null
          created_by?: string
          expires_at?: string | null
          game_id?: string
          id?: string
          max_uses?: number | null
          uses?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "game_invites_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
        ]
      }
      game_members: {
        Row: {
          game_id: string
          id: string
          joined_at: string | null
          role: string
          user_id: string
        }
        Insert: {
          game_id: string
          id?: string
          joined_at?: string | null
          role: string
          user_id: string
        }
        Update: {
          game_id?: string
          id?: string
          joined_at?: string | null
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "game_members_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
        ]
      }
      games: {
        Row: {
          active: boolean
          created_at: string | null
          created_by: string
          description: string | null
          id: string
          name: string
          private: boolean
          updated_at: string | null
        }
        Insert: {
          active?: boolean
          created_at?: string | null
          created_by: string
          description?: string | null
          id?: string
          name: string
          private?: boolean
          updated_at?: string | null
        }
        Update: {
          active?: boolean
          created_at?: string | null
          created_by?: string
          description?: string | null
          id?: string
          name?: string
          private?: boolean
          updated_at?: string | null
        }
        Relationships: []
      }
      mechs: {
        Row: {
          active: boolean
          appearance: string | null
          created_at: string | null
          current_damage: number | null
          current_ep: number | null
          current_heat: number | null
          id: string
          image_url: string | null
          modules: string[] | null
          notes: string | null
          pattern: string | null
          pilot_id: string | null
          private: boolean
          quirk: string | null
          systems: string[] | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          active?: boolean
          appearance?: string | null
          created_at?: string | null
          current_damage?: number | null
          current_ep?: number | null
          current_heat?: number | null
          id?: string
          image_url?: string | null
          modules?: string[] | null
          notes?: string | null
          pattern?: string | null
          pilot_id?: string | null
          private?: boolean
          quirk?: string | null
          systems?: string[] | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          active?: boolean
          appearance?: string | null
          created_at?: string | null
          current_damage?: number | null
          current_ep?: number | null
          current_heat?: number | null
          id?: string
          image_url?: string | null
          modules?: string[] | null
          notes?: string | null
          pattern?: string | null
          pilot_id?: string | null
          private?: boolean
          quirk?: string | null
          systems?: string[] | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mechs_pilot_id_fkey"
            columns: ["pilot_id"]
            isOneToOne: false
            referencedRelation: "pilots"
            referencedColumns: ["id"]
          },
        ]
      }
      pilots: {
        Row: {
          abilities: string[] | null
          active: boolean
          appearance: string | null
          background: string | null
          background_used: boolean | null
          callsign: string
          crawler_id: string | null
          created_at: string | null
          current_ap: number | null
          current_damage: number | null
          current_tp: number | null
          equipment: string[] | null
          id: string
          image_url: string | null
          keepsake: string | null
          keepsake_used: boolean | null
          max_ap: number | null
          max_hp: number | null
          motto: string | null
          motto_used: boolean | null
          notes: string | null
          private: boolean
          updated_at: string | null
          user_id: string
        }
        Insert: {
          abilities?: string[] | null
          active?: boolean
          appearance?: string | null
          background?: string | null
          background_used?: boolean | null
          callsign: string
          crawler_id?: string | null
          created_at?: string | null
          current_ap?: number | null
          current_damage?: number | null
          current_tp?: number | null
          equipment?: string[] | null
          id?: string
          image_url?: string | null
          keepsake?: string | null
          keepsake_used?: boolean | null
          max_ap?: number | null
          max_hp?: number | null
          motto?: string | null
          motto_used?: boolean | null
          notes?: string | null
          private?: boolean
          updated_at?: string | null
          user_id: string
        }
        Update: {
          abilities?: string[] | null
          active?: boolean
          appearance?: string | null
          background?: string | null
          background_used?: boolean | null
          callsign?: string
          crawler_id?: string | null
          created_at?: string | null
          current_ap?: number | null
          current_damage?: number | null
          current_tp?: number | null
          equipment?: string[] | null
          id?: string
          image_url?: string | null
          keepsake?: string | null
          keepsake_used?: boolean | null
          max_ap?: number | null
          max_hp?: number | null
          motto?: string | null
          motto_used?: boolean | null
          notes?: string | null
          private?: boolean
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pilots_crawler_id_fkey"
            columns: ["crawler_id"]
            isOneToOne: false
            referencedRelation: "crawlers"
            referencedColumns: ["id"]
          },
        ]
      }
      player_choices: {
        Row: {
          choice_ref_id: string
          created_at: string
          entity_id: string | null
          id: string
          player_choice_id: string | null
          updated_at: string
          value: string
        }
        Insert: {
          choice_ref_id: string
          created_at?: string
          entity_id?: string | null
          id?: string
          player_choice_id?: string | null
          updated_at?: string
          value: string
        }
        Update: {
          choice_ref_id?: string
          created_at?: string
          entity_id?: string | null
          id?: string
          player_choice_id?: string | null
          updated_at?: string
          value?: string
        }
        Relationships: [
          {
            foreignKeyName: "player_choices_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "suentities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_choices_player_choice_id_fkey"
            columns: ["player_choice_id"]
            isOneToOne: false
            referencedRelation: "player_choices"
            referencedColumns: ["id"]
          },
        ]
      }
      suentities: {
        Row: {
          crawler_id: string | null
          created_at: string
          id: string
          mech_id: string | null
          metadata: Json | null
          parent_entity_id: string | null
          pilot_id: string | null
          schema_name: string
          schema_ref_id: string
          updated_at: string
        }
        Insert: {
          crawler_id?: string | null
          created_at?: string
          id?: string
          mech_id?: string | null
          metadata?: Json | null
          parent_entity_id?: string | null
          pilot_id?: string | null
          schema_name: string
          schema_ref_id: string
          updated_at?: string
        }
        Update: {
          crawler_id?: string | null
          created_at?: string
          id?: string
          mech_id?: string | null
          metadata?: Json | null
          parent_entity_id?: string | null
          pilot_id?: string | null
          schema_name?: string
          schema_ref_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "entities_crawler_id_fkey"
            columns: ["crawler_id"]
            isOneToOne: false
            referencedRelation: "crawlers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entities_mech_id_fkey"
            columns: ["mech_id"]
            isOneToOne: false
            referencedRelation: "mechs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entities_pilot_id_fkey"
            columns: ["pilot_id"]
            isOneToOne: false
            referencedRelation: "pilots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "suentities_parent_entity_id_fkey"
            columns: ["parent_entity_id"]
            isOneToOne: false
            referencedRelation: "suentities"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      create_game_invite: {
        Args: { p_expires_at?: string; p_game_id: string; p_max_uses?: number }
        Returns: {
          code: string
          created_at: string | null
          created_by: string
          expires_at: string | null
          game_id: string
          id: string
          max_uses: number | null
          uses: number | null
        }
        SetofOptions: {
          from: "*"
          to: "game_invites"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      expire_invite: { Args: { p_invite_id: string }; Returns: undefined }
      generate_invite_code: { Args: never; Returns: string }
      get_game_members: {
        Args: { p_game_id: string }
        Returns: {
          id: string
          role: string
          user_email: string
          user_id: string
          user_name: string
        }[]
      }
      get_user_display_name: { Args: { p_user_id: string }; Returns: string }
      is_game_mediator: {
        Args: { game_uuid: string; user_uuid: string }
        Returns: boolean
      }
      is_game_member: {
        Args: { game_uuid: string; user_uuid: string }
        Returns: boolean
      }
      redeem_invite_code: { Args: { invite_code: string }; Returns: string }
      test_auth_uid: {
        Args: never
        Returns: {
          jwt_role: string
          jwt_sub: string
          uid: string
        }[]
      }
      user_owns_choice: {
        Args: { choice_id: string; user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
