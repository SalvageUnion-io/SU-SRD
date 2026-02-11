import { supabase } from '../supabase'
import { createCargoSchema, updateCargoSchema } from '../validation'
import type { UpdateCargoInput } from '../validation'
import type { Cargo, ParentType } from '../../types/common'
import type { Json } from '../../types/database-generated.types'

export async function fetchCargo(parentType: ParentType, parentId: string): Promise<Cargo[]> {
  const { data, error } = await supabase
    .from('cargo')
    .select('*')
    .eq('parent_type', parentType)
    .eq('parent_id', parentId)
    .order('created_at', { ascending: true })

  if (error) throw error
  return data ?? []
}

export async function createCargoItem(
  input: {
    parent_type: 'mech' | 'crawler'
    parent_id: string
    name?: string | null
    schema_name?: string | null
    schema_ref_id?: string | null
    amount?: number
    metadata?: Record<string, Json>
  },
  userId: string
): Promise<Cargo> {
  const validated = createCargoSchema.parse(input)
  const { data, error } = await supabase
    .from('cargo')
    .insert({ ...validated, user_id: userId })
    .select()
    .single()

  if (error) throw error
  return data
}

export async function updateCargoItem(id: string, input: UpdateCargoInput): Promise<Cargo> {
  const validated = updateCargoSchema.parse(input)
  const { data, error } = await supabase
    .from('cargo')
    .update(validated)
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data
}

export async function deleteCargoItem(id: string): Promise<void> {
  const { error } = await supabase.from('cargo').delete().eq('id', id)
  if (error) throw error
}
