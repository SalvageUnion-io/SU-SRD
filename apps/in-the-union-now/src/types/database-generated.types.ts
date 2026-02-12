export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: '14.1'
  }
  public: {
    Tables: {
      cargo: {
        Row: {
          amount: number
          created_at: string
          id: string
          metadata: Json
          name: string | null
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
          metadata?: Json
          name?: string | null
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
          metadata?: Json
          name?: string | null
          parent_id?: string
          parent_type?: Database['public']['Enums']['parent_type']
          schema_name?: string | null
          schema_ref_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      crawlers: {
        Row: {
          active: boolean
          crawler_ref: string | null
          created_at: string
          current_damage: number
          description: string
          id: string
          image_url: string | null
          max_sp: number
          name: string
          notes: string
          private: boolean
          scrap_tl1: number
          scrap_tl2: number
          scrap_tl3: number
          scrap_tl4: number
          scrap_tl5: number
          scrap_tl6: number
          tech_level: number
          updated_at: string
          upgrade_level: number
          upkeep: number
          user_id: string
        }
        Insert: {
          active?: boolean
          crawler_ref?: string | null
          created_at?: string
          current_damage?: number
          description?: string
          id?: string
          image_url?: string | null
          max_sp?: number
          name?: string
          notes?: string
          private?: boolean
          scrap_tl1?: number
          scrap_tl2?: number
          scrap_tl3?: number
          scrap_tl4?: number
          scrap_tl5?: number
          scrap_tl6?: number
          tech_level?: number
          updated_at?: string
          upgrade_level?: number
          upkeep?: number
          user_id: string
        }
        Update: {
          active?: boolean
          crawler_ref?: string | null
          created_at?: string
          current_damage?: number
          description?: string
          id?: string
          image_url?: string | null
          max_sp?: number
          name?: string
          notes?: string
          private?: boolean
          scrap_tl1?: number
          scrap_tl2?: number
          scrap_tl3?: number
          scrap_tl4?: number
          scrap_tl5?: number
          scrap_tl6?: number
          tech_level?: number
          updated_at?: string
          upgrade_level?: number
          upkeep?: number
          user_id?: string
        }
        Relationships: []
      }
      entity_refs: {
        Row: {
          condition: Database['public']['Enums']['item_condition']
          created_at: string
          id: string
          metadata: Json
          parent_entity_ref_id: string | null
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
          metadata?: Json
          parent_entity_ref_id?: string | null
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
          metadata?: Json
          parent_entity_ref_id?: string | null
          parent_id?: string
          parent_type?: Database['public']['Enums']['parent_type']
          schema_name?: string
          schema_ref_id?: string
          sort_order?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'entity_refs_parent_entity_ref_id_fkey'
            columns: ['parent_entity_ref_id']
            isOneToOne: false
            referencedRelation: 'entity_refs'
            referencedColumns: ['id']
          },
        ]
      }
      mechs: {
        Row: {
          active: boolean
          appearance: string
          chassis_ref: string | null
          created_at: string
          current_ep: number
          current_heat: number
          current_sp: number
          heat_capacity: number
          id: string
          image_url: string | null
          max_ep: number
          max_sp: number
          name: string
          notes: string
          pattern_name: string | null
          pilot_id: string | null
          private: boolean
          quirk: string
          updated_at: string
          user_id: string
        }
        Insert: {
          active?: boolean
          appearance?: string
          chassis_ref?: string | null
          created_at?: string
          current_ep?: number
          current_heat?: number
          current_sp?: number
          heat_capacity?: number
          id?: string
          image_url?: string | null
          max_ep?: number
          max_sp?: number
          name?: string
          notes?: string
          pattern_name?: string | null
          pilot_id?: string | null
          private?: boolean
          quirk?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          active?: boolean
          appearance?: string
          chassis_ref?: string | null
          created_at?: string
          current_ep?: number
          current_heat?: number
          current_sp?: number
          heat_capacity?: number
          id?: string
          image_url?: string | null
          max_ep?: number
          max_sp?: number
          name?: string
          notes?: string
          pattern_name?: string | null
          pilot_id?: string | null
          private?: boolean
          quirk?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'mechs_pilot_id_fkey'
            columns: ['pilot_id']
            isOneToOne: false
            referencedRelation: 'pilots'
            referencedColumns: ['id']
          },
        ]
      }
      pilots: {
        Row: {
          active: boolean
          advanced_class_ref: string | null
          appearance: string
          background: string
          background_used: boolean
          callsign: string
          class_ref: string | null
          crawler_id: string | null
          created_at: string
          current_ap: number
          current_hp: number
          current_tp: number
          id: string
          image_url: string | null
          keepsake: string
          keepsake_used: boolean
          max_ap: number
          max_hp: number
          motto: string
          motto_used: boolean
          notes: string
          private: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          active?: boolean
          advanced_class_ref?: string | null
          appearance?: string
          background?: string
          background_used?: boolean
          callsign?: string
          class_ref?: string | null
          crawler_id?: string | null
          created_at?: string
          current_ap?: number
          current_hp?: number
          current_tp?: number
          id?: string
          image_url?: string | null
          keepsake?: string
          keepsake_used?: boolean
          max_ap?: number
          max_hp?: number
          motto?: string
          motto_used?: boolean
          notes?: string
          private?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          active?: boolean
          advanced_class_ref?: string | null
          appearance?: string
          background?: string
          background_used?: boolean
          callsign?: string
          class_ref?: string | null
          crawler_id?: string | null
          created_at?: string
          current_ap?: number
          current_hp?: number
          current_tp?: number
          id?: string
          image_url?: string | null
          keepsake?: string
          keepsake_used?: boolean
          max_ap?: number
          max_hp?: number
          motto?: string
          motto_used?: boolean
          notes?: string
          private?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'pilots_crawler_id_fkey'
            columns: ['crawler_id']
            isOneToOne: false
            referencedRelation: 'crawlers'
            referencedColumns: ['id']
          },
        ]
      }
      player_choices: {
        Row: {
          choice_ref_id: string
          created_at: string
          entity_ref_id: string | null
          id: string
          parent_choice_id: string | null
          updated_at: string
          user_id: string
          value: string
        }
        Insert: {
          choice_ref_id: string
          created_at?: string
          entity_ref_id?: string | null
          id?: string
          parent_choice_id?: string | null
          updated_at?: string
          user_id: string
          value: string
        }
        Update: {
          choice_ref_id?: string
          created_at?: string
          entity_ref_id?: string | null
          id?: string
          parent_choice_id?: string | null
          updated_at?: string
          user_id?: string
          value?: string
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
      [_ in never]: never
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
