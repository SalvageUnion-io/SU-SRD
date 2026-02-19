import { supabase } from '../supabase'
import { handleSupabaseError } from '../errors'
import type { EntityRefRow, EntityRefUpdate } from '../../types/common'

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
