import { supabase } from '../supabase'
import { createPilotSchema, updatePilotSchema } from '../validation'
import type { Pilot, PilotWithActiveMech } from '../../types/common'

export async function fetchPilotRoster(): Promise<PilotWithActiveMech[]> {
  const { data: pilots, error: pilotsError } = await supabase
    .from('pilots')
    .select('*')
    .order('created_at', { ascending: false })

  if (pilotsError) throw pilotsError
  if (!pilots?.length) return []

  const pilotIds = pilots.map((p) => p.id)
  const { data: mechs, error: mechsError } = await supabase
    .from('mechs')
    .select('*')
    .in('pilot_id', pilotIds)
    .eq('active', true)

  if (mechsError) throw mechsError

  const mechByPilot = new Map(mechs?.map((m) => [m.pilot_id, m]))

  return pilots.map((pilot) => ({
    ...pilot,
    active_mech: mechByPilot.get(pilot.id) ?? null,
  }))
}

export async function fetchPilot(id: string): Promise<Pilot> {
  const { data, error } = await supabase.from('pilots').select('*').eq('id', id).single()

  if (error) throw error
  return data
}

export async function createPilot(
  input: { callsign: string; class_ref?: string | null },
  userId: string
): Promise<Pilot> {
  const validated = createPilotSchema.parse(input)
  const { data, error } = await supabase
    .from('pilots')
    .insert({ ...validated, user_id: userId })
    .select()
    .single()

  if (error) throw error
  return data
}

export async function updatePilot(id: string, input: Record<string, unknown>): Promise<Pilot> {
  const validated = updatePilotSchema.parse(input)
  const { data, error } = await supabase
    .from('pilots')
    .update(validated)
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data
}

export async function deletePilot(id: string): Promise<void> {
  const { error } = await supabase.from('pilots').delete().eq('id', id)
  if (error) throw error
}
