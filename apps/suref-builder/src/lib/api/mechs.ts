import { supabase } from '../supabase'
import type { Tables, TablesInsert } from '../../types/database-generated.types'
import { assertCanViewMech } from '../permissions'

export type MechRow = Tables<'mechs'>

/**
 * Fetch mechs for multiple pilots
 * Checks permissions for each mech before returning
 */
export async function fetchPilotsMechs(pilotIds: string[]): Promise<MechRow[]> {
  if (pilotIds.length === 0) return []

  const { data, error } = await supabase.from('mechs').select('*').in('pilot_id', pilotIds)

  if (error) throw error

  const mechs = (data || []) as MechRow[]

  for (const mech of mechs) {
    await assertCanViewMech(mech)
  }

  return mechs
}

/**
 * Create a new mech
 */
export async function createMech(userId: string): Promise<MechRow> {
  const mechData: TablesInsert<'mechs'> = {
    pattern: 'New Mech',
    current_damage: 0,
    current_heat: 0,
    current_ep: 0,
    user_id: userId,
  }

  const { data, error } = await supabase.from('mechs').insert(mechData).select().single()

  if (error) throw error
  if (!data) throw new Error('Failed to create mech')
  return data as MechRow
}

/**
 * Update a mech
 * If setting active to true, automatically deactivates all other mechs for the same pilot
 */
export async function updateMech(mechId: string, updates: Partial<MechRow>): Promise<void> {
  if (updates.active === true) {
    const { data: mech, error: fetchError } = await supabase
      .from('mechs')
      .select('pilot_id')
      .eq('id', mechId)
      .single()

    if (fetchError) throw fetchError

    if (mech?.pilot_id) {
      const { error: deactivateError } = await supabase
        .from('mechs')
        .update({ active: false })
        .eq('pilot_id', mech.pilot_id)
        .neq('id', mechId)

      if (deactivateError) throw deactivateError
    }
  }

  const { error } = await supabase.from('mechs').update(updates).eq('id', mechId)

  if (error) throw error
}
