export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: '14.1'
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
            foreignKeyName: 'campaign_members_campaign_id_fkey'
            columns: ['campaign_id']
            isOneToOne: false
            referencedRelation: 'campaigns'
            referencedColumns: ['id']
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
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'campaigns_crawler_id_fkey'
            columns: ['crawler_id']
            isOneToOne: false
            referencedRelation: 'crawlers'
            referencedColumns: ['id']
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
          parent_type: Database['public']['Enums']['parent_type']
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
          parent_type: Database['public']['Enums']['parent_type']
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
          parent_type?: Database['public']['Enums']['parent_type']
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
          id?: string
          new_value?: Json | null
          old_value?: Json | null
          reversible?: boolean
          session_id?: string | null
          target_id?: string
          target_type?: string
          user_id?: string
        }
        Relationships: []
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
      entity_refs: {
        Row: {
          condition: Database['public']['Enums']['item_condition']
          created_at: string
          id: string
          metadata: Json | null
          parent_id: string
          parent_type: Database['public']['Enums']['parent_type']
          schema_name: string
          schema_ref_id: string
          sort_order: number
          updated_at: string
          user_id: string
        }
        Insert: {
          condition?: Database['public']['Enums']['item_condition']
          created_at?: string
          id?: string
          metadata?: Json | null
          parent_id: string
          parent_type: Database['public']['Enums']['parent_type']
          schema_name: string
          schema_ref_id: string
          sort_order?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          condition?: Database['public']['Enums']['item_condition']
          created_at?: string
          id?: string
          metadata?: Json | null
          parent_id?: string
          parent_type?: Database['public']['Enums']['parent_type']
          schema_name?: string
          schema_ref_id?: string
          sort_order?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
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
            foreignKeyName: 'mechs_source_pattern_id_fkey'
            columns: ['source_pattern_id']
            isOneToOne: false
            referencedRelation: 'mech_patterns'
            referencedColumns: ['id']
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
            foreignKeyName: 'pilots_crawler_id_fkey'
            columns: ['crawler_id']
            isOneToOne: false
            referencedRelation: 'crawlers'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'pilots_mech_id_fkey'
            columns: ['mech_id']
            isOneToOne: true
            referencedRelation: 'mechs'
            referencedColumns: ['id']
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
          parent_type: Database['public']['Enums']['parent_type'] | null
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
          parent_type?: Database['public']['Enums']['parent_type'] | null
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
          parent_type?: Database['public']['Enums']['parent_type'] | null
          roll_value?: number | null
          selected_value?: string | null
          selected_values?: Json | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'player_choices_entity_ref_id_fkey'
            columns: ['entity_ref_id']
            isOneToOne: false
            referencedRelation: 'entity_refs'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'player_choices_parent_choice_id_fkey'
            columns: ['parent_choice_id']
            isOneToOne: false
            referencedRelation: 'player_choices'
            referencedColumns: ['id']
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      is_campaign_mediator: {
        Args: { campaign_uuid: string }
        Returns: boolean
      }
      is_campaign_member: { Args: { campaign_uuid: string }; Returns: boolean }
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
    }
    Enums: {
      item_condition: 'intact' | 'damaged' | 'destroyed'
      parent_type: 'pilot' | 'mech' | 'crawler'
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, 'public'>]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] & DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema['Tables']
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema['Tables']
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema['Enums']
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema['CompositeTypes']
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      item_condition: ['intact', 'damaged', 'destroyed'],
      parent_type: ['pilot', 'mech', 'crawler'],
    },
  },
} as const
