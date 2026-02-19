import { supabase } from '../supabase'
import { handleSupabaseError } from '../errors'
import type { PlayerChoiceRow, PlayerChoiceInsert } from '../../types/common'
import type { ParentType } from 'salvageunion-reference'

export async function getPlayerChoices(
  parentId: string,
  parentType: ParentType
): Promise<PlayerChoiceRow[]> {
  const { data, error } = await supabase
    .from('player_choices')
    .select('*')
    .eq('parent_id', parentId)
    .eq('parent_type', parentType)

  if (error) handleSupabaseError(error)
  return data!
}

export async function upsertPlayerChoice(input: PlayerChoiceInsert): Promise<PlayerChoiceRow> {
  // Check for existing row by (parent_id, choice_id)
  const { data: existing } = await supabase
    .from('player_choices')
    .select('id')
    .eq('parent_id', input.parent_id!)
    .eq('choice_id', input.choice_id)
    .maybeSingle()

  if (existing) {
    const { data, error } = await supabase
      .from('player_choices')
      .update({
        selected_value: input.selected_value,
        roll_value: input.roll_value,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id)
      .select()
      .single()

    if (error) handleSupabaseError(error)
    return data!
  }

  const { data, error } = await supabase.from('player_choices').insert(input).select().single()

  if (error) handleSupabaseError(error)
  return data!
}
