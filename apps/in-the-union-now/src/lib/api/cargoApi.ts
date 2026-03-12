import { supabase } from '../supabase'
import { handleSupabaseError } from '../errors'
import type { CargoRow } from '../../types/common'
import type { Json } from '../../types/database-generated.types'

export type CargoParentType = 'mech' | 'crawler'

export type CargoInput = {
  name: string
  amount?: number
  schema_name?: string
  schema_ref_id?: string
  metadata?: Record<string, unknown>
}

export async function listCargo(
  parentId: string,
  parentType: CargoParentType
): Promise<CargoRow[]> {
  const { data, error } = await supabase
    .from('cargo')
    .select('*')
    .eq('parent_id', parentId)
    .eq('parent_type', parentType)
    .order('created_at', { ascending: true })

  if (error) handleSupabaseError(error)
  return data ?? []
}

export async function addCargo(
  parentId: string,
  parentType: CargoParentType,
  userId: string,
  input: CargoInput
): Promise<CargoRow> {
  const { data, error } = await supabase
    .from('cargo')
    .insert({
      parent_id: parentId,
      parent_type: parentType,
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

export async function deleteCargo(cargoId: string): Promise<void> {
  const { error } = await supabase.from('cargo').delete().eq('id', cargoId)
  if (error) handleSupabaseError(error)
}

export async function offloadMechCargo(
  mechId: string,
  crawlerId: string,
  storageCargoIds: string[],
  scrapAdditions: Record<string, number>
): Promise<void> {
  const { error } = await supabase.rpc('offload_mech_cargo', {
    p_mech_id: mechId,
    p_crawler_id: crawlerId,
    p_storage_cargo_ids: storageCargoIds,
    p_scrap_additions: scrapAdditions,
  })
  if (error) handleSupabaseError(error)
}
