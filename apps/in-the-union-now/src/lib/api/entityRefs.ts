import { supabase } from '../supabase'
import { createEntityRefSchema, updateEntityRefSchema } from '../validation'
import type { UpdateEntityRefInput } from '../validation'
import type { EntityRef, ParentType } from '../../types/common'
import type { Json } from '../../types/database-generated.types'

export async function fetchEntityRefs(
  parentType: ParentType,
  parentId: string
): Promise<EntityRef[]> {
  const { data, error } = await supabase
    .from('entity_refs')
    .select('*')
    .eq('parent_type', parentType)
    .eq('parent_id', parentId)
    .order('sort_order', { ascending: true })

  if (error) throw error
  return data ?? []
}

export async function createEntityRef(
  input: {
    parent_type: ParentType
    parent_id: string
    schema_name: string
    schema_ref_id: string
    condition?: 'intact' | 'damaged' | 'destroyed'
    parent_entity_ref_id?: string | null
    sort_order?: number
    metadata?: Record<string, Json>
  },
  userId: string
): Promise<EntityRef> {
  const validated = createEntityRefSchema.parse(input)
  const { data, error } = await supabase
    .from('entity_refs')
    .insert({ ...validated, user_id: userId })
    .select()
    .single()

  if (error) throw error
  return data
}

export async function updateEntityRef(id: string, input: UpdateEntityRefInput): Promise<EntityRef> {
  const validated = updateEntityRefSchema.parse(input)
  const { data, error } = await supabase
    .from('entity_refs')
    .update(validated)
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data
}

export async function deleteEntityRef(id: string): Promise<void> {
  const { error } = await supabase.from('entity_refs').delete().eq('id', id)
  if (error) throw error
}

export async function reorderEntityRefs(
  updates: Array<{ id: string; sort_order: number }>
): Promise<void> {
  const promises = updates.map(({ id, sort_order }) =>
    supabase.from('entity_refs').update({ sort_order }).eq('id', id)
  )

  const results = await Promise.all(promises)
  const firstError = results.find((r) => r.error)
  if (firstError?.error) throw firstError.error
}
