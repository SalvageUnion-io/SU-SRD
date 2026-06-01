import { supabase } from '../supabase'
import { handleSupabaseError } from '../errors'
import type { CreatePatternInput, TypedPatternRow, UpdatePatternInput } from '../../types/common'

export async function listPatterns(userId: string): Promise<TypedPatternRow[]> {
  const { data, error } = await supabase
    .from('mech_patterns')
    .select(
      'id,chassis_ref,created_at,description,image_path,name,pattern_items,updated_at,user_id,visible'
    )
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })

  if (error) handleSupabaseError(error)
  return (data ?? []) as TypedPatternRow[]
}

export async function getPatternById(patternId: string): Promise<TypedPatternRow> {
  const { data, error } = await supabase
    .from('mech_patterns')
    .select(
      'id,chassis_ref,created_at,description,image_path,name,pattern_items,updated_at,user_id,visible'
    )
    .eq('id', patternId)
    .single()

  if (error) handleSupabaseError(error)
  return data as TypedPatternRow
}

export async function createPattern(
  userId: string,
  input: CreatePatternInput
): Promise<TypedPatternRow> {
  const { data, error } = await supabase
    .from('mech_patterns')
    .insert({
      user_id: userId,
      name: input.name,
      chassis_ref: input.chassis_ref,
      description: input.description ?? null,
      visible: input.visible ?? true,
      pattern_items: JSON.parse(JSON.stringify(input.pattern_items)),
    })
    .select()
    .single()

  if (error) handleSupabaseError(error)
  return data as TypedPatternRow
}

export async function updatePattern(
  patternId: string,
  input: UpdatePatternInput
): Promise<TypedPatternRow> {
  const update: Record<string, unknown> = {}
  if (input.name !== undefined) update.name = input.name
  if (input.chassis_ref !== undefined) update.chassis_ref = input.chassis_ref
  if (input.description !== undefined) update.description = input.description ?? null
  if (input.visible !== undefined) update.visible = input.visible
  if (input.pattern_items !== undefined)
    update.pattern_items = JSON.parse(JSON.stringify(input.pattern_items))

  const { data, error } = await supabase
    .from('mech_patterns')
    .update(update)
    .eq('id', patternId)
    .select()
    .single()

  if (error) handleSupabaseError(error)
  return data as TypedPatternRow
}

export async function deletePattern(patternId: string): Promise<void> {
  const { error } = await supabase.from('mech_patterns').delete().eq('id', patternId)

  if (error) handleSupabaseError(error)
}
