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
    PostgrestVersion: "14.1"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      campaign_members: {
        Row: {
          campaign_id: string
          id: string
          joined_at: string
          role: string
          user_id: string
        }
        Insert: {
          campaign_id: string
          id?: string
          joined_at?: string
          role?: string
          user_id: string
        }
        Update: {
          campaign_id?: string
          id?: string
          joined_at?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_members_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      campaigns: {
        Row: {
          archived: boolean
          crawler_id: string | null
          created_at: string
          created_by: string
          id: string
          invite_code: string | null
          name: string
          session_state: Json | null
          updated_at: string
        }
        Insert: {
          archived?: boolean
          crawler_id?: string | null
          created_at?: string
          created_by: string
          id?: string
          invite_code?: string | null
          name: string
          session_state?: Json | null
          updated_at?: string
        }
        Update: {
          archived?: boolean
          crawler_id?: string | null
          created_at?: string
          created_by?: string
          id?: string
          invite_code?: string | null
          name?: string
          session_state?: Json | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaigns_crawler_id_fkey"
            columns: ["crawler_id"]
            isOneToOne: false
            referencedRelation: "crawlers"
            referencedColumns: ["id"]
          },
        ]
      }
      cargo: {
        Row: {
          amount: number
          created_at: string
          id: string
          metadata: Json | null
          name: string
          parent_id: string
          parent_type: Database["public"]["Enums"]["parent_type"]
          schema_name: string | null
          schema_ref_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          amount?: number
          created_at?: string
          id?: string
          metadata?: Json | null
          name: string
          parent_id: string
          parent_type: Database["public"]["Enums"]["parent_type"]
          schema_name?: string | null
          schema_ref_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          metadata?: Json | null
          name?: string
          parent_id?: string
          parent_type?: Database["public"]["Enums"]["parent_type"]
          schema_name?: string | null
          schema_ref_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      change_log: {
        Row: {
          action: string
          created_at: string
          description: string | null
          field: string | null
          game_id: string | null
          id: string
          new_value: Json | null
          old_value: Json | null
          reversible: boolean
          session_id: string | null
          target_id: string
          target_type: string
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string
          description?: string | null
          field?: string | null
          game_id?: string | null
          id?: string
          new_value?: Json | null
          old_value?: Json | null
          reversible?: boolean
          session_id?: string | null
          target_id: string
          target_type: string
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          description?: string | null
          field?: string | null
          game_id?: string | null
          id?: string
          new_value?: Json | null
          old_value?: Json | null
          reversible?: boolean
          session_id?: string | null
          target_id?: string
          target_type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "change_log_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      crawlers: {
        Row: {
          active: boolean
          bay_npcs: Json
          crawler_ref: string
          created_at: string
          current_sp: number
          id: string
          max_sp: number
          name: string | null
          notes: string | null
          scrap_tl1: number
          scrap_tl2: number
          scrap_tl3: number
          scrap_tl4: number
          scrap_tl5: number
          scrap_tl6: number
          tag: string | null
          tech_level: number
          updated_at: string
          upgrade_pool: number
          upkeep: number
          user_id: string
          visible: boolean
        }
        Insert: {
          active?: boolean
          bay_npcs?: Json
          crawler_ref: string
          created_at?: string
          current_sp?: number
          id?: string
          max_sp?: number
          name?: string | null
          notes?: string | null
          scrap_tl1?: number
          scrap_tl2?: number
          scrap_tl3?: number
          scrap_tl4?: number
          scrap_tl5?: number
          scrap_tl6?: number
          tag?: string | null
          tech_level?: number
          updated_at?: string
          upgrade_pool?: number
          upkeep?: number
          user_id: string
          visible?: boolean
        }
        Update: {
          active?: boolean
          bay_npcs?: Json
          crawler_ref?: string
          created_at?: string
          current_sp?: number
          id?: string
          max_sp?: number
          name?: string | null
          notes?: string | null
          scrap_tl1?: number
          scrap_tl2?: number
          scrap_tl3?: number
          scrap_tl4?: number
          scrap_tl5?: number
          scrap_tl6?: number
          tag?: string | null
          tech_level?: number
          updated_at?: string
          upgrade_pool?: number
          upkeep?: number
          user_id?: string
          visible?: boolean
        }
        Relationships: []
      }
      downtime_records: {
        Row: {
          closed_at: string | null
          craft_receipts: Json | null
          crawler_id: string
          created_at: string
          customise_acknowledged: Json | null
          deterioration_pending: Json | null
          equipment_receipts: Json | null
          id: string
          offload_receipts: Json
          pre_session_started: boolean
          restore_receipts: Json
          rumour_receipts: Json | null
          trade_result: Json | null
          trade_roll_key: string | null
          trade_roll_value: number | null
          training_receipts: Json | null
          upkeep_paid: boolean
          upkeep_result: Json | null
          user_id: string
        }
        Insert: {
          closed_at?: string | null
          craft_receipts?: Json | null
          crawler_id: string
          created_at?: string
          customise_acknowledged?: Json | null
          deterioration_pending?: Json | null
          equipment_receipts?: Json | null
          id?: string
          offload_receipts?: Json
          pre_session_started?: boolean
          restore_receipts?: Json
          rumour_receipts?: Json | null
          trade_result?: Json | null
          trade_roll_key?: string | null
          trade_roll_value?: number | null
          training_receipts?: Json | null
          upkeep_paid?: boolean
          upkeep_result?: Json | null
          user_id: string
        }
        Update: {
          closed_at?: string | null
          craft_receipts?: Json | null
          crawler_id?: string
          created_at?: string
          customise_acknowledged?: Json | null
          deterioration_pending?: Json | null
          equipment_receipts?: Json | null
          id?: string
          offload_receipts?: Json
          pre_session_started?: boolean
          restore_receipts?: Json
          rumour_receipts?: Json | null
          trade_result?: Json | null
          trade_roll_key?: string | null
          trade_roll_value?: number | null
          training_receipts?: Json | null
          upkeep_paid?: boolean
          upkeep_result?: Json | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "downtime_records_crawler_id_fkey"
            columns: ["crawler_id"]
            isOneToOne: false
            referencedRelation: "crawlers"
            referencedColumns: ["id"]
          },
        ]
      }
      entity_refs: {
        Row: {
          condition: Database["public"]["Enums"]["item_condition"]
          created_at: string
          id: string
          metadata: Json | null
          parent_id: string
          parent_type: Database["public"]["Enums"]["parent_type"]
          schema_name: string
          schema_ref_id: string
          sort_order: number
          updated_at: string
          user_id: string
        }
        Insert: {
          condition?: Database["public"]["Enums"]["item_condition"]
          created_at?: string
          id?: string
          metadata?: Json | null
          parent_id: string
          parent_type: Database["public"]["Enums"]["parent_type"]
          schema_name: string
          schema_ref_id: string
          sort_order?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          condition?: Database["public"]["Enums"]["item_condition"]
          created_at?: string
          id?: string
          metadata?: Json | null
          parent_id?: string
          parent_type?: Database["public"]["Enums"]["parent_type"]
          schema_name?: string
          schema_ref_id?: string
          sort_order?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      map_layers: {
        Row: {
          background_url: string | null
          campaign_id: string
          connections: Json
          created_at: string
          id: string
          label: string | null
          parent_zone_id: string | null
          tier: string
          updated_at: string
          user_id: string
          zones: Json
        }
        Insert: {
          background_url?: string | null
          campaign_id: string
          connections?: Json
          created_at?: string
          id?: string
          label?: string | null
          parent_zone_id?: string | null
          tier: string
          updated_at?: string
          user_id: string
          zones?: Json
        }
        Update: {
          background_url?: string | null
          campaign_id?: string
          connections?: Json
          created_at?: string
          id?: string
          label?: string | null
          parent_zone_id?: string | null
          tier?: string
          updated_at?: string
          user_id?: string
          zones?: Json
        }
        Relationships: [
          {
            foreignKeyName: "map_layers_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      mech_patterns: {
        Row: {
          chassis_ref: string
          created_at: string
          description: string | null
          id: string
          image_path: string | null
          name: string
          pattern_items: Json
          updated_at: string
          user_id: string
          visible: boolean
        }
        Insert: {
          chassis_ref: string
          created_at?: string
          description?: string | null
          id?: string
          image_path?: string | null
          name: string
          pattern_items?: Json
          updated_at?: string
          user_id: string
          visible?: boolean
        }
        Update: {
          chassis_ref?: string
          created_at?: string
          description?: string | null
          id?: string
          image_path?: string | null
          name?: string
          pattern_items?: Json
          updated_at?: string
          user_id?: string
          visible?: boolean
        }
        Relationships: []
      }
      mechs: {
        Row: {
          active: boolean
          cargo_capacity: number
          chassis_ref: string
          created_at: string
          current_ep: number
          current_heat: number
          current_sp: number
          heat_capacity: number
          id: string
          image_path: string | null
          max_ep: number
          max_sp: number
          notes: string | null
          pattern_name: string | null
          source_pattern_id: string | null
          source_ref_pattern_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          active?: boolean
          cargo_capacity?: number
          chassis_ref: string
          created_at?: string
          current_ep?: number
          current_heat?: number
          current_sp?: number
          heat_capacity?: number
          id?: string
          image_path?: string | null
          max_ep?: number
          max_sp?: number
          notes?: string | null
          pattern_name?: string | null
          source_pattern_id?: string | null
          source_ref_pattern_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          active?: boolean
          cargo_capacity?: number
          chassis_ref?: string
          created_at?: string
          current_ep?: number
          current_heat?: number
          current_sp?: number
          heat_capacity?: number
          id?: string
          image_path?: string | null
          max_ep?: number
          max_sp?: number
          notes?: string | null
          pattern_name?: string | null
          source_pattern_id?: string | null
          source_ref_pattern_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mechs_source_pattern_id_fkey"
            columns: ["source_pattern_id"]
            isOneToOne: false
            referencedRelation: "mech_patterns"
            referencedColumns: ["id"]
          },
        ]
      }
      pilots: {
        Row: {
          active: boolean
          ap: number
          appearance: string | null
          background: string | null
          background_used: boolean | null
          callsign: string
          class_ref: string
          crawler_id: string | null
          created_at: string
          hp: number
          id: string
          image_path: string | null
          in_downtime: boolean
          is_boarded: boolean
          keepsake: string | null
          keepsake_used: boolean | null
          max_ap: number
          max_hp: number
          mech_id: string | null
          motto: string | null
          motto_used: boolean | null
          notes: string | null
          tp: number
          updated_at: string
          user_id: string
          visible: boolean
        }
        Insert: {
          active?: boolean
          ap?: number
          appearance?: string | null
          background?: string | null
          background_used?: boolean | null
          callsign: string
          class_ref: string
          crawler_id?: string | null
          created_at?: string
          hp?: number
          id?: string
          image_path?: string | null
          in_downtime?: boolean
          is_boarded?: boolean
          keepsake?: string | null
          keepsake_used?: boolean | null
          max_ap?: number
          max_hp?: number
          mech_id?: string | null
          motto?: string | null
          motto_used?: boolean | null
          notes?: string | null
          tp?: number
          updated_at?: string
          user_id: string
          visible?: boolean
        }
        Update: {
          active?: boolean
          ap?: number
          appearance?: string | null
          background?: string | null
          background_used?: boolean | null
          callsign?: string
          class_ref?: string
          crawler_id?: string | null
          created_at?: string
          hp?: number
          id?: string
          image_path?: string | null
          in_downtime?: boolean
          is_boarded?: boolean
          keepsake?: string | null
          keepsake_used?: boolean | null
          max_ap?: number
          max_hp?: number
          mech_id?: string | null
          motto?: string | null
          motto_used?: boolean | null
          notes?: string | null
          tp?: number
          updated_at?: string
          user_id?: string
          visible?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "pilots_crawler_id_fkey"
            columns: ["crawler_id"]
            isOneToOne: false
            referencedRelation: "crawlers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pilots_mech_id_fkey"
            columns: ["mech_id"]
            isOneToOne: true
            referencedRelation: "mechs"
            referencedColumns: ["id"]
          },
        ]
      }
      player_choices: {
        Row: {
          choice_id: string
          choice_type: string
          created_at: string
          entity_ref_id: string | null
          guide_step_id: string | null
          id: string
          parent_choice_id: string | null
          parent_id: string | null
          parent_type: Database["public"]["Enums"]["parent_type"] | null
          roll_value: number | null
          selected_value: string | null
          selected_values: Json | null
          updated_at: string
          user_id: string
        }
        Insert: {
          choice_id: string
          choice_type?: string
          created_at?: string
          entity_ref_id?: string | null
          guide_step_id?: string | null
          id?: string
          parent_choice_id?: string | null
          parent_id?: string | null
          parent_type?: Database["public"]["Enums"]["parent_type"] | null
          roll_value?: number | null
          selected_value?: string | null
          selected_values?: Json | null
          updated_at?: string
          user_id: string
        }
        Update: {
          choice_id?: string
          choice_type?: string
          created_at?: string
          entity_ref_id?: string | null
          guide_step_id?: string | null
          id?: string
          parent_choice_id?: string | null
          parent_id?: string | null
          parent_type?: Database["public"]["Enums"]["parent_type"] | null
          roll_value?: number | null
          selected_value?: string | null
          selected_values?: Json | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "player_choices_entity_ref_id_fkey"
            columns: ["entity_ref_id"]
            isOneToOne: false
            referencedRelation: "entity_refs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_choices_parent_choice_id_fkey"
            columns: ["parent_choice_id"]
            isOneToOne: false
            referencedRelation: "player_choices"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      atomic_pay_upkeep: {
        Args: {
          p_crawler_id: string
          p_record_id: string
          p_scrap_deductions: Json
          p_upgrade_pool_increase: number
          p_upkeep_result: Json
        }
        Returns: Json
      }
      create_crawler: {
        Args: {
          p_bay_npcs?: Json
          p_crawler_ref: string
          p_game_id: string
          p_max_sp?: number
          p_name?: string
          p_tag?: string
          p_upkeep?: number
          p_user_id: string
          p_weapon_refs?: Json
        }
        Returns: Json
      }
      create_game: {
        Args: { p_invite_code: string; p_name: string; p_user_id: string }
        Returns: Json
      }
      create_pilot: {
        Args: {
          p_ap: number
          p_appearance?: string
          p_background?: string
          p_callsign: string
          p_class_ref: string
          p_entity_refs?: Json
          p_hp: number
          p_keepsake?: string
          p_max_ap: number
          p_max_hp: number
          p_motto?: string
          p_tp: number
          p_user_id: string
        }
        Returns: Json
      }
      get_mediator_campaign_ids: { Args: never; Returns: string[] }
      get_user_campaign_ids: { Args: never; Returns: string[] }
      get_user_crawler_ids: { Args: never; Returns: string[] }
      instantiate_mech: {
        Args: {
          p_cargo_capacity?: number
          p_chassis_ref: string
          p_entity_refs?: Json
          p_heat_capacity?: number
          p_max_ep?: number
          p_max_sp?: number
          p_pattern_name?: string
          p_pilot_id: string
          p_source_pattern_id?: string
          p_source_ref_pattern_id?: string
          p_user_id: string
        }
        Returns: Json
      }
      is_campaign_mediator: {
        Args: { campaign_uuid: string }
        Returns: boolean
      }
      is_campaign_member: { Args: { campaign_uuid: string }; Returns: boolean }
      join_game: {
        Args: { p_invite_code: string; p_user_id: string }
        Returns: Json
      }
      merge_downtime_receipt: {
        Args: {
          p_field: string
          p_pilot_id: string
          p_receipt: Json
          p_record_id: string
        }
        Returns: Json
      }
      offload_mech_cargo: {
        Args: {
          p_crawler_id: string
          p_mech_id: string
          p_scrap_additions: Json
          p_storage_cargo_ids: string[]
        }
        Returns: undefined
      }
      shares_crawler: { Args: { target_crawler_id: string }; Returns: boolean }
      translate_scrap: {
        Args: {
          p_crawler_id: string
          p_from_field: string
          p_source_consumed: number
          p_target_amount: number
          p_to_field: string
        }
        Returns: undefined
      }
      update_crawler_weapon: {
        Args: {
          p_crawler_id: string
          p_new_schema_name?: string
          p_new_schema_ref_id?: string
          p_old_ref_id?: string
          p_sort_order?: number
          p_user_id: string
        }
        Returns: undefined
      }
      update_mech_entity_refs: {
        Args: { p_delete_ids?: string[]; p_inserts?: Json; p_mech_id: string }
        Returns: undefined
      }
    }
    Enums: {
      item_condition: "intact" | "damaged" | "destroyed"
      parent_type: "pilot" | "mech" | "crawler"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      item_condition: ["intact", "damaged", "destroyed"],
      parent_type: ["pilot", "mech", "crawler"],
    },
  },
} as const
