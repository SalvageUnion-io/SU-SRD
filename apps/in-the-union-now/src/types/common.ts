// Enum types - canonical definitions in salvageunion-reference
export type { ParentType, ItemCondition } from 'salvageunion-reference'

// DB row types - derived from Supabase-generated types (never hand-written)
import type { Database } from './database-generated.types'

export type PilotRow = Database['public']['Tables']['pilots']['Row']
export type MechRow = Database['public']['Tables']['mechs']['Row']
export type CrawlerRow = Database['public']['Tables']['crawlers']['Row']
export type MechPatternRow = Database['public']['Tables']['mech_patterns']['Row']
export type EntityRefRow = Database['public']['Tables']['entity_refs']['Row']
export type PlayerChoiceRow = Database['public']['Tables']['player_choices']['Row']
export type CargoRow = Database['public']['Tables']['cargo']['Row']
export type CampaignRow = Database['public']['Tables']['campaigns']['Row']
export type CampaignMemberRow = Database['public']['Tables']['campaign_members']['Row']
export type ChangeLogRow = Database['public']['Tables']['change_log']['Row']

// Insert types (for create operations)
export type MechPatternInsert = Database['public']['Tables']['mech_patterns']['Insert']
export type PilotInsert = Database['public']['Tables']['pilots']['Insert']
export type MechInsert = Database['public']['Tables']['mechs']['Insert']
export type CrawlerInsert = Database['public']['Tables']['crawlers']['Insert']
export type EntityRefInsert = Database['public']['Tables']['entity_refs']['Insert']
export type PlayerChoiceInsert = Database['public']['Tables']['player_choices']['Insert']
export type CargoInsert = Database['public']['Tables']['cargo']['Insert']

// Update types (for edit operations)
export type MechPatternUpdate = Database['public']['Tables']['mech_patterns']['Update']
export type PilotUpdate = Database['public']['Tables']['pilots']['Update']
export type MechUpdate = Database['public']['Tables']['mechs']['Update']
export type CrawlerUpdate = Database['public']['Tables']['crawlers']['Update']
export type EntityRefUpdate = Database['public']['Tables']['entity_refs']['Update']

// Typed update handler - constrains field names and value types
export type EntityUpdateHandler<T> = <K extends keyof T>(field: K, value: T[K]) => void

// Pattern builder types
export type PatternItem = {
  schema_name: 'systems' | 'modules'
  schema_ref_id: string
  sort_order: number
}

export type CreatePatternInput = {
  name: string
  chassis_ref: string
  description?: string
  visible?: boolean
  pattern_items: PatternItem[]
}

export type UpdatePatternInput = Partial<CreatePatternInput>

export type TypedPatternRow = Omit<MechPatternRow, 'pattern_items'> & {
  pattern_items: PatternItem[]
}
