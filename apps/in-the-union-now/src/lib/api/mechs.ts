import { supabase } from '../supabase'
import { createMechSchema, updateMechSchema } from '../validation'
import type { Mech } from '../../types/common'

export async function fetchMech(id: string): Promise<Mech> {
  const { data, error } = await supabase.from('mechs').select('*').eq('id', id).single()

  if (error) throw error
  return data
}

export async function fetchUserMechs(): Promise<Mech[]> {
  const { data, error } = await supabase
    .from('mechs')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) throw error
  return data ?? []
}

export async function fetchMechsByPilot(pilotId: string): Promise<Mech[]> {
  const { data, error } = await supabase
    .from('mechs')
    .select('*')
    .eq('pilot_id', pilotId)
    .order('active', { ascending: false })
    .order('created_at', { ascending: false })

  if (error) throw error
  return data ?? []
}

export async function createMech(
  input: { name?: string; chassis_ref?: string | null; pilot_id?: string | null },
  userId: string
): Promise<Mech> {
  const validated = createMechSchema.parse(input)
  const { data, error } = await supabase
    .from('mechs')
    .insert({ ...validated, user_id: userId })
    .select()
    .single()

  if (error) throw error
  return data
}

export async function updateMech(id: string, input: Record<string, unknown>): Promise<Mech> {
  const validated = updateMechSchema.parse(input)
  const { data, error } = await supabase
    .from('mechs')
    .update(validated)
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data
}

export async function setActiveMech(pilotId: string, mechId: string): Promise<void> {
  // Deactivate all mechs for this pilot
  const { error: deactivateError } = await supabase
    .from('mechs')
    .update({ active: false })
    .eq('pilot_id', pilotId)

  if (deactivateError) throw deactivateError

  // Activate the selected mech
  const { error: activateError } = await supabase
    .from('mechs')
    .update({ active: true })
    .eq('id', mechId)

  if (activateError) throw activateError
}

export async function deleteMech(id: string): Promise<void> {
  const { error } = await supabase.from('mechs').delete().eq('id', id)
  if (error) throw error
}
