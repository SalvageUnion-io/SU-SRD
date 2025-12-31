import { supabase } from '../supabase'
import type { Tables, TablesInsert } from '../../types/database-generated.types'
import { assertCanViewPilot } from '../permissions'

export type PilotRow = Tables<'pilots'>

/**
 * Fetch all pilots for a crawler
 * Checks permissions for each pilot before returning
 */
export async function fetchCrawlerPilots(crawlerId: string): Promise<PilotRow[]> {
  const { data, error } = await supabase
    .from('pilots')
    .select('*')
    .eq('crawler_id', crawlerId)
    .order('callsign')

  if (error) throw error

  const pilots = (data || []) as PilotRow[]

  for (const pilot of pilots) {
    await assertCanViewPilot(pilot)
  }

  return pilots
}

/**
 * Create a new pilot
 */
export async function createPilot(userId: string): Promise<PilotRow> {
  const pilotData: TablesInsert<'pilots'> = {
    callsign: 'Unknown Name',
    max_hp: 10,
    max_ap: 5,
    current_damage: 0,
    current_ap: 0,
    user_id: userId,
  }

  const { data, error } = await supabase.from('pilots').insert(pilotData).select().single()

  if (error) throw error
  if (!data) throw new Error('Failed to create pilot')
  return data as PilotRow
}

/**
 * Update a pilot
 */
export async function updatePilot(pilotId: string, updates: Partial<PilotRow>): Promise<void> {
  const { error } = await supabase.from('pilots').update(updates).eq('id', pilotId)

  if (error) throw error
}
