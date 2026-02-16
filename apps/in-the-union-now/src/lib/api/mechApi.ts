import { supabase } from '../supabase'
import { handleSupabaseError } from '../errors'
import { computeMechStatsFromRef, patternItemsToEntityRefs } from '../mechUtils'
import type { MechRow, EntityRefRow, EntityRefInsert } from '../../types/common'
import type { InstantiateMechInput } from '../../types/common'

export async function instantiateMechFromPattern(
  userId: string,
  pilotId: string,
  input: InstantiateMechInput
): Promise<MechRow> {
  const stats = computeMechStatsFromRef(input.chassis_ref)
  if (!stats) throw new Error(`Chassis not found: ${input.chassis_ref}`)

  // 1. Insert the mech
  const { data: mech, error: mechError } = await supabase
    .from('mechs')
    .insert({
      user_id: userId,
      chassis_ref: input.chassis_ref,
      pattern_name: input.pattern_name ?? null,
      max_sp: stats.max_sp,
      current_sp: stats.max_sp,
      max_ep: stats.max_ep,
      current_ep: stats.max_ep,
      heat_capacity: stats.heat_capacity,
      current_heat: 0,
      cargo_capacity: stats.cargo_capacity,
    })
    .select()
    .single()

  if (mechError) handleSupabaseError(mechError)

  // 2. Insert entity_refs for systems + modules
  const entityRefs = patternItemsToEntityRefs(mech!.id, userId, input.pattern_items)
  if (entityRefs.length > 0) {
    const { error: refError } = await supabase.from('entity_refs').insert(entityRefs)
    if (refError) handleSupabaseError(refError)
  }

  // 3. Link mech to pilot
  const { error: linkError } = await supabase
    .from('pilots')
    .update({ mech_id: mech!.id })
    .eq('id', pilotId)

  if (linkError) handleSupabaseError(linkError)

  return mech!
}

export async function getMechById(mechId: string): Promise<MechRow> {
  const { data, error } = await supabase.from('mechs').select('*').eq('id', mechId).single()

  if (error) handleSupabaseError(error)
  return data!
}

export async function getMechEntityRefs(mechId: string): Promise<EntityRefRow[]> {
  const { data, error } = await supabase
    .from('entity_refs')
    .select('*')
    .eq('parent_id', mechId)
    .eq('parent_type', 'mech')
    .order('sort_order', { ascending: true })

  if (error) handleSupabaseError(error)
  return data ?? []
}

export async function updateMechEntityRefs(
  mechId: string,
  _userId: string,
  inserts: EntityRefInsert[],
  deleteIds: string[]
): Promise<void> {
  // Delete removed refs
  if (deleteIds.length > 0) {
    const { error: delError } = await supabase
      .from('entity_refs')
      .delete()
      .in('id', deleteIds)
      .eq('parent_id', mechId)

    if (delError) handleSupabaseError(delError)
  }

  // Insert new refs
  if (inserts.length > 0) {
    const { error: insError } = await supabase.from('entity_refs').insert(inserts)
    if (insError) handleSupabaseError(insError)
  }
}
