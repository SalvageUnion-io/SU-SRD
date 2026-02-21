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
