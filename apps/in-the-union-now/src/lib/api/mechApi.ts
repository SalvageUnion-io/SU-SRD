import { supabase } from '../supabase'
import { handleSupabaseError } from '../errors'
import { computeMechStatsFromRef, patternItemsToEntityRefs } from '../mechUtils'
import type {
  CargoRow,
  MechRow,
  MechUpdate,
  EntityRefRow,
  EntityRefInsert,
  InstantiateMechInput,
} from '../../types/common'
import type { Json } from '../../types/database-generated.types'

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
      source_pattern_id: input.source_pattern_id ?? null,
      source_ref_pattern_id: input.source_ref_pattern_id ?? null,
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

export async function updateMech(mechId: string, input: MechUpdate): Promise<MechRow> {
  const { data, error } = await supabase
    .from('mechs')
    .update(input)
    .eq('id', mechId)
    .select()
    .single()

  if (error) handleSupabaseError(error)
  return data!
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

// --- Cargo CRUD ---

export async function listCargoForMech(mechId: string): Promise<CargoRow[]> {
  const { data, error } = await supabase
    .from('cargo')
    .select('*')
    .eq('parent_id', mechId)
    .eq('parent_type', 'mech')
    .order('created_at', { ascending: true })

  if (error) handleSupabaseError(error)
  return data ?? []
}

export async function addCargoToMech(
  mechId: string,
  userId: string,
  input: {
    name: string
    amount?: number
    schema_name?: string
    schema_ref_id?: string
    metadata?: Record<string, unknown>
  }
): Promise<CargoRow> {
  const { data, error } = await supabase
    .from('cargo')
    .insert({
      parent_id: mechId,
      parent_type: 'mech' as const,
      user_id: userId,
      name: input.name,
      amount: input.amount ?? 1,
      schema_name: input.schema_name ?? null,
      schema_ref_id: input.schema_ref_id ?? null,
      metadata: (input.metadata as Record<string, Json | undefined>) ?? null,
    })
    .select()
    .single()

  if (error) handleSupabaseError(error)
  return data!
}

export async function deleteMechCargoItem(cargoId: string): Promise<void> {
  const { error } = await supabase.from('cargo').delete().eq('id', cargoId)
  if (error) handleSupabaseError(error)
}
