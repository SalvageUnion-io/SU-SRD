import { supabase } from '../supabase'
import { handleSupabaseError } from '../errors'
import type { EntityRefRow, EntityRefInsert, EntityRefUpdate } from '../../types/common'

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

export async function deleteEntityRef(refId: string): Promise<void> {
  const { error } = await supabase.from('entity_refs').delete().eq('id', refId)

  if (error) handleSupabaseError(error)
}

export async function batchRepairEntityRefs(refIds: string[]): Promise<void> {
  if (refIds.length === 0) return
  const { error } = await supabase
    .from('entity_refs')
    .update({ condition: 'intact' as const })
    .in('id', refIds)
  if (error) handleSupabaseError(error)
}

export async function createEntityRef(input: EntityRefInsert): Promise<EntityRefRow> {
  const { data, error } = await supabase.from('entity_refs').insert(input).select().single()

  if (error) handleSupabaseError(error)
  return data!
}
