import { supabase } from '../supabase'
import { handleSupabaseError } from '../errors'
import { computeMechStatsFromRef, patternItemsToEntityRefs } from '../mechUtils'
import type {
  MechRow,
  MechUpdate,
  EntityRefRow,
  EntityRefInsert,
  InstantiateMechInput,
} from '../../types/common'

export async function instantiateMechFromPattern(
  userId: string,
  pilotId: string,
  input: InstantiateMechInput
): Promise<MechRow> {
  const stats = computeMechStatsFromRef(input.chassis_ref)
  if (!stats) throw new Error(`Chassis not found: ${input.chassis_ref}`)

  // Build entity refs using a placeholder parent_id — the RPC uses the newly created mech id
  const entityRefs = patternItemsToEntityRefs('placeholder', userId, input.pattern_items)

  const { data, error } = await supabase.rpc('instantiate_mech', {
    p_user_id: userId,
    p_pilot_id: pilotId,
    p_chassis_ref: input.chassis_ref,
    p_pattern_name: input.pattern_name ?? null,
    p_max_sp: stats.max_sp,
    p_max_ep: stats.max_ep,
    p_heat_capacity: stats.heat_capacity,
    p_cargo_capacity: stats.cargo_capacity,
    p_source_pattern_id: input.source_pattern_id ?? null,
    p_source_ref_pattern_id: input.source_ref_pattern_id ?? null,
    p_entity_refs: entityRefs,
  })

  if (error) handleSupabaseError(error)
  return data as unknown as MechRow
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
  const { data, error } = await supabase
    .from('mechs')
    .select(
      'id,active,cargo_capacity,chassis_ref,created_at,current_ep,current_heat,current_sp,heat_capacity,image_path,max_ep,max_sp,notes,pattern_name,source_pattern_id,source_ref_pattern_id,updated_at,user_id'
    )
    .eq('id', mechId)
    .single()

  if (error) handleSupabaseError(error)
  return data!
}

export async function getMechEntityRefs(mechId: string): Promise<EntityRefRow[]> {
  const { data, error } = await supabase
    .from('entity_refs')
    .select(
      'id,condition,created_at,metadata,parent_id,parent_type,schema_name,schema_ref_id,sort_order,updated_at,user_id'
    )
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
  const { error } = await supabase.rpc('update_mech_entity_refs', {
    p_mech_id: mechId,
    p_delete_ids: deleteIds,
    p_inserts: inserts,
  })

  if (error) handleSupabaseError(error)
}
