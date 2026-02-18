// Enum types - canonical definitions in salvageunion-reference
export type { ParentType, ItemCondition } from 'salvageunion-reference'

// DB row types - derived from Supabase-generated types (never hand-written)
import type { Database } from './database-generated.types'

export type PilotRow = Database['public']['Tables']['pilots']['Row']
export type MechRow = Database['public']['Tables']['mechs']['Row']
export type CrawlerRow = Database['public']['Tables']['crawlers']['Row']
export type MechPatternRow = Database['public']['Tables']['mech_patterns']['Row']
export type EntityRefRow = Database['public']['Tables']['entity_refs']['Row']
export type CargoRow = Database['public']['Tables']['cargo']['Row']
export type CampaignRow = Database['public']['Tables']['campaigns']['Row']
export type CampaignMemberRow = Database['public']['Tables']['campaign_members']['Row']

// Insert types (for create operations)
export type MechPatternInsert = Database['public']['Tables']['mech_patterns']['Insert']
export type PilotInsert = Database['public']['Tables']['pilots']['Insert']
export type MechInsert = Database['public']['Tables']['mechs']['Insert']
export type CrawlerInsert = Database['public']['Tables']['crawlers']['Insert']
export type EntityRefInsert = Database['public']['Tables']['entity_refs']['Insert']

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

// Pilot creation input (from wizard → API)
export type CreatePilotInput = {
  callsign: string
  class_ref: string
  ability_ref: { schema_name: 'abilities'; schema_ref_id: string }
  equipment_refs: { schema_name: string; schema_ref_id: string }[]
  background?: string
  motto?: string
  keepsake?: string
  appearance?: string
}

// Mech instantiation input (from pattern → live mech)
export type InstantiateMechInput = {
  chassis_ref: string
  pattern_name?: string
  pattern_items: PatternItem[]
  source_pattern_id?: string
  source_ref_pattern_id?: string
}

// Discriminated union for pattern selection (reference vs player)
export type SelectedPattern =
  | { source: 'reference'; pattern: import('salvageunion-reference').SURefObjectPattern; refPatternId: string }
  | { source: 'player'; pattern: TypedPatternRow }

// Campaign insert/update types
export type CampaignInsert = Database['public']['Tables']['campaigns']['Insert']
export type CampaignUpdate = Database['public']['Tables']['campaigns']['Update']
// Bay NPC data for crawler JSONB field
export type BayNpcData = {
  name?: string
  description?: string
  motto?: string
  keepsake?: string
  personality?: string
  damaged?: boolean
  hp?: number
}

// Crawler creation input (from wizard → API)
export type CreateCrawlerInput = {
  crawler_ref: string
  name?: string
  tag?: string
  /** @deprecated Use weapon_refs for multi-weapon support */
  weapon_ref?: { schema_name: 'systems'; schema_ref_id: string }
  weapon_refs?: { schema_name: 'systems'; schema_ref_id: string }[]
  bay_npcs?: Record<string, BayNpcData>
}
