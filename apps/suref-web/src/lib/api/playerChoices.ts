/**
 * Player Choice API - CRUD operations for player choices
 *
 * Player choices are associated with entities OR other player choices (nested).
 * This supports chains like: Ability → System choice → Module choice
 */

import { supabase } from '../supabase'
import type { Tables, TablesInsert } from '../../types/database-generated.types'
import { upsertPlayerChoiceSchema } from '../validation/playerChoice'

/**
 * Fetch all choices for an entity
 *
 * @param entityId - Entity ID
 * @returns Array of player choices (may include multiple selections for the same choice_ref_id)
 * @throws Error if database query fails
 */
export async function fetchChoicesForEntity(entityId: string): Promise<Tables<'player_choices'>[]> {
  const { data, error } = await supabase
    .from('player_choices')
    .select('*')
    .eq('entity_id', entityId)
    .order('created_at', { ascending: true })

  if (error) {
    throw new Error(`Failed to fetch player choices: ${error.message}`)
  }

  return data || []
}

/**
 * Fetch all selections for a specific choice_ref_id on an entity
 *
 * @param entityId - Entity ID
 * @param choiceRefId - Choice reference ID
 * @returns Array of player choices for this specific choice
 * @throws Error if database query fails
 */
export async function fetchSelectionsForChoice(
  entityId: string,
  choiceRefId: string
): Promise<Tables<'player_choices'>[]> {
  const { data, error } = await supabase
    .from('player_choices')
    .select('*')
    .eq('entity_id', entityId)
    .eq('choice_ref_id', choiceRefId)
    .order('created_at', { ascending: true })

  if (error) {
    throw new Error(`Failed to fetch selections for choice: ${error.message}`)
  }

  return data || []
}

/**
 * Fetch all nested choices for a player choice
 *
 * @param choiceId - Player choice ID
 * @returns Array of nested player choices
 * @throws Error if database query fails
 */
export async function fetchChoicesForChoice(choiceId: string): Promise<Tables<'player_choices'>[]> {
  const { data, error } = await supabase
    .from('player_choices')
    .select('*')
    .eq('player_choice_id', choiceId)
    .order('created_at', { ascending: true })

  if (error) {
    throw new Error(`Failed to fetch nested choices: ${error.message}`)
  }

  return data || []
}

/**
 * Create a new player choice
 *
 * Note: For single-select choices, application logic should delete existing
 * selections before calling this function. For multi-select choices, this
 * can be called multiple times to add additional selections.
 *
 * @param data - Player choice data
 * @returns Created player choice
 * @throws Error if validation fails or database operation fails
 */
export async function createPlayerChoice(
  data: TablesInsert<'player_choices'>
): Promise<Tables<'player_choices'>> {
  const validated = upsertPlayerChoiceSchema.parse(data)

  const { data: choice, error } = await supabase
    .from('player_choices')
    .insert(validated)
    .select()
    .single()

  if (error) {
    throw new Error(`Failed to create player choice: ${error.message}`)
  }

  return choice
}

/**
 * Create or update a player choice (upsert)
 *
 * For single-select choices: deletes existing selection and creates new one.
 * For multi-select choices: always creates a new selection.
 *
 * @param data - Player choice data
 * @param isMultiSelect - Whether this choice allows multiple selections
 * @returns Created or updated player choice
 * @throws Error if validation fails or database operation fails
 */
export async function upsertPlayerChoice(
  data: TablesInsert<'player_choices'>,
  isMultiSelect = false
): Promise<Tables<'player_choices'>> {
  // For single-select choices, delete existing selection first
  if (!isMultiSelect && data.entity_id) {
    await supabase
      .from('player_choices')
      .delete()
      .eq('entity_id', data.entity_id)
      .eq('choice_ref_id', data.choice_ref_id)
  } else if (!isMultiSelect && (data as { player_choice_id?: string }).player_choice_id) {
    await supabase
      .from('player_choices')
      .delete()
      .eq('player_choice_id', (data as { player_choice_id: string }).player_choice_id)
      .eq('choice_ref_id', data.choice_ref_id)
  }

  // Always create new selection
  return createPlayerChoice(data)
}

/**
 * Delete a player choice
 *
 * @param id - Player choice ID
 * @throws Error if database delete fails
 */
export async function deletePlayerChoice(id: string): Promise<void> {
  const { error } = await supabase.from('player_choices').delete().eq('id', id)

  if (error) {
    throw new Error(`Failed to delete player choice: ${error.message}`)
  }
}

/**
 * Delete all choices for an entity
 *
 * Useful when removing an entity or resetting choices.
 * Cascade delete will automatically remove nested choices.
 *
 * @param entityId - Entity ID
 * @throws Error if database delete fails
 */
export async function deleteChoicesForEntity(entityId: string): Promise<void> {
  const { error } = await supabase.from('player_choices').delete().eq('entity_id', entityId)

  if (error) {
    throw new Error(`Failed to delete player choices: ${error.message}`)
  }
}

/**
 * Delete all nested choices for a player choice
 *
 * Useful when changing a choice value that had nested choices.
 * Cascade delete will automatically remove deeply nested choices.
 *
 * @param choiceId - Player choice ID
 * @throws Error if database delete fails
 */
export async function deleteChoicesForChoice(choiceId: string): Promise<void> {
  const { error } = await supabase.from('player_choices').delete().eq('player_choice_id', choiceId)

  if (error) {
    throw new Error(`Failed to delete nested choices: ${error.message}`)
  }
}
