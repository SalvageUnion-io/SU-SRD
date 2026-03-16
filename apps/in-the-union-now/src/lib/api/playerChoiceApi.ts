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
    .select(
      'id,choice_id,choice_type,created_at,entity_ref_id,guide_step_id,parent_choice_id,parent_id,parent_type,roll_value,selected_value,selected_values,updated_at,user_id'
    )
    .eq('parent_id', parentId)
    .eq('parent_type', parentType)

  if (error) handleSupabaseError(error)
  return data!
}

export async function upsertPlayerChoice(input: PlayerChoiceInsert): Promise<PlayerChoiceRow> {
  const { data, error } = await supabase
    .from('player_choices')
    .upsert(
      { ...input, updated_at: new Date().toISOString() },
      { onConflict: 'parent_id,parent_type,choice_id' }
    )
    .select()
    .single()

  if (error) handleSupabaseError(error)
  return data!
}
