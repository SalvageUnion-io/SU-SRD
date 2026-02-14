import { supabase } from '../supabase'
import { handleSupabaseError } from '../errors'
import { createPlayerChoiceSchema } from '../validation'
import type { PlayerChoice } from '../../types/common'

export async function fetchChoicesByEntityRef(entityRefId: string): Promise<PlayerChoice[]> {
  const { data, error } = await supabase
    .from('player_choices')
    .select('*')
    .eq('entity_ref_id', entityRefId)

  if (error) handleSupabaseError(error)
  return data ?? []
}

async function createChoice(
  input: {
    entity_ref_id?: string | null
    parent_choice_id?: string | null
    choice_ref_id: string
    value: string
  },
  userId: string
): Promise<PlayerChoice> {
  const validated = createPlayerChoiceSchema.parse(input)
  const { data, error } = await supabase
    .from('player_choices')
    .insert({ ...validated, user_id: userId })
    .select()
    .single()

  if (error) handleSupabaseError(error)
  return data
}

export async function upsertChoice(
  entityRefId: string,
  choiceRefId: string,
  value: string,
  userId: string
): Promise<PlayerChoice> {
  // Check if choice already exists
  const { data: existing } = await supabase
    .from('player_choices')
    .select('id')
    .eq('entity_ref_id', entityRefId)
    .eq('choice_ref_id', choiceRefId)
    .maybeSingle()

  if (existing) {
    const { data, error } = await supabase
      .from('player_choices')
      .update({ value })
      .eq('id', existing.id)
      .select()
      .single()

    if (error) handleSupabaseError(error)
    return data
  }

  return createChoice({ entity_ref_id: entityRefId, choice_ref_id: choiceRefId, value }, userId)
}

export async function deleteChoice(id: string): Promise<void> {
  const { error } = await supabase.from('player_choices').delete().eq('id', id)
  if (error) handleSupabaseError(error)
}
