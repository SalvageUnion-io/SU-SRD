import type { Tables, TablesInsert, TablesUpdate } from './database-generated.types'

// Row types (what comes back from queries)
export type Pilot = Tables<'pilots'>
export type Mech = Tables<'mechs'>
export type Crawler = Tables<'crawlers'>
export type EntityRef = Tables<'entity_refs'>
export type PlayerChoice = Tables<'player_choices'>
export type Cargo = Tables<'cargo'>

// Insert types
export type PilotInsert = TablesInsert<'pilots'>
export type MechInsert = TablesInsert<'mechs'>
export type CrawlerInsert = TablesInsert<'crawlers'>
export type EntityRefInsert = TablesInsert<'entity_refs'>
export type PlayerChoiceInsert = TablesInsert<'player_choices'>
export type CargoInsert = TablesInsert<'cargo'>

// Update types
export type PilotUpdate = TablesUpdate<'pilots'>
export type MechUpdate = TablesUpdate<'mechs'>
export type CrawlerUpdate = TablesUpdate<'crawlers'>
export type EntityRefUpdate = TablesUpdate<'entity_refs'>
export type PlayerChoiceUpdate = TablesUpdate<'player_choices'>
export type CargoUpdate = TablesUpdate<'cargo'>

// Enum types
export type ParentType = 'pilot' | 'mech' | 'crawler'
export type ItemCondition = 'intact' | 'damaged' | 'destroyed'

// Roster view - pilot with active mech preview
export type PilotWithActiveMech = Pilot & {
  active_mech: Mech | null
}
