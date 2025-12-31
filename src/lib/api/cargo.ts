/**
 * Cargo API - CRUD operations for cargo with hydration
 *
 * All functions validate input with Zod schemas and return hydrated cargo.
 */

import { supabase } from '../supabase'
import type { TablesInsert, TablesUpdate } from '../../types/database-generated.types'
import type { HydratedCargo } from '../../types/hydrated'
import { hydrateCargo, hydrateCargoItems } from './hydration'
import { createCargoSchema, updateCargoSchema } from '../validation/cargo'

/**
 * Fetch all cargo for a parent (mech or crawler)
 *
 * @param parentType - Type of parent entity
 * @param parentId - ID of parent entity
 * @returns Array of hydrated cargo items
 * @throws Error if database query fails
 */
export async function fetchCargoForParent(
  parentType: 'mech' | 'crawler',
  parentId: string
): Promise<HydratedCargo[]> {
  const column = `${parentType}_id` as const

  const { data: cargo, error } = await supabase
    .from('cargo')
    .select('*')
    .eq(column, parentId)
    .order('created_at', { ascending: true })

  if (error) {
    throw new Error(`Failed to fetch cargo: ${error.message}`)
  }

  if (!cargo || cargo.length === 0) {
    return []
  }

  return hydrateCargoItems(cargo)
}

/**
 * Create a new cargo item
 *
 * @param data - Cargo data to insert
 * @returns Hydrated cargo item
 * @throws Error if validation fails or database insert fails
 */
export async function createCargo(data: TablesInsert<'cargo'>): Promise<HydratedCargo> {
  const validated = createCargoSchema.parse(data)

  const { data: cargo, error } = await supabase.from('cargo').insert(validated).select().single()

  if (error) {
    throw new Error(`Failed to create cargo: ${error.message}`)
  }

  return hydrateCargo(cargo)
}

/**
 * Update cargo item
 *
 * @param id - Cargo ID
 * @param updates - Partial cargo updates
 * @returns Updated hydrated cargo item
 * @throws Error if validation fails or database update fails
 */
export async function updateCargo(
  id: string,
  updates: TablesUpdate<'cargo'>
): Promise<HydratedCargo> {
  const validated = updateCargoSchema.parse(updates)

  const { data: cargo, error } = await supabase
    .from('cargo')
    .update(validated)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    throw new Error(`Failed to update cargo: ${error.message}`)
  }

  return hydrateCargo(cargo)
}

/**
 * Update cargo position in metadata
 *
 * @param id - Cargo ID
 * @param position - New position in grid
 * @returns Updated hydrated cargo item
 * @throws Error if database update fails
 */
export async function updateCargoPosition(
  id: string,
  position: { row: number; col: number }
): Promise<HydratedCargo> {
  const { data: cargo, error } = await supabase
    .from('cargo')
    .update({ metadata: { position } })
    .eq('id', id)
    .select()
    .single()

  if (error) {
    throw new Error(`Failed to update cargo position: ${error.message}`)
  }

  return hydrateCargo(cargo)
}

/**
 * Delete a cargo item
 *
 * @param id - Cargo ID
 * @throws Error if database delete fails
 */
export async function deleteCargo(id: string): Promise<void> {
  const { error } = await supabase.from('cargo').delete().eq('id', id)

  if (error) {
    throw new Error(`Failed to delete cargo: ${error.message}`)
  }
}
