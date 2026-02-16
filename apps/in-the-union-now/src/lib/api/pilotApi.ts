import { PILOT_DEFAULTS } from 'salvageunion-reference'
import { supabase } from '../supabase'
import { handleSupabaseError } from '../errors'
import { abilityToEntityRef, equipmentToEntityRefs } from '../entityRefUtils'
import type { PilotRow, EntityRefRow, EntityRefUpdate, PilotUpdate } from '../../types/common'
import type { CreatePilotInput } from '../../types/common'

export async function listPilots(userId: string): Promise<PilotRow[]> {
  const { data, error } = await supabase
    .from('pilots')
    .select('*')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })

  if (error) handleSupabaseError(error)
  return data ?? []
}

export async function getPilotById(pilotId: string): Promise<PilotRow> {
  const { data, error } = await supabase.from('pilots').select('*').eq('id', pilotId).single()

  if (error) handleSupabaseError(error)
  return data!
}

export async function createPilot(userId: string, input: CreatePilotInput): Promise<PilotRow> {
  // 1. Insert the pilot row
  const { data: pilot, error: pilotError } = await supabase
    .from('pilots')
    .insert({
      user_id: userId,
      callsign: input.callsign,
      class_ref: input.class_ref,
      hp: PILOT_DEFAULTS.maxHP,
      max_hp: PILOT_DEFAULTS.maxHP,
      ap: PILOT_DEFAULTS.maxAP,
      max_ap: PILOT_DEFAULTS.maxAP,
      tp: PILOT_DEFAULTS.startingTP,
      background: input.background ?? null,
      motto: input.motto ?? null,
      keepsake: input.keepsake ?? null,
      appearance: input.appearance ?? null,
    })
    .select()
    .single()

  if (pilotError) handleSupabaseError(pilotError)

  // 2. Insert entity_refs for ability + equipment
  const entityRefs = [
    abilityToEntityRef(pilot!.id, userId, input.ability_ref),
    ...equipmentToEntityRefs(pilot!.id, userId, input.equipment_refs),
  ]

  if (entityRefs.length > 0) {
    const { error: refError } = await supabase.from('entity_refs').insert(entityRefs)
    if (refError) handleSupabaseError(refError)
  }

  return pilot!
}

export async function updatePilot(pilotId: string, input: PilotUpdate): Promise<PilotRow> {
  const { data, error } = await supabase
    .from('pilots')
    .update(input)
    .eq('id', pilotId)
    .select()
    .single()

  if (error) handleSupabaseError(error)
  return data!
}

export async function deletePilot(pilotId: string): Promise<void> {
  const { error } = await supabase.from('pilots').delete().eq('id', pilotId)
  if (error) handleSupabaseError(error)
}

export async function listAbilityCountsByPilotIds(
  pilotIds: string[]
): Promise<Record<string, number>> {
  if (pilotIds.length === 0) return {}
  const { data, error } = await supabase
    .from('entity_refs')
    .select('parent_id')
    .eq('parent_type', 'pilot')
    .eq('schema_name', 'abilities')
    .in('parent_id', pilotIds)

  if (error) handleSupabaseError(error)
  const counts: Record<string, number> = {}
  for (const ref of data ?? []) {
    counts[ref.parent_id] = (counts[ref.parent_id] ?? 0) + 1
  }
  return counts
}

export async function updateEntityRef(
  refId: string,
  input: EntityRefUpdate
): Promise<EntityRefRow> {
  const { data, error } = await supabase
    .from('entity_refs')
    .update(input)
    .eq('id', refId)
    .select()
    .single()

  if (error) handleSupabaseError(error)
  return data!
}

export async function getPilotEntityRefs(pilotId: string): Promise<EntityRefRow[]> {
  const { data, error } = await supabase
    .from('entity_refs')
    .select('*')
    .eq('parent_id', pilotId)
    .eq('parent_type', 'pilot')
    .order('sort_order', { ascending: true })

  if (error) handleSupabaseError(error)
  return data ?? []
}

export async function listPilotsByCrawlerId(crawlerId: string): Promise<PilotRow[]> {
  const { data, error } = await supabase
    .from('pilots')
    .select('*')
    .eq('crawler_id', crawlerId)
    .order('callsign', { ascending: true })

  if (error) handleSupabaseError(error)
  return data ?? []
}

export async function assignPilotToCrawler(
  pilotId: string,
  crawlerId: string | null
): Promise<PilotRow> {
  const { data, error } = await supabase
    .from('pilots')
    .update({ crawler_id: crawlerId })
    .eq('id', pilotId)
    .select()
    .single()

  if (error) handleSupabaseError(error)
  return data!
}
