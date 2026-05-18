import { PILOT_DEFAULTS } from 'salvageunion-reference'
import { supabase } from '../supabase'
import { handleSupabaseError } from '../errors'
import { abilityToEntityRef, equipmentToEntityRefs } from '../entityRefUtils'
import { PilotRowSchema, EntityRefRowSchema } from '../validation'
import { parseDatabaseResult, parseDatabaseResultArray } from './parseDatabaseResult'
import type { PilotRow, EntityRefRow, PilotUpdate } from '../../types/common'
import type { CreatePilotInput } from '../../types/common'

export async function listPilots(userId: string): Promise<PilotRow[]> {
  const { data, error } = await supabase
    .from('pilots')
    .select(
      'id,active,ap,appearance,background,background_used,callsign,class_ref,crawler_id,created_at,hp,image_path,in_downtime,injuries,is_boarded,keepsake,keepsake_used,max_ap,max_hp,mech_id,motto,motto_used,notes,tp,updated_at,user_id,visible'
    )
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })

  if (error) handleSupabaseError(error)
  return parseDatabaseResultArray(data, PilotRowSchema, 'listPilots')
}

export async function getPilotById(pilotId: string): Promise<PilotRow> {
  const { data, error } = await supabase
    .from('pilots')
    .select(
      'id,active,ap,appearance,background,background_used,callsign,class_ref,crawler_id,created_at,hp,image_path,in_downtime,injuries,is_boarded,keepsake,keepsake_used,max_ap,max_hp,mech_id,motto,motto_used,notes,tp,updated_at,user_id,visible'
    )
    .eq('id', pilotId)
    .single()

  if (error) handleSupabaseError(error)
  return parseDatabaseResult(data, PilotRowSchema, 'getPilotById')
}

export async function createPilot(userId: string, input: CreatePilotInput): Promise<PilotRow> {
  // Build entity refs array for the RPC (using a placeholder parent_id — the RPC uses the newly created pilot id)
  const entityRefs = [
    abilityToEntityRef('placeholder', userId, input.ability_ref),
    ...equipmentToEntityRefs('placeholder', userId, input.equipment_refs),
  ]

  const { data, error } = await supabase.rpc('create_pilot', {
    p_user_id: userId,
    p_callsign: input.callsign,
    p_class_ref: input.class_ref,
    p_hp: PILOT_DEFAULTS.maxHP,
    p_max_hp: PILOT_DEFAULTS.maxHP,
    p_ap: PILOT_DEFAULTS.maxAP,
    p_max_ap: PILOT_DEFAULTS.maxAP,
    p_tp: PILOT_DEFAULTS.startingTP,
    p_background: input.background ?? undefined,
    p_motto: input.motto ?? undefined,
    p_keepsake: input.keepsake ?? undefined,
    p_appearance: input.appearance ?? undefined,
    p_entity_refs: entityRefs,
  })

  if (error) handleSupabaseError(error)
  return parseDatabaseResult(data, PilotRowSchema, 'createPilot')
}

export async function updatePilot(pilotId: string, input: PilotUpdate): Promise<PilotRow> {
  const { data, error } = await supabase
    .from('pilots')
    .update(input)
    .eq('id', pilotId)
    .select()
    .single()

  if (error) handleSupabaseError(error)
  return parseDatabaseResult(data, PilotRowSchema, 'updatePilot')
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

export async function getPilotEntityRefs(pilotId: string): Promise<EntityRefRow[]> {
  const { data, error } = await supabase
    .from('entity_refs')
    .select(
      'id,condition,created_at,metadata,parent_id,parent_type,schema_name,schema_ref_id,sort_order,updated_at,user_id'
    )
    .eq('parent_id', pilotId)
    .eq('parent_type', 'pilot')
    .order('sort_order', { ascending: true })

  if (error) handleSupabaseError(error)
  return parseDatabaseResultArray(data, EntityRefRowSchema, 'getPilotEntityRefs')
}

export async function listPilotsByCrawlerId(crawlerId: string): Promise<PilotRow[]> {
  const { data, error } = await supabase
    .from('pilots')
    .select(
      'id,active,ap,appearance,background,background_used,callsign,class_ref,crawler_id,created_at,hp,image_path,in_downtime,injuries,is_boarded,keepsake,keepsake_used,max_ap,max_hp,mech_id,motto,motto_used,notes,tp,updated_at,user_id,visible'
    )
    .eq('crawler_id', crawlerId)
    .order('callsign', { ascending: true })

  if (error) handleSupabaseError(error)
  return parseDatabaseResultArray(data, PilotRowSchema, 'listPilotsByCrawlerId')
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
  return parseDatabaseResult(data, PilotRowSchema, 'assignPilotToCrawler')
}
